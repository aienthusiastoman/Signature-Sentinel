import sharp from "sharp";
import type { MaskRegion } from "@shared/schema";
import { execFile } from "child_process";
import { promisify } from "util";
import { writeFile, readFile, mkdtemp, rm } from "fs/promises";
import path from "path";
import os from "os";

const execFileAsync = promisify(execFile);

interface SignatureCandidate {
  slot: number;
  pageNumber: number;
  pixels: Uint8Array;
  width: number;
  height: number;
}

interface ComparisonResult {
  slot1: number;
  slot2: number;
  file1Page: number;
  file2Page: number;
  rawScore: number;
  adjustedScore: number;
}

export interface VerificationOutput {
  confidenceScore: number;
  matchMode: string;
  bestMatch?: { file1Slot: number; file2Slot: number; file1Page: number; file2Page: number };
  comparisons: ComparisonResult[];
  signatureImages?: Record<string, string>;
}

async function pdfToImages(pdfBuffer: Buffer, dpi: number = 200): Promise<{ data: Uint8Array; width: number; height: number; page: number }[]> {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "sigverify-"));
  const pdfPath = path.join(tmpDir, "input.pdf");
  const outputPrefix = path.join(tmpDir, "page");

  try {
    await writeFile(pdfPath, pdfBuffer);

    await execFileAsync("pdftoppm", [
      "-png",
      "-r", dpi.toString(),
      pdfPath,
      outputPrefix,
    ]);

    const { stdout } = await execFileAsync("pdfinfo", [pdfPath]);
    const pagesMatch = stdout.match(/Pages:\s+(\d+)/);
    const pageCount = pagesMatch ? parseInt(pagesMatch[1]) : 1;

    const results: { data: Uint8Array; width: number; height: number; page: number }[] = [];

    for (let i = 1; i <= pageCount; i++) {
      const pageSuffix = pageCount > 9 ? String(i).padStart(String(pageCount).length, "0") : String(i);
      const imgPath = path.join(tmpDir, `page-${pageSuffix}.png`);

      try {
        const imgBuffer = await readFile(imgPath);
        const metadata = await sharp(imgBuffer).metadata();
        const { data, info } = await sharp(imgBuffer)
          .grayscale()
          .raw()
          .toBuffer({ resolveWithObject: true });

        results.push({
          data: new Uint8Array(data),
          width: info.width,
          height: info.height,
          page: i,
        });
      } catch {
        // page image not found, skip
      }
    }

    return results;
  } finally {
    await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}

export async function getPdfPageCount(pdfBuffer: Buffer): Promise<number> {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "sigverify-"));
  const pdfPath = path.join(tmpDir, "input.pdf");

  try {
    await writeFile(pdfPath, pdfBuffer);
    const { stdout } = await execFileAsync("pdfinfo", [pdfPath]);
    const pagesMatch = stdout.match(/Pages:\s+(\d+)/);
    return pagesMatch ? parseInt(pagesMatch[1]) : 1;
  } finally {
    await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}

export async function renderPdfPage(pdfBuffer: Buffer, pageNumber: number, maxWidth: number = 800): Promise<Buffer> {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "sigverify-"));
  const pdfPath = path.join(tmpDir, "input.pdf");
  const outputPrefix = path.join(tmpDir, "page");

  try {
    await writeFile(pdfPath, pdfBuffer);

    await execFileAsync("pdftoppm", [
      "-png",
      "-r", "150",
      "-f", pageNumber.toString(),
      "-l", pageNumber.toString(),
      pdfPath,
      outputPrefix,
    ]);

    const { stdout } = await execFileAsync("pdfinfo", [pdfPath]);
    const pagesMatch = stdout.match(/Pages:\s+(\d+)/);
    const pageCount = pagesMatch ? parseInt(pagesMatch[1]) : 1;
    const pageSuffix = pageCount > 9 ? String(pageNumber).padStart(String(pageCount).length, "0") : String(pageNumber);
    const imgPath = path.join(tmpDir, `page-${pageSuffix}.png`);

    const imgBuffer = await readFile(imgPath);

    const resized = await sharp(imgBuffer)
      .resize({ width: maxWidth, withoutEnlargement: true })
      .png()
      .toBuffer();

    return resized;
  } finally {
    await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}

function cropRegion(data: Uint8Array, imgWidth: number, imgHeight: number, region: MaskRegion): { data: Uint8Array; width: number; height: number } {
  const x = Math.max(0, Math.floor(region.x));
  const y = Math.max(0, Math.floor(region.y));
  const w = Math.min(Math.floor(region.width), imgWidth - x);
  const h = Math.min(Math.floor(region.height), imgHeight - y);

  if (w <= 0 || h <= 0) return { data: new Uint8Array(0), width: 0, height: 0 };

  const cropped = new Uint8Array(w * h);
  for (let row = 0; row < h; row++) {
    for (let col = 0; col < w; col++) {
      cropped[row * w + col] = data[(y + row) * imgWidth + (x + col)];
    }
  }
  return { data: cropped, width: w, height: h };
}

function adaptiveThreshold(data: Uint8Array, width: number, height: number, blockSize: number = 31, C: number = 15): Uint8Array {
  const result = new Uint8Array(width * height);
  const halfBlock = Math.floor(blockSize / 2);

  const integral = new Float64Array((width + 1) * (height + 1));
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      integral[(y + 1) * (width + 1) + (x + 1)] =
        data[y * width + x] +
        integral[y * (width + 1) + (x + 1)] +
        integral[(y + 1) * (width + 1) + x] -
        integral[y * (width + 1) + x];
    }
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const x1 = Math.max(0, x - halfBlock);
      const y1 = Math.max(0, y - halfBlock);
      const x2 = Math.min(width - 1, x + halfBlock);
      const y2 = Math.min(height - 1, y + halfBlock);

      const count = (x2 - x1 + 1) * (y2 - y1 + 1);
      const sum = integral[(y2 + 1) * (width + 1) + (x2 + 1)]
        - integral[y1 * (width + 1) + (x2 + 1)]
        - integral[(y2 + 1) * (width + 1) + x1]
        + integral[y1 * (width + 1) + x1];

      const mean = sum / count;
      result[y * width + x] = data[y * width + x] < (mean - C) ? 255 : 0;
    }
  }
  return result;
}

function removeLines(data: Uint8Array, width: number, height: number): Uint8Array {
  const result = new Uint8Array(data);

  for (let y = 0; y < height; y++) {
    let runStart = -1;
    for (let x = 0; x <= width; x++) {
      const val = x < width ? data[y * width + x] : 0;
      if (val > 0 && runStart < 0) runStart = x;
      if (val === 0 && runStart >= 0) {
        if (x - runStart > 80) {
          for (let rx = runStart; rx < x; rx++) result[y * width + rx] = 0;
        }
        runStart = -1;
      }
    }
  }

  for (let x = 0; x < width; x++) {
    let runStart = -1;
    for (let y = 0; y <= height; y++) {
      const val = y < height ? result[y * width + x] : 0;
      if (val > 0 && runStart < 0) runStart = y;
      if (val === 0 && runStart >= 0) {
        if (y - runStart > 80) {
          for (let ry = runStart; ry < y; ry++) result[ry * width + x] = 0;
        }
        runStart = -1;
      }
    }
  }

  return result;
}

function findLargestComponent(data: Uint8Array, width: number, height: number): Uint8Array | null {
  const labels = new Int32Array(width * height);
  let nextLabel = 1;
  const areas = new Map<number, number>();

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[y * width + x] > 0 && labels[y * width + x] === 0) {
        const label = nextLabel++;
        let area = 0;
        const stack = [[x, y]];

        while (stack.length > 0) {
          const [cx, cy] = stack.pop()!;
          if (cx < 0 || cx >= width || cy < 0 || cy >= height) continue;
          if (data[cy * width + cx] === 0 || labels[cy * width + cx] !== 0) continue;

          labels[cy * width + cx] = label;
          area++;

          stack.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
        }
        areas.set(label, area);
      }
    }
  }

  if (areas.size === 0) return null;

  let maxLabel = 0;
  let maxArea = 0;
  for (const [label, area] of areas) {
    if (area > maxArea) {
      maxArea = area;
      maxLabel = label;
    }
  }

  if (maxArea < 200) return null;

  const result = new Uint8Array(width * height);
  for (let i = 0; i < width * height; i++) {
    result[i] = labels[i] === maxLabel ? 255 : 0;
  }
  return result;
}

function extractSignatureStrokes(data: Uint8Array, width: number, height: number): Uint8Array | null {
  if (!data || data.length === 0) return null;

  const thresh = adaptiveThreshold(data, width, height);
  const cleaned = removeLines(thresh, width, height);
  return findLargestComponent(cleaned, width, height);
}

function normalizeSignature(data: Uint8Array, width: number, height: number, targetHeight: number = 250, targetWidth: number = 600): { data: Uint8Array; width: number; height: number } | null {
  let minX = width, minY = height, maxX = 0, maxY = 0;
  let found = false;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[y * width + x] > 0) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
        found = true;
      }
    }
  }

  if (!found) return null;

  const cropW = maxX - minX + 1;
  const cropH = maxY - minY + 1;

  const cropped = new Uint8Array(cropW * cropH);
  for (let y = 0; y < cropH; y++) {
    for (let x = 0; x < cropW; x++) {
      cropped[y * cropW + x] = data[(minY + y) * width + (minX + x)];
    }
  }

  const scale = Math.min(targetHeight / cropH, targetWidth / cropW);
  const newW = Math.max(1, Math.floor(cropW * scale));
  const newH = Math.max(1, Math.floor(cropH * scale));

  const resized = new Uint8Array(newW * newH);
  for (let y = 0; y < newH; y++) {
    for (let x = 0; x < newW; x++) {
      const srcX = Math.min(Math.floor(x / scale), cropW - 1);
      const srcY = Math.min(Math.floor(y / scale), cropH - 1);
      resized[y * newW + x] = cropped[srcY * cropW + srcX];
    }
  }

  const canvas = new Uint8Array(targetWidth * targetHeight);
  const yOff = Math.floor((targetHeight - newH) / 2);
  const xOff = Math.floor((targetWidth - newW) / 2);

  for (let y = 0; y < newH; y++) {
    for (let x = 0; x < newW; x++) {
      canvas[(yOff + y) * targetWidth + (xOff + x)] = resized[y * newW + x];
    }
  }

  return { data: canvas, width: targetWidth, height: targetHeight };
}

function skeletonize(data: Uint8Array, width: number, height: number): Uint8Array {
  const result = new Uint8Array(data);

  const getPixel = (x: number, y: number) => {
    if (x < 0 || x >= width || y < 0 || y >= height) return 0;
    return result[y * width + x] > 0 ? 1 : 0;
  };

  let changed = true;
  while (changed) {
    changed = false;
    const toRemove: number[] = [];

    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        if (result[y * width + x] === 0) continue;

        const p2 = getPixel(x, y - 1);
        const p3 = getPixel(x + 1, y - 1);
        const p4 = getPixel(x + 1, y);
        const p5 = getPixel(x + 1, y + 1);
        const p6 = getPixel(x, y + 1);
        const p7 = getPixel(x - 1, y + 1);
        const p8 = getPixel(x - 1, y);
        const p9 = getPixel(x - 1, y - 1);

        const B = p2 + p3 + p4 + p5 + p6 + p7 + p8 + p9;
        if (B < 2 || B > 6) continue;

        let A = 0;
        if (p2 === 0 && p3 === 1) A++;
        if (p3 === 0 && p4 === 1) A++;
        if (p4 === 0 && p5 === 1) A++;
        if (p5 === 0 && p6 === 1) A++;
        if (p6 === 0 && p7 === 1) A++;
        if (p7 === 0 && p8 === 1) A++;
        if (p8 === 0 && p9 === 1) A++;
        if (p9 === 0 && p2 === 1) A++;
        if (A !== 1) continue;

        if (p2 * p4 * p6 === 0 && p4 * p6 * p8 === 0) {
          toRemove.push(y * width + x);
        }
      }
    }

    for (const idx of toRemove) {
      result[idx] = 0;
      changed = true;
    }

    const toRemove2: number[] = [];
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        if (result[y * width + x] === 0) continue;

        const p2 = getPixel(x, y - 1);
        const p3 = getPixel(x + 1, y - 1);
        const p4 = getPixel(x + 1, y);
        const p5 = getPixel(x + 1, y + 1);
        const p6 = getPixel(x, y + 1);
        const p7 = getPixel(x - 1, y + 1);
        const p8 = getPixel(x - 1, y);
        const p9 = getPixel(x - 1, y - 1);

        const B = p2 + p3 + p4 + p5 + p6 + p7 + p8 + p9;
        if (B < 2 || B > 6) continue;

        let A = 0;
        if (p2 === 0 && p3 === 1) A++;
        if (p3 === 0 && p4 === 1) A++;
        if (p4 === 0 && p5 === 1) A++;
        if (p5 === 0 && p6 === 1) A++;
        if (p6 === 0 && p7 === 1) A++;
        if (p7 === 0 && p8 === 1) A++;
        if (p8 === 0 && p9 === 1) A++;
        if (p9 === 0 && p2 === 1) A++;
        if (A !== 1) continue;

        if (p2 * p4 * p8 === 0 && p2 * p6 * p8 === 0) {
          toRemove2.push(y * width + x);
        }
      }
    }

    for (const idx of toRemove2) {
      result[idx] = 0;
      changed = true;
    }
  }

  return result;
}

function curveSimilarity(sig1: Uint8Array, w1: number, h1: number, sig2: Uint8Array, w2: number, h2: number): { score: number; norm1: { data: Uint8Array; width: number; height: number } | null; norm2: { data: Uint8Array; width: number; height: number } | null } {
  const n1 = normalizeSignature(sig1, w1, h1);
  const n2 = normalizeSignature(sig2, w2, h2);

  if (!n1 || !n2) return { score: 0, norm1: null, norm2: null };

  const skel1 = skeletonize(n1.data, n1.width, n1.height);
  const skel2 = skeletonize(n2.data, n2.width, n2.height);

  const w = n1.width;
  const h = n1.height;

  const extractCurve = (img: Uint8Array) => {
    const curve = new Float64Array(w);
    for (let x = 0; x < w; x++) {
      let sum = 0, count = 0;
      for (let y = 0; y < h; y++) {
        if (img[y * w + x] > 0) {
          sum += y;
          count++;
        }
      }
      curve[x] = count > 0 ? sum / count : h;
    }
    return curve;
  };

  const c1 = extractCurve(skel1);
  const c2 = extractCurve(skel2);

  let mean1 = 0, mean2 = 0;
  for (let i = 0; i < w; i++) { mean1 += c1[i]; mean2 += c2[i]; }
  mean1 /= w; mean2 /= w;

  let std1 = 0, std2 = 0;
  for (let i = 0; i < w; i++) {
    std1 += (c1[i] - mean1) ** 2;
    std2 += (c2[i] - mean2) ** 2;
  }
  std1 = Math.sqrt(std1 / w) + 1e-6;
  std2 = Math.sqrt(std2 / w) + 1e-6;

  for (let i = 0; i < w; i++) {
    c1[i] = (c1[i] - mean1) / std1;
    c2[i] = (c2[i] - mean2) / std2;
  }

  let sumProd = 0, sumSq1 = 0, sumSq2 = 0;
  for (let i = 0; i < w; i++) {
    sumProd += c1[i] * c2[i];
    sumSq1 += c1[i] ** 2;
    sumSq2 += c2[i] ** 2;
  }

  const correlation = sumProd / (Math.sqrt(sumSq1 * sumSq2) + 1e-6);
  const similarity = Math.max(0, correlation) * 100;

  return {
    score: similarity,
    norm1: { data: skel1, width: n1.width, height: n1.height },
    norm2: { data: skel2, width: n2.width, height: n2.height },
  };
}

function applyMatchMode(score: number, mode: string): number {
  let adjusted = score;
  if (mode === "relaxed") adjusted = score * 1.25;
  else if (mode === "vacation") adjusted = score * 1.40;
  return Math.min(adjusted, 100);
}

async function grayToBase64Png(data: Uint8Array, width: number, height: number): Promise<string> {
  const buffer = await sharp(Buffer.from(data), { raw: { width, height, channels: 1 } })
    .png()
    .toBuffer();
  return `data:image/png;base64,${buffer.toString("base64")}`;
}

async function extractCandidatesFromPdf(
  pdfBuffer: Buffer,
  slot: number,
  regions: MaskRegion[],
  dpi: number
): Promise<SignatureCandidate[]> {
  const slotRegions = regions.filter(r => r.fileSlot === slot);
  if (slotRegions.length === 0) return [];

  const pages = await pdfToImages(pdfBuffer, dpi);
  const candidates: SignatureCandidate[] = [];

  for (const pageData of pages) {
    for (const region of slotRegions) {
      const scaleFactor = dpi / 72;
      const scaledRegion = {
        ...region,
        x: region.x * scaleFactor,
        y: region.y * scaleFactor,
        width: region.width * scaleFactor,
        height: region.height * scaleFactor,
      };

      const cropped = cropRegion(pageData.data, pageData.width, pageData.height, scaledRegion);
      if (cropped.width === 0 || cropped.height === 0) continue;

      const strokes = extractSignatureStrokes(cropped.data, cropped.width, cropped.height);

      if (strokes) {
        candidates.push({
          slot,
          pageNumber: pageData.page,
          pixels: strokes,
          width: cropped.width,
          height: cropped.height,
        });
      }
    }
  }

  return candidates;
}

export async function verifySignatures(
  fileBuffers: Map<number, Buffer>,
  regions: MaskRegion[],
  matchMode: string = "relaxed",
  dpi: number = 200
): Promise<VerificationOutput> {
  const allCandidates = new Map<number, SignatureCandidate[]>();

  for (const [slot, buffer] of fileBuffers) {
    const candidates = await extractCandidatesFromPdf(buffer, slot, regions, dpi);
    allCandidates.set(slot, candidates);
  }

  const slots = Array.from(allCandidates.keys()).sort((a, b) => a - b);
  const comparisons: ComparisonResult[] = [];
  let bestScore = 0;
  let bestPair: { slot1: number; slot2: number; page1: number; page2: number; norm1: any; norm2: any } | null = null;

  for (let i = 0; i < slots.length; i++) {
    for (let j = i + 1; j < slots.length; j++) {
      const s1 = slots[i];
      const s2 = slots[j];
      const cands1 = allCandidates.get(s1) || [];
      const cands2 = allCandidates.get(s2) || [];

      for (const c1 of cands1) {
        for (const c2 of cands2) {
          const { score: rawScore, norm1, norm2 } = curveSimilarity(
            c1.pixels, c1.width, c1.height,
            c2.pixels, c2.width, c2.height
          );
          const adjustedScore = applyMatchMode(rawScore, matchMode);

          comparisons.push({
            slot1: s1,
            slot2: s2,
            file1Page: c1.pageNumber,
            file2Page: c2.pageNumber,
            rawScore: Math.round(rawScore * 100) / 100,
            adjustedScore: Math.round(adjustedScore * 100) / 100,
          });

          if (adjustedScore > bestScore && norm1 && norm2) {
            bestScore = adjustedScore;
            bestPair = { slot1: s1, slot2: s2, page1: c1.pageNumber, page2: c2.pageNumber, norm1, norm2 };
          }
        }
      }
    }
  }

  const signatureImages: Record<string, string> = {};

  if (bestPair) {
    signatureImages[`slot${bestPair.slot1}`] = await grayToBase64Png(bestPair.norm1.data, bestPair.norm1.width, bestPair.norm1.height);
    signatureImages[`slot${bestPair.slot2}`] = await grayToBase64Png(bestPair.norm2.data, bestPair.norm2.width, bestPair.norm2.height);
  }

  return {
    confidenceScore: Math.round(bestScore * 100) / 100,
    matchMode,
    bestMatch: bestPair ? { file1Slot: bestPair.slot1, file2Slot: bestPair.slot2, file1Page: bestPair.page1, file2Page: bestPair.page2 } : undefined,
    comparisons,
    signatureImages: Object.keys(signatureImages).length > 0 ? signatureImages : undefined,
  };
}
