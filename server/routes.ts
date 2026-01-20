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
import Stripe from "stripe";
import { sendUsernameRecoveryEmail, sendPasswordResetEmail } from "./mailer";

// Initialize Stripe
// We use a fallback key to prevent crashes during build, but functionality requires the real key
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "sk_test_placeholder", {
  apiVersion: "2025-01-27.acacia", 
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

      -- Verification Columns
      ALTER TABLE users ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_code TEXT;

      -- STRIPE CONNECT COLUMNS (Crucial)
      ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_account_id TEXT;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS is_stripe_verified BOOLEAN DEFAULT FALSE;

      -- New Columns for Bargaining
      ALTER TABLE messages ADD COLUMN IF NOT EXISTS item_id INTEGER REFERENCES items(id);
      ALTER TABLE messages ADD COLUMN IF NOT EXISTS offer_price INTEGER;
      ALTER TABLE messages ADD COLUMN IF NOT EXISTS offer_status TEXT DEFAULT 'none';
      ALTER TABLE messages ADD COLUMN IF NOT EXISTS start_date TIMESTAMP;
      ALTER TABLE messages ADD COLUMN IF NOT EXISTS end_date TIMESTAMP;

      -- Withdrawal Table
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
    
    console.log("Database schema verified (Stripe Connect & Withdrawals Active).");
  } catch (err) {
    console.error("Error updating schema:", err);
  }

  // ==========================================
  //  STRIPE CONNECT ROUTES
  // ==========================================

  // 1. ONBOARDING
  app.post("/api/stripe/onboard", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send("Not logged in");
    const user = req.user as any;

    try {
      let accountId = user.stripe_account_id; 

      // Create account if not exists
      // ... inside /api/stripe/onboard

      // Create account if not exists
      if (!accountId) {
        const account = await stripe.accounts.create({
          type: "express",
          country: "US",
          email: user.email,
          business_type: "individual",
          
          individual: {
             email: user.email,
             first_name: user.name.split(" ")[0],
             last_name: user.name.split(" ").slice(1).join(" ") || "",
          },

          // --- NEW: SKIP THE BUSINESS DETAILS SCREEN ---
          business_profile: {
            mcc: "7394", // Code for "Equipment Rental & Leasing"
            url: "https://campusshareapp.com", // Use your platform URL since students don't have one
            product_description: "Peer-to-peer rental of college supplies and equipment.",
          },
          // ---------------------------------------------

          capabilities: {
            card_payments: { requested: true },
            transfers: { requested: true },
          },
        });
        
        accountId = account.id;
        await pool.query(`UPDATE users SET stripe_account_id = $1 WHERE id = $2`, [accountId, user.id]);
      }

      // Create the Account Link (The URL Stripe sends back)
      const accountLink = await stripe.accountLinks.create({
        account: accountId,
        refresh_url: `${process.env.BASE_URL || 'http://localhost:5000'}/account`,
        return_url: `${process.env.BASE_URL || 'http://localhost:5000'}/account?stripe=success`,
        type: "account_onboarding",
      });

      res.json({ url: accountLink.url });
    } catch (error: any) {
      console.error("Stripe Onboarding Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // 2. CHECK STATUS
  app.get("/api/stripe/check-status", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send("Not logged in");
    const user = req.user as any;
    
    const dbResult = await pool.query(`SELECT stripe_account_id, is_stripe_verified FROM users WHERE id = $1`, [user.id]);
    const userData = dbResult.rows[0];

    if (!userData || !userData.stripe_account_id) return res.json({ complete: false });

    try {
      const account = await stripe.accounts.retrieve(userData.stripe_account_id);
      const isComplete = account.charges_enabled;

      if (isComplete && !userData.is_stripe_verified) {
         await pool.query(`UPDATE users SET is_stripe_verified = TRUE WHERE id = $1`, [user.id]);
      }
      res.json({ complete: isComplete });
    } catch (e) {
      res.json({ complete: false });
    }
  });

  // 3. CHECKOUT SESSION (Split Payments)
  // 3. CHECKOUT SESSION (With URL Auto-Fix)
  // 3. CHECKOUT SESSION (Fixed Image URL)
  app.post("/api/create-checkout-session", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send("Not logged in");
    
    const { rentalId, title, price, days, image, ownerId } = req.body;
    
    // Get Owner Stripe ID
    const ownerResult = await pool.query(`SELECT stripe_account_id FROM users WHERE id = $1`, [ownerId]);
    const ownerStripeId = ownerResult.rows[0]?.stripe_account_id;

    if (!ownerStripeId) {
        return res.status(400).json({ error: "Owner has not set up payouts yet." });
    }

    const totalAmount = Math.round(price * days); 
    const platformFee = Math.round(totalAmount * 0.15);

    // 1. Ensure Base URL is valid HTTPS
    let baseUrl = process.env.BASE_URL || "http://localhost:5000";
    if (!baseUrl.startsWith("http")) {
      baseUrl = `https://${baseUrl}`;
    }

    // 2. Fix the Image URL (THIS IS THE FIX)
    // If image is "/uploads/file.jpg", turn it into "https://campusshareapp.com/uploads/file.jpg"
    let fullImageUrl = image;
    if (image && !image.startsWith("http")) {
        fullImageUrl = `${baseUrl}${image.startsWith("/") ? "" : "/"}${image}`;
    }

    try {
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        mode: "payment",
        line_items: [
          {
            price_data: {
              currency: "usd",
              product_data: {
                name: `Rental: ${title}`,
                // Send the FULL URL to Stripe
                images: fullImageUrl ? [fullImageUrl] : [],
              },
              unit_amount: totalAmount,
            },
            quantity: 1,
          },
        ],
        payment_intent_data: {
          application_fee_amount: platformFee,
          transfer_data: {
            destination: ownerStripeId,
          },
        },
        success_url: `${baseUrl}/dashboard?payment=success&rentalId=${rentalId}`,
        cancel_url: `${baseUrl}/dashboard?payment=cancelled`,
      });

      res.json({ url: session.url });
    } catch (error: any) {
      console.error("Stripe Checkout Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // ==========================================
  //  CORE APP ROUTES
  // ==========================================

  app.get("/api/balance", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send("Not logged in");
    const userId = (req.user as any).id;
    try {
      // Calculate earnings from completed rentals (simplified logic)
      const result = await pool.query(
        `SELECT r.*, i.price_per_day FROM rentals r JOIN items i ON r.item_id = i.id WHERE i.owner_id = $1`,
        [userId]
      );
      let totalEarned = 0;
      result.rows.forEach(r => totalEarned += r.price_per_day);
      
      // Calculate withdrawals
      const wResult = await pool.query(`SELECT SUM(amount) as total FROM withdrawals WHERE user_id = $1`, [userId]);
      const totalWithdrawn = parseInt(wResult.rows[0].total || '0');
      
      res.json({ totalEarned, totalWithdrawn, available: totalEarned - totalWithdrawn, history: [] });
    } catch (e) { res.status(500).json({ error: "Error" }); }
  });

  // Withdraw Request
  app.post("/api/withdraw", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send("Not logged in");
    // Just a placeholder since Stripe Connect handles auto payouts, 
    // but kept to prevent frontend crashing if called.
    res.sendStatus(200); 
  });

  // Verify Account
  app.post("/api/verify-account", async (req, res) => {
      if (!req.isAuthenticated()) return res.status(401).send("Not logged in");
      const { code } = req.body;
      const success = await storage.verifyUser((req.user as any).id, code);
      if (success) res.sendStatus(200);
      else res.status(400).json({ message: "Invalid verification code" });
  });

  app.post("/api/resend-verification", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send("Not logged in");
    const user = req.user as any;
    const newCode = Math.floor(100000 + Math.random() * 900000).toString();
    try {
      await pool.query(`UPDATE users SET verification_code = $1 WHERE id = $2`, [newCode, user.id]);
      await sendVerificationEmail(user.email, newCode);
      res.sendStatus(200);
    } catch (e) { res.status(500).json({ message: "Failed" }); }
  });

  app.post("/api/auth/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      res.sendStatus(200);
    });
  });
// --- RECOVERY ROUTES ---

  // 1. Forgot Username
  app.post("/api/auth/forgot-username", async (req, res) => {
    const { email } = req.body;
    // Find user (case insensitive email search)
    const result = await pool.query(`SELECT username FROM users WHERE LOWER(email) = LOWER($1)`, [email]);
    const user = result.rows[0];

    if (user) {
      // Send email (don't await, just let it send in background to be fast)
      sendUsernameRecoveryEmail(email, user.username);
    }
    
    // Always say "sent" for security (so hackers can't check which emails exist)
    res.json({ message: "If that email exists, we sent the username." });
  });

  // 2. Forgot Password - Request Code
  app.post("/api/auth/forgot-password", async (req, res) => {
    const { email } = req.body;
    const result = await pool.query(`SELECT id FROM users WHERE LOWER(email) = LOWER($1)`, [email]);
    const user = result.rows[0];

    if (user) {
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      // Store code in the database (reusing the verification_code column)
      await pool.query(`UPDATE users SET verification_code = $1 WHERE id = $2`, [code, user.id]);
      sendPasswordResetEmail(email, code);
    }

    res.json({ message: "If that email exists, we sent a reset code." });
  });

  // 3. Forgot Password - Confirm Reset
  app.post("/api/auth/reset-password", async (req, res) => {
    const { email, code, newPassword } = req.body;
    
    // Find user with matching email AND code
    const result = await pool.query(`SELECT id FROM users WHERE LOWER(email) = LOWER($1) AND verification_code = $2`, [email, code]);
    const user = result.rows[0];

    if (!user) {
      return res.status(400).json({ message: "Invalid code or email" });
    }

    // Hash new password
    const { scrypt, randomBytes } = await import("crypto");
    const { promisify } = await import("util");
    const scryptAsync = promisify(scrypt);
    const salt = randomBytes(16).toString("hex");
    const buf = (await scryptAsync(newPassword, salt, 64)) as Buffer;
    const hashedPassword = `${buf.toString("hex")}.${salt}`;

    // Update password and clear code
    await pool.query(`UPDATE users SET password = $1, verification_code = NULL WHERE id = $2`, [hashedPassword, user.id]);

    res.json({ message: "Password updated! You can now log in." });
  });
  // User Profile
  app.patch("/api/user", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send("Not logged in");
    const userId = (req.user as any).id;
    const { name, email, bio, location } = req.body; 
    try {
      const result = await pool.query(
        `UPDATE users SET name = COALESCE($1, name), email = COALESCE($2, email), bio = COALESCE($3, bio), location = COALESCE($4, location) WHERE id = $5 RETURNING *`,
        [name, email, bio, location, userId]
      );
      res.json(result.rows[0]);
    } catch (error) { res.status(500).json({ error: "Failed" }); }
  });

  // Change Password
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

  // Delete Account
  app.delete("/api/user", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send("Not logged in");
    const userId = (req.user as any).id;
    try {
      await storage.deleteUser(userId);
      req.logout((err) => { res.sendStatus(200); });
    } catch (error) { res.status(500).json({ error: "Failed" }); }
  });

  app.get("/api/earnings", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send("Not logged in");
    const userId = (req.user as any).id;
    try {
      const result = await pool.query(
        `SELECT r.*, i.title, i.price_per_day, u.username as renter_name
         FROM rentals r JOIN items i ON r.item_id = i.id JOIN users u ON r.renter_id = u.id
         WHERE i.owner_id = $1 ORDER BY r.start_date DESC`, [userId]
      );
      const rentals = result.rows.map(row => ({ ...row, total_earnings: row.price_per_day })); 
      res.json({ total: 0, history: rentals });
    } catch (error) { res.status(500).json({ error: "Failed" }); }
  });

  // --- ITEM ROUTES ---
  app.get(api.items.list.path, async (req, res) => {
    const search = req.query.search as string | undefined;
    const category = req.query.category as string | undefined;
    const user = req.isAuthenticated() ? (req.user as any) : undefined;
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

  // Update rental status (with optional price override)
  app.patch("/api/rentals/:id/status", async (req, res) => {
    const { status, totalPrice } = req.body; // <--- Get totalPrice from body
    const rentalId = parseInt(req.params.id);

    try {
      // If a custom price is provided (and valid), update the price AND the status.
      // Otherwise, just update the status.
      if (totalPrice !== undefined && !isNaN(totalPrice)) {
        await pool.query(
          `UPDATE rentals SET status = $1, total_price = $2 WHERE id = $3`,
          [status, totalPrice, rentalId]
        );
      } else {
        await pool.query(
          `UPDATE rentals SET status = $1 WHERE id = $2`,
          [status, rentalId]
        );
      }

      res.json({ message: "Rental status updated" });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // --- MESSAGING SYSTEM ROUTES ---
  // Update message offer status AND Auto-Approve Rental
  app.patch("/api/messages/:id/offer", async (req, res) => {
    const { offer_status } = req.body;
    const messageId = parseInt(req.params.id);

    try {
      // 1. Update the message status
      const result = await pool.query(
        `UPDATE messages SET offer_status = $1 WHERE id = $2 RETURNING *`,
        [offer_status, messageId]
      );
      const message = result.rows[0];

      // 2. IF ACCEPTED: Automatically approve the rental with the new price
      if (offer_status === 'accepted') {
        await pool.query(
            `UPDATE rentals 
             SET status = 'approved', total_price = $1 
             WHERE item_id = $2 
               AND renter_id = $3 
               AND start_date = $4 
               AND end_date = $5 
               AND status = 'pending'`,
            [
                message.offer_price, // Use the negotiated price
                message.item_id,
                message.sender_id,   // The person who sent the offer is the renter
                message.start_date,
                message.end_date
            ]
        );
      }

      res.json(message);
    } catch (error: any) {
      console.error("Error auto-accepting rental:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Accept Offer
  app.patch("/api/messages/:id/offer", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send("Not logged in");
    const msgId = Number(req.params.id);
    const { status } = req.body; 

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
      res.status(500).json({ error: "Failed to update offer" });
    }
  });

  app.get("/api/messages", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send("Not logged in");
    const myId = (req.user as any).id;
    try {
      const result = await pool.query(
        `SELECT m.*, u_sender.username as sender_name, u_receiver.username as receiver_name, i.title as item_title, i.image_url as item_image, i.price_per_day as item_original_price
         FROM messages m JOIN users u_sender ON m.sender_id = u_sender.id
         JOIN users u_receiver ON m.receiver_id = u_receiver.id
         LEFT JOIN items i ON m.item_id = i.id
         WHERE m.sender_id = $1 OR m.receiver_id = $1 ORDER BY m.sent_at DESC`, [myId]
      );
      res.json(result.rows);
    } catch (error) { res.status(500).json({ error: "Failed" }); }
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


  console.log("Database seeded successfully!");
}
