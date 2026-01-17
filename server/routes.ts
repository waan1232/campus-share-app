import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { setupAuth } from "./auth";
import { z } from "zod";
import { pool } from "./db";
import { containsBannedWords } from "@shared/utils";
import multer from "multer";
import path from "path";
import express from "express";
import fs from "fs";
import { sendVerificationEmail } from "./mailer"; 
import Stripe from "stripe"; // <--- NEW IMPORT

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2025-01-27.acacia", // Use latest version available
});

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // Auth
  setupAuth(app);

  // --- SETUP FILE STORAGE ---
  const uploadDir = path.join(process.cwd(), "uploads");
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
  }

  const storageConfig = multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const ext = path.extname(file.originalname);
      cb(null, 'image-' + uniqueSuffix + ext);
    }
  });

  const upload = multer({ storage: storageConfig });
  app.use('/uploads', express.static(uploadDir));

  app.post("/api/upload", upload.single('image'), (req, res) => {
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });
    const imageUrl = `/uploads/${req.file.filename}`;
    res.json({ imageUrl });
  });

  // --- AUTOMATIC DATABASE SCHEMA UPDATES ---
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id SERIAL PRIMARY KEY,
        sender_id INTEGER REFERENCES users(id),
        receiver_id INTEGER REFERENCES users(id),
        rental_id INTEGER REFERENCES rentals(id),
        content TEXT NOT NULL,
        sent_at TIMESTAMP DEFAULT NOW(),
        read BOOLEAN DEFAULT FALSE
      );
      
      -- Add School, Profile, Payment & Offer Columns
      ALTER TABLE users ADD COLUMN IF NOT EXISTS school TEXT DEFAULT 'General Public';
      ALTER TABLE users ADD COLUMN IF NOT EXISTS venmo_handle TEXT;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS cashapp_tag TEXT;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS location TEXT;

      -- NEW: Verification Columns
      ALTER TABLE users ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_code TEXT;

      -- New Columns for Bargaining
      ALTER TABLE messages ADD COLUMN IF NOT EXISTS item_id INTEGER REFERENCES items(id);
      ALTER TABLE messages ADD COLUMN IF NOT EXISTS offer_price INTEGER;
      ALTER TABLE messages ADD COLUMN IF NOT EXISTS offer_status TEXT DEFAULT 'none';
      ALTER TABLE messages ADD COLUMN IF NOT EXISTS start_date TIMESTAMP;
      ALTER TABLE messages ADD COLUMN IF NOT EXISTS end_date TIMESTAMP;

      -- NEW: Withdrawal Table
      CREATE TABLE IF NOT EXISTS withdrawals (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        amount INTEGER NOT NULL,
        method TEXT NOT NULL,
        details TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    
    console.log("Database schema verified (Verification & Withdrawals Active).");
  } catch (err) {
    console.error("Error updating schema:", err);
  }

  // --- STRIPE CHECKOUT ROUTE ---
  app.post("/api/create-checkout-session", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send("Not logged in");
    
    const { rentalId, title, price, days, image } = req.body;
    
    // Calculate total amount (Stripe uses cents, so $10.00 = 1000)
    const amountInCents = Math.round(price * days * 100); 

    try {
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        line_items: [
          {
            price_data: {
              currency: "usd",
              product_data: {
                name: `Rental: ${title}`,
                description: `Renting for ${days} days`,
                images: image ? [image] : [], 
              },
              unit_amount: amountInCents,
            },
            quantity: 1,
          },
        ],
        mode: "payment",
        // Make sure BASE_URL is set in .env, otherwise fallback to localhost
        success_url: `${process.env.BASE_URL || 'http://localhost:5000'}/dashboard?payment=success&rentalId=${rentalId}`,
        cancel_url: `${process.env.BASE_URL || 'http://localhost:5000'}/dashboard?payment=cancelled`,
        metadata: {
          rentalId: rentalId.toString(),
          userId: (req.user as any).id.toString()
        }
      });

      res.json({ url: session.url });
    } catch (error: any) {
      console.error("Stripe Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // --- GET BALANCE & HISTORY ---
  app.get("/api/balance", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send("Not logged in");
    const userId = (req.user as any).id;

    try {
      // 1. Calculate Total Earnings (from Rentals)
      const earningsResult = await pool.query(
        `SELECT r.start_date, r.end_date, i.price_per_day
         FROM rentals r
         JOIN items i ON r.item_id = i.id
         WHERE i.owner_id = $1`,
        [userId]
      );
      
      let totalEarned = 0;
      earningsResult.rows.forEach(row => {
         const days = Math.ceil((new Date(row.end_date).getTime() - new Date(row.start_date).getTime()) / (1000 * 60 * 60 * 24));
         totalEarned += (row.price_per_day * days);
      });

      // 2. Calculate Total Withdrawn
      const withdrawResult = await pool.query(
        `SELECT SUM(amount) as total_withdrawn FROM withdrawals WHERE user_id = $1 AND status != 'rejected'`,
        [userId]
      );
      const totalWithdrawn = parseInt(withdrawResult.rows[0].total_withdrawn || '0');

      // 3. Available Balance
      const available = totalEarned - totalWithdrawn;

      // 4. Get recent withdrawal history
      const historyResult = await pool.query(
        `SELECT * FROM withdrawals WHERE user_id = $1 ORDER BY created_at DESC`,
        [userId]
      );

      res.json({ 
        totalEarned, 
        totalWithdrawn, 
        available, 
        history: historyResult.rows 
      });
    } catch (error) {
      console.error("Balance error:", error);
      res.status(500).json({ error: "Failed to calculate balance" });
    }
  });

  // --- REQUEST WITHDRAWAL ---
  app.post("/api/withdraw", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send("Not logged in");
    const userId = (req.user as any).id;
    const { amount, method, details } = req.body;

    try {
      await pool.query(
        `INSERT INTO withdrawals (user_id, amount, method, details, status) VALUES ($1, $2, $3, $4, 'pending')`,
        [userId, amount, method, details]
      );
      res.sendStatus(200);
    } catch (error) {
      console.error("Withdraw error:", error);
      res.status(500).json({ error: "Withdrawal failed" });
    }
  });

  // --- VERIFICATION ROUTES ---

  // 1. Verify Account
  app.post("/api/verify-account", async (req, res) => {
      if (!req.isAuthenticated()) return res.status(401).send("Not logged in");
      const { code } = req.body;
      
      const success = await storage.verifyUser((req.user as any).id, code);
      
      if (success) {
          res.sendStatus(200);
      } else {
          res.status(400).json({ message: "Invalid verification code" });
      }
  });

  // 2. Resend Verification Code
  app.post("/api/resend-verification", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send("Not logged in");
    const user = req.user as any;
    
    // Generate new code
    const newCode = Math.floor(100000 + Math.random() * 900000).toString();
    
    try {
      // Update DB
      await pool.query(`UPDATE users SET verification_code = $1 WHERE id = $2`, [newCode, user.id]);
      
      // Send Email
      console.log(`Resending code to ${user.email}...`);
      await sendVerificationEmail(user.email, newCode);
      
      res.sendStatus(200);
    } catch (e) {
      console.error(e);
      res.status(500).json({ message: "Failed to resend code" });
    }
  });

  // 3. Manual Logout
  app.post("/api/auth/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      res.sendStatus(200);
    });
  });

  // --- ACCOUNT ROUTES ---
  app.patch("/api/user", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send("Not logged in");
    const userId = (req.user as any).id;
    const { name, email, bio, location, venmo_handle, cashapp_tag } = req.body; 

    try {
      const result = await pool.query(
        `UPDATE users 
         SET name = COALESCE($1, name), 
             email = COALESCE($2, email),
             bio = COALESCE($3, bio),
             location = COALESCE($4, location),
             venmo_handle = COALESCE($5, venmo_handle),
             cashapp_tag = COALESCE($6, cashapp_tag)
         WHERE id = $7 
         RETURNING id, username, name, email, bio, location, venmo_handle, cashapp_tag, school, is_verified`,
        [name, email, bio, location, venmo_handle, cashapp_tag, userId]
      );
      res.json(result.rows[0]);
    } catch (error) {
      res.status(500).json({ error: "Failed to update profile" });
    }
  });

  // DELETE ACCOUNT
  app.delete("/api/user", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send("Not logged in");
    const userId = (req.user as any).id;
    
    try {
      await storage.deleteUser(userId);
      req.logout((err) => {
        if (err) return res.status(500).send("Error logging out");
        res.sendStatus(200);
      });
    } catch (error) {
      console.error("Delete account error:", error);
      res.status(500).json({ error: "Failed to delete account" });
    }
  });

  app.patch("/api/user/password", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send("Not logged in");
    const userId = (req.user as any).id;
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }

    try {
      const { scrypt, randomBytes } = await import("crypto");
      const { promisify } = await import("util");
      const scryptAsync = promisify(scrypt);
      const salt = randomBytes(16).toString("hex");
      const buf = (await scryptAsync(newPassword, salt, 64)) as Buffer;
      const hashedPassword = `${buf.toString("hex")}.${salt}`;

      await pool.query(`UPDATE users SET password = $1 WHERE id = $2`, [hashedPassword, userId]);
      res.sendStatus(200);
    } catch (error) {
      res.status(500).json({ error: "Failed to update password" });
    }
  });

  app.get("/api/earnings", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send("Not logged in");
    const userId = (req.user as any).id;

    try {
      const result = await pool.query(
        `SELECT r.*, i.title, i.price_per_day, i.image_url,
                u.username as renter_name
         FROM rentals r
         JOIN items i ON r.item_id = i.id
         JOIN users u ON r.renter_id = u.id
         WHERE i.owner_id = $1
         ORDER BY r.start_date DESC`,
        [userId]
      );

      const rentals = result.rows.map(row => {
        const days = Math.ceil((new Date(row.end_date).getTime() - new Date(row.start_date).getTime()) / (1000 * 60 * 60 * 24));
        const total = (row.price_per_day * days); 
        return { ...row, total_earnings: total, days };
      });

      const totalLifetime = rentals.reduce((acc, curr) => acc + curr.total_earnings, 0);

      res.json({ total: totalLifetime, history: rentals });
    } catch (error) {
      console.error("Earnings error:", error);
      res.status(500).json({ error: "Failed to fetch earnings" });
    }
  });

  // --- ITEM ROUTES ---
  app.get(api.items.list.path, async (req, res) => {
    const search = req.query.search as string | undefined;
    const category = req.query.category as string | undefined;
    
    // Pass the user (if logged in) or undefined (if public)
    const user = req.isAuthenticated() ? (req.user as any) : undefined;

    // Storage now handles showing "General Public" items to guests
    const items = await storage.getItems(user, { search, category });
    res.json(items);
  });

  app.patch(api.items.update.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    const itemId = Number(req.params.id);
    const item = await storage.getItem(itemId);
    if (!item) return res.status(404).json({ message: "Item not found" });
    if (item.ownerId !== (req.user as any).id) return res.status(403).json({ message: "Unauthorized" });

    try {
      const updateData = api.items.update.input.parse(req.body);
      const updatedItem = await storage.updateItem(itemId, updateData);
      res.json(updatedItem);
    } catch (e) { res.status(400).json({ message: "Invalid input" }); }
  });

  app.delete("/api/items/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    await storage.deleteItem(Number(req.params.id));
    res.sendStatus(204);
  });

  app.get("/api/my-items", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    const items = await storage.getUserItems((req.user as any).id);
    res.json(items);
  });

  app.get(api.items.get.path, async (req, res) => {
    const item = await storage.getItem(Number(req.params.id));
    if (!item) return res.status(404).json({ message: "Item not found" });
    res.json(item);
  });

  app.post(api.items.create.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    try {
      const itemData = api.items.create.input.parse(req.body);
      if (containsBannedWords(itemData.title) || containsBannedWords(itemData.description)) {
        return res.status(400).json({ message: "Content contains prohibited words" });
      }
      const item = await storage.createItem({ ...itemData, ownerId: (req.user as any).id });
      res.status(201).json(item);
    } catch (e) { res.status(400).json({ message: "Invalid input" }); }
  });

  app.post(api.favorites.toggle.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    const isFavorite = await storage.toggleFavorite((req.user as any).id, Number(req.params.itemId));
    res.json({ isFavorite });
  });

  app.get(api.favorites.list.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    const favorites = await storage.getFavorites((req.user as any).id);
    res.json(favorites);
  });

  // --- RENTAL ROUTES ---
  app.post(api.rentals.create.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    try {
      const body = { ...req.body, startDate: new Date(req.body.startDate), endDate: new Date(req.body.endDate) };
      api.rentals.create.input.parse(body);
      const rental = await storage.createRental({
        itemId: body.itemId, startDate: body.startDate, endDate: body.endDate, renterId: (req.user as any).id,
      });
      res.status(201).json(rental);
    } catch (e) { res.status(400).json({ message: "Invalid input" }); }
  });

  app.get(api.rentals.list.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    const rentals = await storage.getRentalsForUser((req.user as any).id);
    res.json(rentals);
  });

  app.patch(api.rentals.updateStatus.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    try {
      const { status } = api.rentals.updateStatus.input.parse(req.body);
      const rental = await storage.updateRentalStatus(Number(req.params.id), status);
      res.json(rental);
    } catch (e) { res.status(400).json({ message: "Invalid input" }); }
  });

  app.post("/api/items/:id/unavailable", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    const itemId = Number(req.params.id);
    const item = await storage.getItem(itemId);
    if (!item || item.ownerId !== (req.user as any).id) return res.status(403).json({ message: "Unauthorized" });
    try {
      const { startDate, endDate } = z.object({
        startDate: z.string().transform(s => new Date(s)),
        endDate: z.string().transform(s => new Date(s)),
      }).parse(req.body);
      const block = await storage.createUnavailabilityBlock(itemId, (req.user as any).id, startDate, endDate);
      res.status(201).json(block);
    } catch (e) { res.status(400).json({ message: "Invalid input" }); }
  });

  app.delete("/api/rentals/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    await storage.deleteRental(Number(req.params.id));
    res.sendStatus(204);
  });

  // --- MESSAGING SYSTEM ROUTES ---
  app.post("/api/messages", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send("Not logged in");
    
    const { receiverId, content, rentalId, itemId, offerPrice, startDate, endDate } = req.body;
    const senderId = (req.user as any).id;

    try {
      const status = offerPrice ? 'pending' : 'none';
      
      const result = await pool.query(
        `INSERT INTO messages (sender_id, receiver_id, content, rental_id, item_id, offer_price, offer_status, start_date, end_date) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
        [senderId, receiverId, content, rentalId || null, itemId || null, offerPrice || null, status, startDate || null, endDate || null]
      );
      res.json(result.rows[0]);
    } catch (error) {
      console.error("Message error:", error);
      res.status(500).json({ error: "Failed to send message" });
    }
  });

  app.patch("/api/messages/:id/offer", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send("Not logged in");
    const msgId = Number(req.params.id);
    const { status } = req.body; // 'accepted' or 'rejected'

    try {
      const msgResult = await pool.query(
        `UPDATE messages SET offer_status = $1 WHERE id = $2 RETURNING *`,
        [status, msgId]
      );
      const message = msgResult.rows[0];

      if (status === 'accepted' && message.item_id && message.start_date && message.end_date) {
        await storage.createRental({
            itemId: message.item_id,
            renterId: message.sender_id, 
            startDate: new Date(message.start_date),
            endDate: new Date(message.end_date)
        });
      }

      res.json(message);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to update offer" });
    }
  });

  app.get("/api/messages", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send("Not logged in");
    const myId = (req.user as any).id;

    try {
      const result = await pool.query(
        `SELECT m.*, 
                u_sender.username as sender_name, 
                u_receiver.username as receiver_name,
                i.title as item_title,
                i.image_url as item_image,
                i.price_per_day as item_original_price
         FROM messages m
         JOIN users u_sender ON m.sender_id = u_sender.id
         JOIN users u_receiver ON m.receiver_id = u_receiver.id
         LEFT JOIN items i ON m.item_id = i.id
         WHERE m.sender_id = $1 OR m.receiver_id = $1
         ORDER BY m.sent_at DESC`,
        [myId]
      );
      res.json(result.rows);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch messages" });
    }
  });

  app.post("/api/messages/mark-read", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send("Not logged in");
    const { senderId } = req.body;
    await pool.query(`UPDATE messages SET read = TRUE WHERE sender_id = $1 AND receiver_id = $2`, [senderId, (req.user as any).id]);
    res.sendStatus(200);
  });

  app.delete("/api/messages/:otherUserId", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send("Not logged in");
    const otherId = Number(req.params.otherUserId);
    const myId = (req.user as any).id;
    await pool.query(`DELETE FROM messages WHERE (sender_id = $1 AND receiver_id = $2) OR (sender_id = $2 AND receiver_id = $1)`, [myId, otherId]);
    res.sendStatus(200);
  });

  try { await seedDatabase(); } catch (e) { console.error("Seeding failed", e); }

  return httpServer;
}

// Helper function
async function seedDatabase() {
  const existingItems = await storage.getItems();
  if (existingItems.length > 0) return;

  const existingUser = await storage.getUserByUsername("campus_admin");
  let user = existingUser;

  if (!user) {
    const { scrypt, randomBytes } = await import("crypto");
    const { promisify } = await import("util");
    const scryptAsync = promisify(scrypt);
    const hash = async (pwd: string) => {
        const salt = randomBytes(16).toString("hex");
        const buf = (await scryptAsync(pwd, salt, 64)) as Buffer;
        return `${buf.toString("hex")}.${salt}`;
    }
    const pwd = await hash("password123");
    user = await storage.createUser({ 
        username: "campus_admin", 
        password: pwd, 
        name: "Admin User", 
        email: "admin@college.edu",
    });
    if(user) {
        await pool.query(`UPDATE users SET is_verified = TRUE WHERE id = $1`, [user.id]);
    }
  }

  const itemsToSeed = [
    { title: "TI-84 Plus CE Calculator", description: "Color graphing calculator.", category: "Textbooks", pricePerDay: 500, imageUrl: "https://images.unsplash.com/photo-1596200923062-8e7c1c633a16", ownerId: user.id },
    { title: "JBL Flip 5 Speaker", description: "Waterproof portable speaker.", category: "Party", pricePerDay: 1000, imageUrl: "https://images.unsplash.com/photo-1612444530582-fc66183b16f7", ownerId: user.id },
  ];
  for (const item of itemsToSeed) await storage.createItem(item);
  console.log("Database seeded successfully!");
}
