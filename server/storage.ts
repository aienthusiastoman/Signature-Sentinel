import { supabase } from "./supabase";
import type { MaskRegion, VerificationResult } from "@shared/schema";

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

export interface InsertUser {
  username: string;
  password: string;
}

export interface InsertTemplate {
  name: string;
  description?: string | null;
  maskRegions: MaskRegion[];
  dpi?: number | null;
  matchMode?: string;
  fileSlotCount?: number;
}

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByApiKey(apiKey: string): Promise<User | undefined>;
  createUser(user: InsertUser & { role?: string; apiKey?: string }): Promise<User>;
  getAllUsers(): Promise<User[]>;
  updateUserRole(id: string, role: string): Promise<User | undefined>;
  deleteUser(id: string): Promise<void>;

  getTemplates(userId: string): Promise<Template[]>;
  getTemplate(id: string): Promise<Template | undefined>;
  createTemplate(template: InsertTemplate & { userId: string }): Promise<Template>;
  updateTemplate(id: string, data: Partial<InsertTemplate>): Promise<Template | undefined>;
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
    fileNames?: Record<string, string>;
  }): Promise<Verification>;
}

function toUser(row: any): User {
  return {
    id: row.id,
    username: row.username,
    password: row.password,
    role: row.role,
    apiKey: row.api_key ?? null,
    createdAt: row.created_at ?? null,
  };
}

function toTemplate(row: any): Template {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? null,
    userId: row.user_id,
    maskRegions: row.mask_regions ?? [],
    sourcePageCount: row.source_page_count ?? null,
    fileSlotCount: row.file_slot_count ?? null,
    dpi: row.dpi ?? null,
    matchMode: row.match_mode ?? "relaxed",
    createdAt: row.created_at ?? null,
  };
}

function toVerification(row: any): Verification {
  return {
    id: row.id,
    templateId: row.template_id,
    userId: row.user_id,
    confidenceScore: row.confidence_score ?? null,
    results: row.results ?? null,
    fileNames: row.file_names ?? null,
    file1Name: row.file1_name ?? null,
    file2Name: row.file2_name ?? null,
    createdAt: row.created_at ?? null,
  };
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const { data, error } = await supabase.from("users").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    return data ? toUser(data) : undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const { data, error } = await supabase.from("users").select("*").eq("username", username).maybeSingle();
    if (error) throw error;
    return data ? toUser(data) : undefined;
  }

  async getUserByApiKey(apiKey: string): Promise<User | undefined> {
    const { data, error } = await supabase.from("users").select("*").eq("api_key", apiKey).maybeSingle();
    if (error) throw error;
    return data ? toUser(data) : undefined;
  }

  async createUser(insertUser: InsertUser & { role?: string; apiKey?: string }): Promise<User> {
    const { data, error } = await supabase.from("users").insert({
      username: insertUser.username,
      password: insertUser.password,
      role: insertUser.role || "user",
      api_key: insertUser.apiKey ?? null,
    }).select().single();
    if (error) throw error;
    return toUser(data);
  }

  async getAllUsers(): Promise<User[]> {
    const { data, error } = await supabase.from("users").select("*").order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map(toUser);
  }

  async updateUserRole(id: string, role: string): Promise<User | undefined> {
    const { data, error } = await supabase.from("users").update({ role }).eq("id", id).select().maybeSingle();
    if (error) throw error;
    return data ? toUser(data) : undefined;
  }

  async deleteUser(id: string): Promise<void> {
    const { error } = await supabase.from("users").delete().eq("id", id);
    if (error) throw error;
  }

  async getTemplates(userId: string): Promise<Template[]> {
    const { data, error } = await supabase.from("templates").select("*").eq("user_id", userId).order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map(toTemplate);
  }

  async getTemplate(id: string): Promise<Template | undefined> {
    const { data, error } = await supabase.from("templates").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    return data ? toTemplate(data) : undefined;
  }

  async createTemplate(data: InsertTemplate & { userId: string }): Promise<Template> {
    const fileSlotCount = Math.max(2, ...data.maskRegions.map(r => r.fileSlot));
    const { data: row, error } = await supabase.from("templates").insert({
      name: data.name,
      description: data.description ?? null,
      user_id: data.userId,
      mask_regions: data.maskRegions,
      file_slot_count: fileSlotCount,
      dpi: data.dpi ?? 200,
      match_mode: data.matchMode ?? "relaxed",
    }).select().single();
    if (error) throw error;
    return toTemplate(row);
  }

  async updateTemplate(id: string, data: Partial<InsertTemplate>): Promise<Template | undefined> {
    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.maskRegions !== undefined) {
      updateData.mask_regions = data.maskRegions;
      updateData.file_slot_count = Math.max(2, ...data.maskRegions.map(r => r.fileSlot));
    }
    if (data.dpi !== undefined) updateData.dpi = data.dpi;
    if (data.matchMode !== undefined) updateData.match_mode = data.matchMode;
    if (data.fileSlotCount !== undefined) updateData.file_slot_count = data.fileSlotCount;

    const { data: row, error } = await supabase.from("templates").update(updateData).eq("id", id).select().maybeSingle();
    if (error) throw error;
    return row ? toTemplate(row) : undefined;
  }

  async deleteTemplate(id: string): Promise<void> {
    const { error } = await supabase.from("templates").delete().eq("id", id);
    if (error) throw error;
  }

  async getVerifications(userId: string): Promise<Verification[]> {
    const { data, error } = await supabase.from("verifications").select("*").eq("user_id", userId).order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map(toVerification);
  }

  async getVerification(id: string): Promise<Verification | undefined> {
    const { data, error } = await supabase.from("verifications").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    return data ? toVerification(data) : undefined;
  }

  async createVerification(data: {
    templateId: string;
    userId: string;
    confidenceScore: number;
    results: VerificationResult;
    file1Name: string;
    file2Name: string;
    fileNames?: Record<string, string>;
  }): Promise<Verification> {
    const { data: row, error } = await supabase.from("verifications").insert({
      template_id: data.templateId,
      user_id: data.userId,
      confidence_score: data.confidenceScore,
      results: data.results,
      file1_name: data.file1Name,
      file2_name: data.file2Name,
      file_names: data.fileNames ?? null,
    }).select().single();
    if (error) throw error;
    return toVerification(row);
  }
}

export const storage = new DatabaseStorage();
