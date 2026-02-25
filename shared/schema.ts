import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, jsonb, boolean, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").notNull().default("user"),
  apiKey: text("api_key"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const maskRegionSchema = z.object({
  pageNumber: z.number(),
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
  label: z.string().optional(),
});

export type MaskRegion = z.infer<typeof maskRegionSchema>;

export const templates = pgTable("templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  userId: varchar("user_id").notNull(),
  maskRegions: jsonb("mask_regions").notNull().$type<MaskRegion[]>(),
  sourcePageCount: integer("source_page_count").default(1),
  dpi: integer("dpi").default(200),
  matchMode: text("match_mode").notNull().default("relaxed"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const verificationResultSchema = z.object({
  confidenceScore: z.number(),
  matchMode: z.string(),
  bestMatch: z.object({
    file1Page: z.number(),
    file2Page: z.number(),
  }).optional(),
  comparisons: z.array(z.object({
    file1Page: z.number(),
    file2Page: z.number(),
    rawScore: z.number(),
    adjustedScore: z.number(),
  })),
  signature1Image: z.string().optional(),
  signature2Image: z.string().optional(),
});

export type VerificationResult = z.infer<typeof verificationResultSchema>;

export const verifications = pgTable("verifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  templateId: varchar("template_id").notNull(),
  userId: varchar("user_id").notNull(),
  confidenceScore: real("confidence_score"),
  results: jsonb("results").$type<VerificationResult>(),
  file1Name: text("file1_name"),
  file2Name: text("file2_name"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertTemplateSchema = createInsertSchema(templates).pick({
  name: true,
  description: true,
  matchMode: true,
  dpi: true,
}).extend({
  maskRegions: z.array(maskRegionSchema),
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type Template = typeof templates.$inferSelect;
export type InsertTemplate = z.infer<typeof insertTemplateSchema>;
export type Verification = typeof verifications.$inferSelect;
