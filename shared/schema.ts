import { z } from "zod";

export const maskRegionSchema = z.object({
  pageNumber: z.number(),
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
  label: z.string().optional(),
  fileSlot: z.number().min(1),
  canvasWidth: z.number().optional(),
  canvasHeight: z.number().optional(),
});

export type MaskRegion = z.infer<typeof maskRegionSchema>;

export const verificationResultSchema = z.object({
  confidenceScore: z.number(),
  matchMode: z.string(),
  bestMatch: z.object({
    file1Slot: z.number(),
    file2Slot: z.number(),
    file1Page: z.number(),
    file2Page: z.number(),
  }).optional(),
  comparisons: z.array(z.object({
    slot1: z.number(),
    slot2: z.number(),
    file1Page: z.number(),
    file2Page: z.number(),
    rawScore: z.number(),
    adjustedScore: z.number(),
  })),
  signatureImages: z.record(z.string(), z.string()).optional(),
});

export type VerificationResult = z.infer<typeof verificationResultSchema>;

export const insertTemplateSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  matchMode: z.enum(["relaxed", "strict", "vacation"]).optional(),
  dpi: z.number().optional().nullable(),
  maskRegions: z.array(maskRegionSchema),
  fileSlotCount: z.number().min(2).optional(),
});

export type InsertTemplateSchema = z.infer<typeof insertTemplateSchema>;

export interface User {
  id: string;
  username: string;
  password: string;
  role: string;
  apiKey: string | null;
  createdAt: string | null;
}

export interface Template {
  id: string;
  name: string;
  description: string | null;
  userId: string;
  maskRegions: MaskRegion[];
  sourcePageCount: number | null;
  fileSlotCount: number | null;
  dpi: number | null;
  matchMode: string;
  createdAt: string | null;
}

export interface Verification {
  id: string;
  templateId: string;
  userId: string;
  confidenceScore: number | null;
  results: VerificationResult | null;
  fileNames: Record<string, string> | null;
  file1Name: string | null;
  file2Name: string | null;
  createdAt: string | null;
}
