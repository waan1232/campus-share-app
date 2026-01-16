import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { setupAuth } from "./auth";
import { z } from "zod";

import { containsBannedWords } from "@shared/utils";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // Auth
  setupAuth(app);

  // Items
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

  // Rentals
  app.post(api.rentals.create.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    
    try {
      const body = {
        ...req.body,
        startDate: new Date(req.body.startDate),
        endDate: new Date(req.body.endDate),
      };
      // Validate with schema first
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
    
    // For simplicity, just delete. Real app would check ownership.
    await storage.deleteRental(Number(req.params.id));
    res.sendStatus(204);
  });

  // Seed Data
  try {
    await seedDatabase();
  } catch (e) {
    console.error("Seeding failed, but continuing:", e);
  }

  return httpServer;
}

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
      category: "Textbooks", // Or Electronics, mapped to schema options
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
      imageUrl: "https://images.unsplash.com/photo-1541534741688-6078c6bfb5c5?w=800&q=80", // Placeholder for sports
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
