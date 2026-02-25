import { type User, type InsertUser, type Template, type InsertTemplate, type Verification, type VerificationResult, users, templates, verifications } from "@shared/schema";
import { eq, desc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

export const db = drizzle(pool);

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser & { role?: string; apiKey?: string }): Promise<User>;
  getAllUsers(): Promise<User[]>;
  updateUserRole(id: string, role: string): Promise<User | undefined>;
  deleteUser(id: string): Promise<void>;
  getUserByApiKey(apiKey: string): Promise<User | undefined>;

  getTemplates(userId: string): Promise<Template[]>;
  getTemplate(id: string): Promise<Template | undefined>;
  createTemplate(template: InsertTemplate & { userId: string }): Promise<Template>;
  deleteTemplate(id: string): Promise<void>;

  getVerifications(userId: string): Promise<Verification[]>;
  getVerification(id: string): Promise<Verification | undefined>;
  createVerification(data: {
    templateId: string;
    userId: string;
    confidenceScore: number;
    results: VerificationResult;
    file1Name: string;
    file2Name: string;
  }): Promise<Verification>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(insertUser: InsertUser & { role?: string; apiKey?: string }): Promise<User> {
    const [user] = await db.insert(users).values({
      username: insertUser.username,
      password: insertUser.password,
      role: insertUser.role || "user",
      apiKey: insertUser.apiKey,
    }).returning();
    return user;
  }

  async getAllUsers(): Promise<User[]> {
    return db.select().from(users).orderBy(desc(users.createdAt));
  }

  async updateUserRole(id: string, role: string): Promise<User | undefined> {
    const [user] = await db.update(users).set({ role }).where(eq(users.id, id)).returning();
    return user;
  }

  async deleteUser(id: string): Promise<void> {
    await db.delete(users).where(eq(users.id, id));
  }

  async getUserByApiKey(apiKey: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.apiKey, apiKey));
    return user;
  }

  async getTemplates(userId: string): Promise<Template[]> {
    return db.select().from(templates).where(eq(templates.userId, userId)).orderBy(desc(templates.createdAt));
  }

  async getTemplate(id: string): Promise<Template | undefined> {
    const [template] = await db.select().from(templates).where(eq(templates.id, id));
    return template;
  }

  async createTemplate(data: InsertTemplate & { userId: string }): Promise<Template> {
    const [template] = await db.insert(templates).values({
      name: data.name,
      description: data.description,
      userId: data.userId,
      maskRegions: data.maskRegions,
      dpi: data.dpi || 200,
      matchMode: data.matchMode || "relaxed",
    }).returning();
    return template;
  }

  async deleteTemplate(id: string): Promise<void> {
    await db.delete(templates).where(eq(templates.id, id));
  }

  async getVerifications(userId: string): Promise<Verification[]> {
    return db.select().from(verifications).where(eq(verifications.userId, userId)).orderBy(desc(verifications.createdAt));
  }

  async getVerification(id: string): Promise<Verification | undefined> {
    const [verification] = await db.select().from(verifications).where(eq(verifications.id, id));
    return verification;
  }

  async createVerification(data: {
    templateId: string;
    userId: string;
    confidenceScore: number;
    results: VerificationResult;
    file1Name: string;
    file2Name: string;
  }): Promise<Verification> {
    const [verification] = await db.insert(verifications).values({
      templateId: data.templateId,
      userId: data.userId,
      confidenceScore: data.confidenceScore,
      results: data.results,
      file1Name: data.file1Name,
      file2Name: data.file2Name,
    }).returning();
    return verification;
  }
}

export const storage = new DatabaseStorage();
