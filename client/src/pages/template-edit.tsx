import { useState, useRef, useCallback, useEffect } from "react";
import { useLocation, useRoute } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Upload, ChevronLeft, ChevronRight, Trash2, Save, MousePointer2, Layers, Plus, Minus, FileText } from "lucide-react";
import type { MaskRegion, Template } from "@shared/schema";

interface DrawingRect {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

interface SlotPdfState {
  file: File | null;
  pageCount: number;
  currentPage: number;
  pageImage: string | null;
  loadingPage: boolean;
}

const SLOT_COLORS = [
  { fill: "rgba(59, 130, 246, 0.15)", stroke: "#3b82f6", text: "#3b82f6" },
  { fill: "rgba(239, 68, 68, 0.15)", stroke: "#ef4444", text: "#ef4444" },
  { fill: "rgba(34, 197, 94, 0.15)", stroke: "#22c55e", text: "#22c55e" },
  { fill: "rgba(168, 85, 247, 0.15)", stroke: "#a855f7", text: "#a855f7" },
  { fill: "rgba(249, 115, 22, 0.15)", stroke: "#f97316", text: "#f97316" },
];

function getSlotColor(slot: number) {
  return SLOT_COLORS[(slot - 1) % SLOT_COLORS.length];
}

export default function TemplateEdit() {
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/templates/:id/edit");
  const id = params?.id;
  const { toast } = useToast();

  const [initialized, setInitialized] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [matchMode, setMatchMode] = useState("relaxed");
  const [dpi, setDpi] = useState(200);
  const [fileSlotCount, setFileSlotCount] = useState(2);
  const [activeSlot, setActiveSlot] = useState(1);

  const [slotPdfs, setSlotPdfs] = useState<Record<number, SlotPdfState>>({});

  const [regions, setRegions] = useState<MaskRegion[]>([]);
  const [drawing, setDrawing] = useState<DrawingRect | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  const { data: template, isLoading } = useQuery<Template>({
    queryKey: ["/api/templates", id],
    enabled: !!id,
  });

  useEffect(() => {
    if (template && !initialized) {
      setName(template.name);
      setDescription(template.description || "");
      setMatchMode(template.matchMode);
      setDpi(template.dpi || 200);
      setFileSlotCount(template.fileSlotCount || 2);
      const existingRegions = (template.maskRegions || []).map(r => ({
        ...r,
        fileSlot: (r as any).fileSlot || 1,
      }));
      setRegions(existingRegions);
      setInitialized(true);
    }
  }, [template, initialized]);

  const defaultSlotPdf: SlotPdfState = { file: null, pageCount: 0, currentPage: 1, pageImage: null, loadingPage: false };

  const updateSlotPdf = (slot: number, update: Partial<SlotPdfState>) => {
    setSlotPdfs(prev => ({
      ...prev,
      [slot]: { ...(prev[slot] || defaultSlotPdf), ...update },
    }));
  };

  const currentSlotPdf = slotPdfs[activeSlot] || defaultSlotPdf;

  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PATCH", `/api/templates/${id}`, {
        name,
        description,
        matchMode,
        dpi,
        maskRegions: regions,
        fileSlotCount,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/templates"] });
      queryClient.invalidateQueries({ queryKey: ["/api/templates", id] });
      toast({ title: "Template updated" });
      setLocation(`/templates/${id}`);
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const loadPageImage = useCallback(async (file: File, page: number, slot: number) => {
    updateSlotPdf(slot, { loadingPage: true });
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("page", page.toString());
      const res = await fetch("/api/pdf/render", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to render page");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      updateSlotPdf(slot, { pageImage: url, loadingPage: false });
    } catch {
      toast({ title: "Error", description: "Failed to render PDF page", variant: "destructive" });
      updateSlotPdf(slot, { loadingPage: false });
    }
  }, [toast]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, slot: number) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/pdf/page-count", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to get page count");
      const data = await res.json();

      updateSlotPdf(slot, { file, pageCount: data.pageCount, currentPage: 1, pageImage: null });
      await loadPageImage(file, 1, slot);
    } catch {
      toast({ title: "Error", description: "Failed to load PDF", variant: "destructive" });
    }
  };

  const handlePageChange = (slot: number, newPage: number) => {
    const slotState = slotPdfs[slot] || defaultSlotPdf;
    if (!slotState.file) return;
    updateSlotPdf(slot, { currentPage: newPage });
    loadPageImage(slotState.file, newPage, slot);
  };

  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    ctx.drawImage(img, 0, 0);

    const slotState = slotPdfs[activeSlot] || defaultSlotPdf;
    const pageRegions = regions.filter(r => r.fileSlot === activeSlot && r.pageNumber === slotState.currentPage);
    for (const region of pageRegions) {
      const color = getSlotColor(region.fileSlot);
      ctx.fillStyle = color.fill;
      ctx.fillRect(region.x, region.y, region.width, region.height);
      ctx.strokeStyle = color.stroke;
      ctx.lineWidth = 2;
      ctx.strokeRect(region.x, region.y, region.width, region.height);

      const label = region.label || "";
      ctx.fillStyle = color.text;
      ctx.font = "bold 14px sans-serif";
      ctx.fillText(label, region.x + 4, region.y + 16);
    }

    if (drawing) {
      const x = Math.min(drawing.startX, drawing.endX);
      const y = Math.min(drawing.startY, drawing.endY);
      const w = Math.abs(drawing.endX - drawing.startX);
      const h = Math.abs(drawing.endY - drawing.startY);

      const color = getSlotColor(activeSlot);
      ctx.fillStyle = color.fill.replace("0.15", "0.25");
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = color.stroke;
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.strokeRect(x, y, w, h);
      ctx.setLineDash([]);
    }
  }, [regions, activeSlot, drawing, slotPdfs]);

  useEffect(() => {
    drawCanvas();
  }, [drawCanvas]);

  const getCanvasCoords = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const { x, y } = getCanvasCoords(e);
    setIsDrawing(true);
    setDrawing({ startX: x, startY: y, endX: x, endY: y });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !drawing) return;
    const { x, y } = getCanvasCoords(e);
    setDrawing({ ...drawing, endX: x, endY: y });
  };

  const handleMouseUp = () => {
    if (!isDrawing || !drawing) return;
    setIsDrawing(false);

    const x = Math.min(drawing.startX, drawing.endX);
    const y = Math.min(drawing.startY, drawing.endY);
    const w = Math.abs(drawing.endX - drawing.startX);
    const h = Math.abs(drawing.endY - drawing.startY);

    if (w > 10 && h > 10) {
      const slotState = slotPdfs[activeSlot] || defaultSlotPdf;
      const slotRegions = regions.filter(r => r.fileSlot === activeSlot);
      const newRegion: MaskRegion = {
        pageNumber: slotState.currentPage,
        x: Math.round(x),
        y: Math.round(y),
        width: Math.round(w),
        height: Math.round(h),
        label: `Region ${slotRegions.length + 1}`,
        fileSlot: activeSlot,
      };
      setRegions([...regions, newRegion]);
    }
    setDrawing(null);
  };

  const handleImageLoad = () => {
    drawCanvas();
  };

  const hasRegionsForAllSlots = () => {
    for (let s = 1; s <= fileSlotCount; s++) {
      if (!regions.some(r => r.fileSlot === s)) return false;
    }
    return true;
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!template) {
    return <p className="text-muted-foreground">Template not found</p>;
  }

  return (
    <div className="space-y-6" data-testid="template-edit-page">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => setLocation(`/templates/${id}`)} data-testid="button-back">
          <ChevronLeft className="h-4 w-4 mr-1" />
          Back
        </Button>
        <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">Edit Template</h1>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <MousePointer2 className="h-5 w-5" />
                Mask Region Editor
              </CardTitle>
              <CardDescription>Upload a sample PDF for each file slot to adjust mask regions</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2 flex-wrap">
                {Array.from({ length: fileSlotCount }, (_, i) => i + 1).map(slot => {
                  const color = getSlotColor(slot);
                  const count = regions.filter(r => r.fileSlot === slot).length;
                  const hasPdf = !!(slotPdfs[slot] || defaultSlotPdf).file;
                  return (
                    <Button
                      key={slot}
                      variant={activeSlot === slot ? "default" : "outline"}
                      size="sm"
                      onClick={() => setActiveSlot(slot)}
                      style={activeSlot === slot ? { backgroundColor: color.stroke } : { borderColor: color.stroke, color: color.text }}
                      data-testid={`button-slot-${slot}`}
                    >
                      <FileText className="h-3.5 w-3.5 mr-1" />
                      File {slot}
                      {hasPdf ? ` (${count})` : count > 0 ? ` (${count})` : ""}
                    </Button>
                  );
                })}
              </div>

              {!currentSlotPdf.file ? (
                <label className="flex flex-col items-center justify-center border-2 border-dashed rounded-md p-12 cursor-pointer hover:border-primary/50 transition-colors" style={{ borderColor: getSlotColor(activeSlot).stroke + "40" }} data-testid={`upload-area-slot-${activeSlot}`}>
                  <Upload className="h-10 w-10 text-muted-foreground mb-3" />
                  <span className="text-sm font-medium">Upload a sample PDF for File {activeSlot}</span>
                  <span className="text-xs text-muted-foreground mt-1">
                    {regions.filter(r => r.fileSlot === activeSlot).length > 0
                      ? "Upload to visualize and adjust existing regions"
                      : "Upload to draw mask regions on this document type"}
                  </span>
                  <input type="file" accept=".pdf" className="hidden" onChange={e => handleFileUpload(e, activeSlot)} data-testid={`input-pdf-upload-slot-${activeSlot}`} />
                </label>
              ) : (
                <>
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" style={{ borderColor: getSlotColor(activeSlot).stroke, color: getSlotColor(activeSlot).text }}>
                        File {activeSlot}: {currentSlotPdf.file.name}
                      </Badge>
                      <Badge variant="secondary">Page {currentSlotPdf.currentPage} of {currentSlotPdf.pageCount}</Badge>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="secondary" size="sm" disabled={currentSlotPdf.currentPage <= 1} onClick={() => handlePageChange(activeSlot, currentSlotPdf.currentPage - 1)} data-testid="button-prev-page">
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <Button variant="secondary" size="sm" disabled={currentSlotPdf.currentPage >= currentSlotPdf.pageCount} onClick={() => handlePageChange(activeSlot, currentSlotPdf.currentPage + 1)} data-testid="button-next-page">
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => { updateSlotPdf(activeSlot, { file: null, pageImage: null, pageCount: 0, currentPage: 1 }); }} data-testid="button-remove-pdf">
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>

                  <div className="relative border rounded-md bg-muted/50" style={{ minHeight: "400px", borderColor: getSlotColor(activeSlot).stroke + "30" }}>
                    {currentSlotPdf.loadingPage ? (
                      <div className="flex items-center justify-center h-96">
                        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
                      </div>
                    ) : currentSlotPdf.pageImage ? (
                      <>
                        <img ref={imgRef} src={currentSlotPdf.pageImage} alt="PDF page" className="hidden" onLoad={handleImageLoad} crossOrigin="anonymous" />
                        <canvas
                          ref={canvasRef}
                          className="w-full h-auto cursor-crosshair rounded-md"
                          onMouseDown={handleMouseDown}
                          onMouseMove={handleMouseMove}
                          onMouseUp={handleMouseUp}
                          onMouseLeave={() => { if (isDrawing) handleMouseUp(); }}
                          data-testid="canvas-mask-editor"
                        />
                      </>
                    ) : null}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Template Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input id="name" value={name} onChange={e => setName(e.target.value)} data-testid="input-template-name" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea id="description" value={description} onChange={e => setDescription(e.target.value)} className="resize-none" data-testid="input-template-description" />
              </div>
              <div className="space-y-2">
                <Label>File Slots</Label>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="icon" disabled={fileSlotCount <= 2} onClick={() => { const n = fileSlotCount - 1; setFileSlotCount(n); setRegions(regions.filter(r => r.fileSlot <= n)); setSlotPdfs(prev => { const next = { ...prev }; delete next[fileSlotCount]; return next; }); if (activeSlot > n) setActiveSlot(n); }} data-testid="button-decrease-slots">
                    <Minus className="h-4 w-4" />
                  </Button>
                  <span className="text-sm font-medium w-8 text-center" data-testid="text-slot-count">{fileSlotCount}</span>
                  <Button variant="outline" size="icon" disabled={fileSlotCount >= 5} onClick={() => setFileSlotCount(fileSlotCount + 1)} data-testid="button-increase-slots">
                    <Plus className="h-4 w-4" />
                  </Button>
                  <span className="text-xs text-muted-foreground">documents to compare</span>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Match Mode</Label>
                <Select value={matchMode} onValueChange={setMatchMode}>
                  <SelectTrigger data-testid="select-match-mode"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="strict">Strict</SelectItem>
                    <SelectItem value="relaxed">Relaxed</SelectItem>
                    <SelectItem value="vacation">Vacation</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="dpi">DPI</Label>
                <Select value={dpi.toString()} onValueChange={v => setDpi(parseInt(v))}>
                  <SelectTrigger data-testid="select-dpi"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="150">150 DPI</SelectItem>
                    <SelectItem value="200">200 DPI</SelectItem>
                    <SelectItem value="300">300 DPI</SelectItem>
                    <SelectItem value="400">400 DPI</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Layers className="h-5 w-5" />
                Mask Regions ({regions.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {regions.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No mask regions defined</p>
              ) : (
                <div className="space-y-2">
                  {Array.from({ length: fileSlotCount }, (_, i) => i + 1).map(slot => {
                    const slotRegions = regions.filter(r => r.fileSlot === slot);
                    if (slotRegions.length === 0) return null;
                    const color = getSlotColor(slot);
                    return (
                      <div key={slot}>
                        <div className="flex items-center gap-2 mb-1">
                          <div className="h-3 w-3 rounded-full" style={{ backgroundColor: color.stroke }} />
                          <span className="text-xs font-medium">File {slot}</span>
                        </div>
                        {slotRegions.map((r) => {
                          const idx = regions.indexOf(r);
                          return (
                            <div key={idx} className="flex items-center justify-between gap-2 p-2 rounded-md border text-sm ml-5 mb-1" data-testid={`region-item-${idx}`}>
                              <div>
                                <span className="font-medium">Page {r.pageNumber}</span>
                                <span className="text-muted-foreground ml-2">{Math.round(r.width)}x{Math.round(r.height)}</span>
                              </div>
                              <Button variant="ghost" size="icon" onClick={() => setRegions(regions.filter((_, j) => j !== idx))} data-testid={`button-remove-region-${idx}`}>
                                <Trash2 className="h-3.5 w-3.5 text-destructive" />
                              </Button>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              )}

              {!hasRegionsForAllSlots() && regions.length > 0 && (
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">Each file slot needs at least one mask region</p>
              )}

              <Button
                className="w-full mt-4"
                disabled={!name.trim() || !hasRegionsForAllSlots() || saveMutation.isPending}
                onClick={() => saveMutation.mutate()}
                data-testid="button-save-template"
              >
                <Save className="mr-2 h-4 w-4" />
                {saveMutation.isPending ? "Saving..." : "Update Template"}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
