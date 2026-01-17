import { pgTable, text, serial, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  name: text("name"),
  email: text("email"),
  
  // --- NEW COLUMNS ---
  school: text("school").default('General Public'),
  bio: text("bio"),
  location: text("location"),
  venmo_handle: text("venmo_handle"),
  cashapp_tag: text("cashapp_tag"),
});

export const items = pgTable("items", {
  id: serial("id").primaryKey(),
  ownerId: integer("owner_id").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  category: text("category").notNull(),
  pricePerDay: integer("price_per_day").notNull(), // stored in cents
  imageUrl: text("image_url"),
  isAvailable: boolean("is_available").default(true).notNull(),
  condition: text("condition").default("Good"),
  location: text("location"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const rentals = pgTable("rentals", {
  id: serial("id").primaryKey(),
  itemId: integer("item_id").notNull(),
  renterId: integer("renter_id").notNull(),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  status: text("status").default("pending").notNull(), // pending, approved, rejected, completed, unavailable_block
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const favorites = pgTable("favorites", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  itemId: integer("item_id").notNull(),
});

// --- NEW MESSAGES TABLE ---
export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  senderId: integer("sender_id").notNull(),
  receiverId: integer("receiver_id").notNull(),
  content: text("content").notNull(),
  rentalId: integer("rental_id"), // Optional: link to a specific rental
  itemId: integer("item_id"),     // Optional: link to a specific item context
  
  // Offer / Bargaining Columns
  offerPrice: integer("offer_price"), // If they make a cash offer
  offerStatus: text("offer_status").default('none'), // pending, accepted, rejected
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),

  sentAt: timestamp("sent_at").defaultNow(),
  read: boolean("read").default(false),
});

// --- ZOD SCHEMAS ---
export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  name: true,
  email: true,
  school: true, // Allow school to be inserted
});

export const insertItemSchema = createInsertSchema(items).pick({
  title: true,
  description: true,
  category: true,
  pricePerDay: true,
  imageUrl: true,
  condition: true,
  location: true,
});

export const insertRentalSchema = createInsertSchema(rentals).pick({
  itemId: true,
  startDate: true,
  endDate: true,
});

export const insertMessageSchema = createInsertSchema(messages).pick({
  receiverId: true,
  content: true,
  rentalId: true,
  itemId: true,
  offerPrice: true,
  startDate: true,
  endDate: true,
});

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Item = typeof items.$inferSelect;
export type InsertItem = z.infer<typeof insertItemSchema>;
export type Rental = typeof rentals.$inferSelect;
export type InsertRental = z.infer<typeof insertRentalSchema>;
export type Message = typeof messages.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;
