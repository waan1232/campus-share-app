import { User, InsertUser, Item, InsertItem, Rental, InsertRental, users, items, rentals, favorites } from "@shared/schema";
import session from "express-session";
import { db } from "./db";
import { eq, or, and, desc, like, inArray } from "drizzle-orm"; // Added inArray
import connectPg from "connect-pg-simple";
import { pool } from "./db";

const PostgresSessionStore = connectPg(session);

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser & { school?: string }): Promise<User>; // Updated type

  // Updated getItems signature to accept school filter
  getItems(filters?: { search?: string, category?: string, school?: string }): Promise<(Item & { ownerName: string })[]>;
  
  getItem(id: number): Promise<(Item & { ownerName: string }) | undefined>;
  getUserItems(userId: number): Promise<(Item & { ownerName: string })[]>;
  createItem(item: InsertItem): Promise<Item>;

  createRental(rental: InsertRental): Promise<Rental>;
  getRentalsForUser(userId: number): Promise<{ outgoing: (Rental & { item: Item })[], incoming: (Rental & { item: Item, renter: User })[] }>;
  updateRentalStatus(rentalId: number, status: string): Promise<Rental | undefined>;
  updateItem(itemId: number, item: Partial<InsertItem>): Promise<Item | undefined>;
  toggleFavorite(userId: number, itemId: number): Promise<boolean>;
  getFavorites(userId: number): Promise<(Item & { ownerName: string })[]>;
  createUnavailabilityBlock(itemId: number, ownerId: number, startDate: Date, endDate: Date): Promise<Rental>;
  deleteRental(id: number): Promise<void>;
  deleteItem(id: number): Promise<void>;

  sessionStore: session.Store;
}

export class DatabaseStorage implements IStorage {
  sessionStore: session.Store;

  constructor() {
    this.sessionStore = new PostgresSessionStore({
      pool,
      createTableIfMissing: true,
    });
  }

  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(insertUser: InsertUser & { school?: string }): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async getItems(filters?: { search?: string, category?: string, school?: string }): Promise<(Item & { ownerName: string })[]> {
    let conditions = [eq(items.isAvailable, true)]; // Default condition

    // 1. Category Filter
    if (filters?.category && filters.category !== "All") {
      conditions.push(eq(items.category, filters.category));
    }

    // 2. Search Filter
    if (filters?.search) {
      conditions.push(or(
        like(items.title, `%${filters.search}%`),
        like(items.description, `%${filters.search}%`)
      ));
    }

    // 3. School Filter (The new Logic)
    if (filters?.school) {
        // Find all users who belong to this school
        const ownersAtSchool = db
            .select({ id: users.id })
            .from(users)
            .where(eq(users.school, filters.school));
        
        // Only show items owned by those users
        conditions.push(inArray(items.ownerId, ownersAtSchool));
    }

    // Build Query
    const results = await db.select({
      id: items.id,
      ownerId: items.ownerId,
      title: items.title,
      description: items.description,
      category: items.category,
      pricePerDay: items.pricePerDay,
      imageUrl: items.imageUrl,
      isAvailable: items.isAvailable,
      condition: items.condition,
      location: items.location,
      createdAt: items.createdAt,
      ownerName: users.name
    })
    .from(items)
    .innerJoin(users, eq(items.ownerId, users.id))
    .where(and(...conditions)) // Apply all conditions
    .orderBy(desc(items.createdAt));

    return results.map(r => ({
      ...r,
      ownerName: r.ownerName as string
    }));
  }

  async getItem(id: number): Promise<(Item & { ownerName: string }) | undefined> {
    const [item] = await db.select({
      id: items.id,
      ownerId: items.ownerId,
      title: items.title,
      description: items.description,
      category: items.category,
      pricePerDay: items.pricePerDay,
      imageUrl: items.imageUrl,
      isAvailable: items.isAvailable,
      condition: items.condition,
      location: items.location,
      createdAt: items.createdAt,
      ownerName: users.name
    })
    .from(items)
    .innerJoin(users, eq(items.ownerId, users.id))
    .where(eq(items.id, id));
    
    if (!item) return undefined;
    return {
      ...item,
      ownerName: item.ownerName as string
    };
  }

  async createItem(item: InsertItem): Promise<Item> {
    const [newItem] = await db.insert(items).values(item).returning();
    return newItem;
  }

  async getUserItems(userId: number): Promise<(Item & { ownerName: string })[]> {
    const results = await db.select({
      id: items.id,
      ownerId: items.ownerId,
      title: items.title,
      description: items.description,
      category: items.category,
      pricePerDay: items.pricePerDay,
      imageUrl: items.imageUrl,
      isAvailable: items.isAvailable,
      condition: items.condition,
      location: items.location,
      createdAt: items.createdAt,
      ownerName: users.name
    })
    .from(items)
    .innerJoin(users, eq(items.ownerId, users.id))
    .where(eq(items.ownerId, userId));

    return results.map(r => ({
      ...r,
      ownerName: r.ownerName as string
    }));
  }

  async updateItem(itemId: number, item: Partial<InsertItem>): Promise<Item | undefined> {
    const [updatedItem] = await db.update(items)
      .set(item)
      .where(eq(items.id, itemId))
      .returning();
    return updatedItem;
  }

  async deleteItem(itemId: number): Promise<void> {
    await db.delete(items).where(eq(items.id, itemId));
  }

  async toggleFavorite(userId: number, itemId: number): Promise<boolean> {
    const [existing] = await db.select().from(favorites).where(and(eq(favorites.userId, userId), eq(favorites.itemId, itemId)));
    if (existing) {
      await db.delete(favorites).where(eq(favorites.id, existing.id));
      return false;
    } else {
      await db.insert(favorites).values({ userId, itemId });
      return true;
    }
  }

  async getFavorites(userId: number): Promise<(Item & { ownerName: string })[]> {
    const results = await db.select({
      id: items.id,
      ownerId: items.ownerId,
      title: items.title,
      description: items.description,
      category: items.category,
      pricePerDay: items.pricePerDay,
      imageUrl: items.imageUrl,
      isAvailable: items.isAvailable,
      condition: items.condition,
      location: items.location,
      createdAt: items.createdAt,
      ownerName: users.name
    })
    .from(favorites)
    .innerJoin(items, eq(favorites.itemId, items.id))
    .innerJoin(users, eq(items.ownerId, users.id))
    .where(eq(favorites.userId, userId));

    return results.map(r => ({
      ...r,
      ownerName: r.ownerName as string
    }));
  }

  async createRental(rental: InsertRental): Promise<Rental> {
    const [newRental] = await db.insert(rentals).values(rental).returning();
    return newRental;
  }

  async getRentalsForUser(userId: number): Promise<{ outgoing: (Rental & { item: Item })[], incoming: (Rental & { item: Item, renter: User })[] }> {
    // Items I requested to rent (outgoing)
    const outgoingResults = await db.select({
      id: rentals.id,
      itemId: rentals.itemId,
      renterId: rentals.renterId,
      startDate: rentals.startDate,
      endDate: rentals.endDate,
      status: rentals.status,
      createdAt: rentals.createdAt,
      item: items
    })
    .from(rentals)
    .innerJoin(items, eq(rentals.itemId, items.id))
    .where(eq(rentals.renterId, userId));

    // Items I own that others requested (incoming)
    const incomingResults = await db.select({
      id: rentals.id,
      itemId: rentals.itemId,
      renterId: rentals.renterId,
      startDate: rentals.startDate,
      endDate: rentals.endDate,
      status: rentals.status,
      createdAt: rentals.createdAt,
      item: items,
      renter: users
    })
    .from(rentals)
    .innerJoin(items, eq(rentals.itemId, items.id))
    .innerJoin(users, eq(rentals.renterId, users.id))
    .where(eq(items.ownerId, userId));

    return { 
      outgoing: outgoingResults as (Rental & { item: Item })[], 
      incoming: incomingResults as (Rental & { item: Item, renter: User })[] 
    };
  }

  async updateRentalStatus(rentalId: number, status: string): Promise<Rental | undefined> {
    const [updated] = await db.update(rentals)
      .set({ status })
      .where(eq(rentals.id, rentalId))
      .returning();
    return updated;
  }

  async createUnavailabilityBlock(itemId: number, ownerId: number, startDate: Date, endDate: Date): Promise<Rental> {
    const [block] = await db.insert(rentals).values({
      itemId,
      renterId: ownerId, // Owner is the "renter" for a block
      startDate,
      endDate,
      status: "unavailable_block",
    }).returning();
    return block;
  }

  async deleteRental(id: number): Promise<void> {
    await db.delete(rentals).where(eq(rentals.id, id));
  }
}

export const storage = new DatabaseStorage();
