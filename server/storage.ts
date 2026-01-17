import { User, InsertUser, Item, InsertItem, Rental, InsertRental, users, items, rentals, favorites, messages } from "@shared/schema";
import session from "express-session";
import { db } from "./db";
import { eq, or, and, desc, like, inArray } from "drizzle-orm";
import connectPg from "connect-pg-simple";
import { pool } from "./db";

const PostgresSessionStore = connectPg(session);

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // --- NEW VERIFICATION METHOD ---
  verifyUser(userId: number, code: string): Promise<boolean>;

  // --- UPDATED GET ITEMS SIGNATURE (Requires User) ---
  getItems(user?: User, filters?: { search?: string, category?: string }): Promise<(Item & { ownerName: string })[]>;
  
  getItem(id: number): Promise<(Item & { ownerName: string }) | undefined>;
  getUserItems(userId: number): Promise<(Item & { ownerName: string })[]>;
  createItem(item: InsertItem): Promise<Item>;

  createRental(rental: InsertRental): Promise<Rental>;
  getRentalsForUser(userId: number): Promise<{ outgoing: (Rental & { item: Item })[], incoming: (Rental & { item: Item, renter: User })[] }>;
  updateRentalStatus(rentalId: number, status: string): Promise<Rental | undefined>;
  updateItem(itemId: number, item: Partial<InsertItem>): Promise<Item | undefined>;
  toggleFavorite(userId: number, itemId: number): Promise<boolean>;
  getFavorites(userId: number): Promise<(Item & { ownerName: string })[]>;
  
  // Messages
  createMessage(message: any): Promise<any>;
  getMessages(userId: number): Promise<any[]>;
  updateOfferStatus(msgId: number, status: string): Promise<any>;
  markMessagesRead(senderId: number, receiverId: number): Promise<void>;
  deleteConversation(userA: number, userB: number): Promise<void>;

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

  async createUser(insertUser: InsertUser): Promise<User> {
    // 1. DYNAMIC SCHOOL DETECTION
    // We assume the schema already validated it ends in .edu
    // We extract the domain (e.g., "purdue.edu" from "john@purdue.edu")
    const emailParts = insertUser.email.split('@');
    const domain = emailParts.length > 1 ? emailParts[1] : 'General Public';

    // 2. GENERATE VERIFICATION CODE (6 Digits)
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    // 3. LOG CODE TO CONSOLE (Simulation)
    console.log(`\n=== VERIFICATION SIMULATION ===`);
    console.log(`To: ${insertUser.email}`);
    console.log(`School Detected: ${domain}`);
    console.log(`Your Code: ${code}`);
    console.log(`===============================\n`);

    const [user] = await db.insert(users).values({
        ...insertUser,
        school: domain,        // Use the domain as the "Marketplace ID"
        verificationCode: code,
        isVerified: false      // User starts unverified
    }).returning();
    return user;
  }

  // --- NEW: VERIFY USER ---
  async verifyUser(userId: number, code: string): Promise<boolean> {
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    
    // Check if code matches
    if (!user || user.verificationCode !== code) return false;

    // Verify the user
    await db.update(users).set({ isVerified: true }).where(eq(users.id, userId));
    return true;
  }

  async getItems(user?: User, filters?: { search?: string, category?: string }): Promise<(Item & { ownerName: string })[]> {
    
    // --- GATEKEEPER LOGIC ---
    // 1. Must be Logged In
    // 2. Must be Verified
    // 3. Must have a School assigned
    if (!user || !user.isVerified || !user.school) {
        return []; // Return NOTHING if checks fail
    }

    // --- SILO LOGIC ---
    // Only show items owned by people in the SAME school
    const ownersAtMySchool = db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.school, user.school));

    let conditions = [
        eq(items.isAvailable, true),
        inArray(items.ownerId, ownersAtMySchool) // The Filter
    ];

    if (filters?.category && filters.category !== "All") {
      conditions.push(eq(items.category, filters.category));
    }

    if (filters?.search) {
      conditions.push(or(
        like(items.title, `%${filters.search}%`),
        like(items.description, `%${filters.search}%`)
      ));
    }

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
    .where(and(...conditions))
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
      renterId: ownerId, 
      startDate,
      endDate,
      status: "unavailable_block",
    }).returning();
    return block;
  }

  async deleteRental(id: number): Promise<void> {
    await db.delete(rentals).where(eq(rentals.id, id));
  }

  // --- MESSAGES IMPLEMENTATION ---
  async createMessage(message: any): Promise<any> {
    const [msg] = await db.insert(messages).values(message).returning();
    return msg;
  }

  async getMessages(userId: number): Promise<any[]> {
    return await db.select().from(messages).where(or(eq(messages.senderId, userId), eq(messages.receiverId, userId)));
  }

  async updateOfferStatus(msgId: number, status: string): Promise<any> {
     const [updated] = await db.update(messages).set({ offerStatus: status }).where(eq(messages.id, msgId)).returning();
     return updated;
  }

  async markMessagesRead(senderId: number, receiverId: number): Promise<void> {
    await db.update(messages)
        .set({ read: true })
        .where(and(eq(messages.senderId, senderId), eq(messages.receiverId, receiverId)));
  }

  async deleteConversation(userA: number, userB: number): Promise<void> {
      await db.delete(messages)
        .where(or(
            and(eq(messages.senderId, userA), eq(messages.receiverId, userB)),
            and(eq(messages.senderId, userB), eq(messages.receiverId, userA))
        ));
  }
}

export const storage = new DatabaseStorage();
