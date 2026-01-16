import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { setupAuth } from "./auth";
import { z } from "zod";
import { pool } from "./db";
import { containsBannedWords } from "@shared/utils";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // Auth
  setupAuth(app);

  // --- AUTOMATIC DATABASE SCHEMA UPDATES ---
  // This runs on startup to ensure your database has all the new columns we added.
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
      
      -- Add Profile & Payment Columns if they are missing
      ALTER TABLE users ADD COLUMN IF NOT EXISTS venmo_handle TEXT;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS cashapp_tag TEXT;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS location TEXT;
    `);
    console.log("Database schema verified (Messages & Payment columns ready).");
  } catch (err) {
    console.error("Error updating schema:", err);
  }
  // -----------------------------------------


  // --- ACCOUNT MANAGEMENT ROUTES ---

  // 1. Update Profile (Name, Email, Payment Handles)
  app.patch("/api/user", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send("Not logged in");
    const userId = (req.user as any).id;
    // We accept all these fields now
    const { name, email, bio, location, venmo_handle, cashapp_tag } = req.body; 

    try {
      // COALESCE means "If the new value is null, keep the old value"
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
      console.error("Update error:", error);
      res.status(500).json({ error: "Failed to update profile" });
    }
  });

  // 2. Change Password
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

      await pool.query(
        `UPDATE users SET password = $1 WHERE id = $2`,
        [hashedPassword, userId]
      );
      res.sendStatus(200);
    } catch (error) {
      console.error("Password reset error:", error);
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
    if (item.ownerId !== (req.user as any).id) {
      return res.status(403).json({ message: "You don't have permission to edit this item" });
    }

    try {
      const updateData = api.items.update.input.parse(req.body);
      const updatedItem = await storage.updateItem(itemId, updateData);
      res.json(updatedItem);
    } catch (e) {
      res.status(400).json({ message: "Invalid input" });
    }
  });

  app.delete("/api/items/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    
    const itemId = Number(req.params.id);
    const item = await storage.getItem(itemId);
    
    if (!item) return res.status(404).json({ message: "Item not found" });
    if (item.ownerId !== (req.user as any).id) {
      return res.status(403).json({ message: "You don't have permission to delete this item" });
    }

    await storage.deleteItem(itemId);
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
      
      // Blacklist check
      if (containsBannedWords(itemData.title) || containsBannedWords(itemData.description)) {
        return res.status(400).json({ message: "Content contains prohibited words" });
      }

      const item = await storage.createItem({
        ...itemData,
        ownerId: (req.user as any).id,
      });
      res.status(201).json(item);
    } catch (e) {
      res.status(400).json({ message: "Invalid input" });
    }
  });


  // --- FAVORITE ROUTES ---

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
      const body = {
        ...req.body,
        startDate: new Date(req.body.startDate),
        endDate: new Date(req.body.endDate),
      };
      api.rentals.create.input.parse(body);

      const rental = await storage.createRental({
        itemId: body.itemId,
        startDate: body.startDate,
        endDate: body.endDate,
        renterId: (req.user as any).id,
      });
      res.status(201).json(rental);
    } catch (e) {
      console.error("Rental creation error:", e);
      res.status(400).json({ message: "Invalid input" });
    }
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
      if (!rental) return res.status(404).json({ message: "Rental not found" });
      res.json(rental);
    } catch (e) {
      res.status(400).json({ message: "Invalid input" });
    }
  });

  app.post("/api/items/:id/unavailable", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    
    const itemId = Number(req.params.id);
    const item = await storage.getItem(itemId);
    
    if (!item) return res.status(404).json({ message: "Item not found" });
    if (item.ownerId !== (req.user as any).id) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    try {
      const { startDate, endDate } = z.object({
        startDate: z.string().transform(s => new Date(s)),
        endDate: z.string().transform(s => new Date(s)),
      }).parse(req.body);

      const block = await storage.createUnavailabilityBlock(
        itemId, 
        (req.user as any).id, 
        startDate, 
        endDate
      );
      res.status(201).json(block);
    } catch (e) {
      res.status(400).json({ message: "Invalid input" });
    }
  });

  app.delete("/api/rentals/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    await storage.deleteRental(Number(req.params.id));
    res.sendStatus(204);
  });


  // --- MESSAGING SYSTEM ROUTES ---

  // 1. Send Message
  app.post("/api/messages", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send("Not logged in");
    
    const { receiverId, content, rentalId } = req.body;
    const senderId = (req.user as any).id;

    try {
      const result = await pool.query(
        `INSERT INTO messages (sender_id, receiver_id, content, rental_id) 
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [senderId, receiverId, content, rentalId || null]
      );
      res.json(result.rows[0]);
    } catch (error) {
      console.error("Message error:", error);
      res.status(500).json({ error: "Failed to send message" });
    }
  });

  // 2. Get Messages (Inbox)
  app.get("/api/messages", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send("Not logged in");
    const myId = (req.user as any).id;

    try {
      const result = await pool.query(
        `SELECT m.*, 
                u_sender.username as sender_name, 
                u_receiver.username as receiver_name
         FROM messages m
         JOIN users u_sender ON m.sender_id = u_sender.id
         JOIN users u_receiver ON m.receiver_id = u_receiver.id
         WHERE m.sender_id = $1 OR m.receiver_id = $1
         ORDER BY m.sent_at DESC`,
        [myId]
      );
      res.json(result.rows);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch messages" });
    }
  });

  // 3. Mark as Read
  app.post("/api/messages/mark-read", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send("Not logged in");
    const { senderId } = req.body;
    const myId = (req.user as any).id;

    try {
      await pool.query(
        `UPDATE messages SET read = TRUE WHERE sender_id = $1 AND receiver_id = $2`,
        [senderId, myId]
      );
      res.sendStatus(200);
    } catch (error) {
      res.status(500).json({ error: "Failed to mark read" });
    }
  });

  // 4. Delete Conversation
  app.delete("/api/messages/:otherUserId", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send("Not logged in");
    const otherId = Number(req.params.otherUserId);
    const myId = (req.user as any).id;

    try {
      await pool.query(
        `DELETE FROM messages 
         WHERE (sender_id = $1 AND receiver_id = $2) 
            OR (sender_id = $2 AND receiver_id = $1)`,
        [myId, otherId]
      );
      res.sendStatus(200);
    } catch (error) {
      res.status(500).json({ error: "Failed to delete conversation" });
    }
  });

  // Seed Data (Safe to run every time)
  try {
    await seedDatabase();
  } catch (e) {
    console.error("Seeding failed, but continuing:", e);
  }

  return httpServer;
}

// Helper function
async function seedDatabase() {
  const existingItems = await storage.getItems();
  if (existingItems.length > 0) return;

  const existingUser = await storage.getUserByUsername("campus_admin");
  let user = existingUser;

  if (!user) {
    console.log("Seeding database...");
    
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
      email: "admin@college.edu"
    });
  }

  const itemsToSeed = [
    {
      title: "TI-84 Plus CE Calculator",
      description: "Color graphing calculator, perfect for Calculus/Stats. Includes charging cable.",
      category: "Textbooks",
      pricePerDay: 500, // $5.00
      imageUrl: "https://images.unsplash.com/photo-1596200923062-8e7c1c633a16?w=800&q=80",
      ownerId: user.id
    },
    {
      title: "JBL Flip 5 Speaker",
      description: "Waterproof portable bluetooth speaker. Great sound for dorm parties.",
      category: "Party",
      pricePerDay: 1000, // $10.00
      imageUrl: "https://images.unsplash.com/photo-1612444530582-fc66183b16f7?w=800&q=80",
      ownerId: user.id
    },
    {
      title: "Spikeball Pro Set",
      description: "Complete set with 3 balls and carrying bag. Good condition.",
      category: "Sports",
      pricePerDay: 800, // $8.00
      imageUrl: "https://images.unsplash.com/photo-1541534741688-6078c6bfb5c5?w=800&q=80",
      ownerId: user.id
    },
    {
      title: "Men's Formal Suit (M)",
      description: "Navy blue suit, size 40R. Perfect for presentations or formal events.",
      category: "Other",
      pricePerDay: 2500, // $25.00
      imageUrl: "https://images.unsplash.com/photo-1594938298603-c8148c47e356?w=800&q=80",
      ownerId: user.id
    },
    {
      title: "Canon EOS Rebel T7",
      description: "DSLR camera with 18-55mm lens. Great for photography class projects.",
      category: "Electronics",
      pricePerDay: 3500, // $35.00
      imageUrl: "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=800&q=80",
      ownerId: user.id
    }
  ];

  for (const item of itemsToSeed) {
    await storage.createItem(item);
  }
  
  console.log("Database seeded successfully!");
}
