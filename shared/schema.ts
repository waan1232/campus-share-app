import { pgTable, text, serial, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  name: text("name"),
  email: text("email"),
  
  // Profile Columns
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
  pricePerDay: integer("price_per_day").notNull(),
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
  status: text("status").default("pending").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// --- FIX: USE CAMELCASE FOR DB COLUMNS TO MATCH YOUR EXISTING DATABASE ---
export const favorites = pgTable("favorites", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(), // Changed from user_id
  itemId: integer("itemId").notNull(), // Changed from item_id
});

export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  senderId: integer("sender_id").notNull(),
  receiverId: integer("receiver_id").notNull(),
  content: text("content").notNull(),
  rentalId: integer("rental_id"),
  itemId: integer("item_id"),
  
  offerPrice: integer("offer_price"),
  offerStatus: text("offer_status").default('none'),
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
  school: true,
});

// --- FIX: ALLOW EMPTY IMAGE URLS ---
export const insertItemSchema = createInsertSchema(items).pick({
  title: true,
  description: true,
  category: true,
  pricePerDay: true,
  imageUrl: true,
  condition: true,
  location: true,
}).extend({
  // Make imageUrl optional and allow empty strings to prevent the "pattern" error
  imageUrl: z.string().optional().or(z.literal('')), 
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
