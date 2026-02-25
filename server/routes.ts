import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, requireAuth, requireAdmin } from "./auth";
import multer from "multer";
import { verifySignatures, renderPdfPage, getPdfPageCount } from "./signature-engine";
import { insertTemplateSchema } from "@shared/schema";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  setupAuth(app);

  app.get("/api/admin/users", requireAdmin, async (_req, res, next) => {
    try {
      const users = await storage.getAllUsers();
      const safeUsers = users.map(({ password, ...u }) => u);
      res.json(safeUsers);
    } catch (err) { next(err); }
  });

  app.patch("/api/admin/users/:id/role", requireAdmin, async (req, res, next) => {
    try {
      const { role } = req.body;
      if (!["admin", "user"].includes(role)) {
        return res.status(400).json({ message: "Invalid role" });
      }
      const user = await storage.updateUserRole(req.params.id, role);
      if (!user) return res.status(404).json({ message: "User not found" });
      const { password, ...safeUser } = user;
      res.json(safeUser);
    } catch (err) { next(err); }
  });

  app.delete("/api/admin/users/:id", requireAdmin, async (req, res, next) => {
    try {
      const currentUser = req.user as any;
      if (currentUser.id === req.params.id) {
        return res.status(400).json({ message: "Cannot delete yourself" });
      }
      await storage.deleteUser(req.params.id);
      res.json({ message: "User deleted" });
    } catch (err) { next(err); }
  });

  app.get("/api/templates", requireAuth, async (req, res, next) => {
    try {
      const user = req.user as any;
      const tmps = await storage.getTemplates(user.id);
      res.json(tmps);
    } catch (err) { next(err); }
  });

  app.get("/api/templates/:id", requireAuth, async (req, res, next) => {
    try {
      const user = req.user as any;
      const template = await storage.getTemplate(req.params.id);
      if (!template) return res.status(404).json({ message: "Template not found" });
      if (template.userId !== user.id && user.role !== "admin") {
        return res.status(403).json({ message: "Access denied" });
      }
      res.json(template);
    } catch (err) { next(err); }
  });

  app.post("/api/templates", requireAuth, async (req, res, next) => {
    try {
      const user = req.user as any;
      const parsed = insertTemplateSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid template data", errors: parsed.error.errors });
      }
      const template = await storage.createTemplate({ ...parsed.data, userId: user.id });
      res.status(201).json(template);
    } catch (err) { next(err); }
  });

  app.patch("/api/templates/:id", requireAuth, async (req, res, next) => {
    try {
      const user = req.user as any;
      const template = await storage.getTemplate(req.params.id);
      if (!template) return res.status(404).json({ message: "Template not found" });
      if (template.userId !== user.id && user.role !== "admin") {
        return res.status(403).json({ message: "Access denied" });
      }
      const updated = await storage.updateTemplate(req.params.id, req.body);
      res.json(updated);
    } catch (err) { next(err); }
  });

  app.delete("/api/templates/:id", requireAuth, async (req, res, next) => {
    try {
      const user = req.user as any;
      const template = await storage.getTemplate(req.params.id);
      if (!template) return res.status(404).json({ message: "Template not found" });
      if (template.userId !== user.id && user.role !== "admin") {
        return res.status(403).json({ message: "Access denied" });
      }
      await storage.deleteTemplate(req.params.id);
      res.json({ message: "Template deleted" });
    } catch (err) { next(err); }
  });

  app.post("/api/pdf/render", requireAuth, upload.single("file"), async (req, res, next) => {
    try {
      if (!req.file) return res.status(400).json({ message: "PDF file required" });
      const page = parseInt(req.body.page || "1");
      const imageBuffer = await renderPdfPage(req.file.buffer, page, 1200);
      res.set("Content-Type", "image/png");
      res.send(imageBuffer);
    } catch (err) { next(err); }
  });

  app.post("/api/pdf/page-count", requireAuth, upload.single("file"), async (req, res, next) => {
    try {
      if (!req.file) return res.status(400).json({ message: "PDF file required" });
      const count = await getPdfPageCount(req.file.buffer);
      res.json({ pageCount: count });
    } catch (err) { next(err); }
  });

  app.post("/api/verify", requireAuth, upload.any(), async (req, res, next) => {
    try {
      const user = req.user as any;
      const files = req.files as Express.Multer.File[];

      const templateId = req.body.templateId;
      if (!templateId) return res.status(400).json({ message: "Template ID required" });

      const template = await storage.getTemplate(templateId);
      if (!template) return res.status(404).json({ message: "Template not found" });
      if (template.userId !== user.id && user.role !== "admin") {
        return res.status(403).json({ message: "Access denied" });
      }

      const fileSlotCount = template.fileSlotCount || 2;
      const fileBuffers = new Map<number, Buffer>();
      const fileNames: Record<string, string> = {};

      for (let slot = 1; slot <= fileSlotCount; slot++) {
        const file = files.find(f => f.fieldname === `file${slot}`);
        if (!file) {
          return res.status(400).json({ message: `File for slot ${slot} (file${slot}) is required` });
        }
        fileBuffers.set(slot, file.buffer);
        fileNames[`slot${slot}`] = file.originalname;
      }

      const result = await verifySignatures(
        fileBuffers,
        template.maskRegions,
        template.matchMode,
        template.dpi || 200
      );

      const verification = await storage.createVerification({
        templateId,
        userId: user.id,
        confidenceScore: result.confidenceScore,
        results: result,
        file1Name: fileNames["slot1"] || "",
        file2Name: fileNames["slot2"] || "",
        fileNames,
      });

      res.json(verification);
    } catch (err) { next(err); }
  });

  app.get("/api/verifications", requireAuth, async (req, res, next) => {
    try {
      const user = req.user as any;
      const verifs = await storage.getVerifications(user.id);
      res.json(verifs);
    } catch (err) { next(err); }
  });

  app.get("/api/verifications/:id", requireAuth, async (req, res, next) => {
    try {
      const user = req.user as any;
      const verification = await storage.getVerification(req.params.id);
      if (!verification) return res.status(404).json({ message: "Verification not found" });
      if (verification.userId !== user.id && user.role !== "admin") {
        return res.status(403).json({ message: "Access denied" });
      }
      res.json(verification);
    } catch (err) { next(err); }
  });

  app.post("/api/v1/verify", upload.any(), async (req, res, next) => {
    try {
      const apiKey = req.headers["x-api-key"] as string;
      if (!apiKey) return res.status(401).json({ message: "API key required (X-API-Key header)" });

      const user = await storage.getUserByApiKey(apiKey);
      if (!user) return res.status(401).json({ message: "Invalid API key" });

      const files = req.files as Express.Multer.File[];

      const templateId = req.body.templateId;
      if (!templateId) return res.status(400).json({ message: "Template ID required" });

      const template = await storage.getTemplate(templateId);
      if (!template) return res.status(404).json({ message: "Template not found" });
      if (template.userId !== user.id) {
        return res.status(403).json({ message: "Access denied - template belongs to another user" });
      }

      const fileSlotCount = template.fileSlotCount || 2;
      const fileBuffers = new Map<number, Buffer>();
      const fileNames: Record<string, string> = {};

      for (let slot = 1; slot <= fileSlotCount; slot++) {
        const file = files.find(f => f.fieldname === `file${slot}`);
        if (!file) {
          return res.status(400).json({ message: `File for slot ${slot} (file${slot}) is required` });
        }
        fileBuffers.set(slot, file.buffer);
        fileNames[`slot${slot}`] = file.originalname;
      }

      const result = await verifySignatures(
        fileBuffers,
        template.maskRegions,
        template.matchMode,
        template.dpi || 200
      );

      const verification = await storage.createVerification({
        templateId,
        userId: user.id,
        confidenceScore: result.confidenceScore,
        results: result,
        file1Name: fileNames["slot1"] || "",
        file2Name: fileNames["slot2"] || "",
        fileNames,
      });

      res.json({
        verificationId: verification.id,
        confidenceScore: result.confidenceScore,
        matchMode: result.matchMode,
        bestMatch: result.bestMatch,
        comparisons: result.comparisons,
        signatureImages: result.signatureImages,
      });
    } catch (err) { next(err); }
  });

  return httpServer;
}
