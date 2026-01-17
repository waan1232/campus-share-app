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
      
      -- Add Profile, Payment & NEW OFFER Columns
      ALTER TABLE users ADD COLUMN IF NOT EXISTS venmo_handle TEXT;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS cashapp_tag TEXT;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS location TEXT;

      -- New Columns for Bargaining
      ALTER TABLE messages ADD COLUMN IF NOT EXISTS item_id INTEGER REFERENCES items(id);
      ALTER TABLE messages ADD COLUMN IF NOT EXISTS offer_price INTEGER; -- Price in cents
      ALTER TABLE messages ADD COLUMN IF NOT EXISTS offer_status TEXT DEFAULT 'none'; -- 'pending', 'accepted', 'rejected'
      ALTER TABLE messages ADD COLUMN IF NOT EXISTS start_date TIMESTAMP; -- NEW
      ALTER TABLE messages ADD COLUMN IF NOT EXISTS end_date TIMESTAMP;   -- NEW
    `);
    console.log("Database schema verified (Offers & Dates enabled).");
  } catch (err) {
    console.error("Error updating schema:", err);
  }

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
         RETURNING id, username, name, email, bio, location, venmo_handle, cashapp_tag`,
        [name, email, bio, location, venmo_handle, cashapp_tag, userId]
      );
      res.json(result.rows[0]);
    } catch (error) {
      res.status(500).json({ error: "Failed to update profile" });
    }
  });

  // --- EARNINGS ROUTE ---
  app.get("/api/earnings", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send("Not logged in");
    const userId = (req.user as any).id;

    try {
      // Find all rentals for items OWNED by this user
      // We join Rentals -> Items to check ownership
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

      // Calculate totals in JavaScript for simplicity
      const rentals = result.rows.map(row => {
        const days = Math.ceil((new Date(row.end_date).getTime() - new Date(row.start_date).getTime()) / (1000 * 60 * 60 * 24));
        const total = (row.price_per_day * days); // in cents
        return { ...row, total_earnings: total, days };
      });

      const totalLifetime = rentals.reduce((acc, curr) => acc + curr.total_earnings, 0);

      res.json({ total: totalLifetime, history: rentals });
    } catch (error) {
      console.error("Earnings error:", error);
      res.status(500).json({ error: "Failed to fetch earnings" });
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

  // --- ITEM ROUTES ---
  app.get(api.items.list.path, async (req, res) => {
    const search = req.query.search as string | undefined;
    const category = req.query.category as string | undefined;
    const items = await storage.getItems({ search, category });
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

  // 1. Send Message (with optional Offer & Dates)
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

  // 2. Respond to Offer (Accept/Reject + CREATE RENTAL)
  app.patch("/api/messages/:id/offer", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send("Not logged in");
    const msgId = Number(req.params.id);
    const { status } = req.body; // 'accepted' or 'rejected'

    try {
      // 1. Update the message status
      const msgResult = await pool.query(
        `UPDATE messages SET offer_status = $1 WHERE id = $2 RETURNING *`,
        [status, msgId]
      );
      const message = msgResult.rows[0];

      // 2. IF ACCEPTED: Create the actual Rental Record
      if (status === 'accepted' && message.item_id && message.start_date && message.end_date) {
        // Find the "sender" of the message - they are the Renter
        // (If I accepted the offer, the person who sent me the offer is the one renting it)
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

  // 3. Get Messages (Updated to fetch Item details)
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

  // 4. Mark Read & Delete
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
    user = await storage.createUser({ username: "campus_admin", password: pwd, name: "Admin User", email: "admin@college.edu" });
  }

  const itemsToSeed = [
    { title: "TI-84 Plus CE Calculator", description: "Color graphing calculator.", category: "Textbooks", pricePerDay: 500, imageUrl: "https://images.unsplash.com/photo-1596200923062-8e7c1c633a16", ownerId: user.id },
    { title: "JBL Flip 5 Speaker", description: "Waterproof portable speaker.", category: "Party", pricePerDay: 1000, imageUrl: "https://images.unsplash.com/photo-1612444530582-fc66183b16f7", ownerId: user.id },
  ];
  for (const item of itemsToSeed) await storage.createItem(item);
  console.log("Database seeded successfully!");
}
