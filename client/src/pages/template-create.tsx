import { useState, useRef, useCallback, useEffect } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Upload, ChevronLeft, ChevronRight, Trash2, Save, MousePointer2, Layers } from "lucide-react";
import type { MaskRegion } from "@shared/schema";

interface DrawingRect {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

export default function TemplateCreate() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [matchMode, setMatchMode] = useState("relaxed");
  const [dpi, setDpi] = useState(200);

  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageImage, setPageImage] = useState<string | null>(null);
  const [loadingPage, setLoadingPage] = useState(false);

  const [regions, setRegions] = useState<MaskRegion[]>([]);
  const [drawing, setDrawing] = useState<DrawingRect | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/templates", {
        name,
        description,
        matchMode,
        dpi,
        maskRegions: regions,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/templates"] });
      toast({ title: "Template created" });
      setLocation("/templates");
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const loadPageCount = useCallback(async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch("/api/pdf/page-count", {
      method: "POST",
      body: formData,
      credentials: "include",
    });
    if (!res.ok) throw new Error("Failed to get page count");
    const data = await res.json();
    setPageCount(data.pageCount);
  }, []);

  const loadPageImage = useCallback(async (file: File, page: number) => {
    setLoadingPage(true);
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
      setPageImage(url);
    } catch {
      toast({ title: "Error", description: "Failed to render PDF page", variant: "destructive" });
    } finally {
      setLoadingPage(false);
    }
  }, [toast]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPdfFile(file);
    setCurrentPage(1);
    setRegions([]);
    try {
      await loadPageCount(file);
      await loadPageImage(file, 1);
    } catch {
      toast({ title: "Error", description: "Failed to load PDF", variant: "destructive" });
    }
  };

  useEffect(() => {
    if (pdfFile && currentPage > 0) {
      loadPageImage(pdfFile, currentPage);
    }
  }, [currentPage, pdfFile, loadPageImage]);

  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;

    ctx.drawImage(img, 0, 0);

    const pageRegions = regions.filter(r => r.pageNumber === currentPage);
    for (const region of pageRegions) {
      ctx.fillStyle = "rgba(59, 130, 246, 0.15)";
      ctx.fillRect(region.x, region.y, region.width, region.height);
      ctx.strokeStyle = "#3b82f6";
      ctx.lineWidth = 2;
      ctx.strokeRect(region.x, region.y, region.width, region.height);

      if (region.label) {
        ctx.fillStyle = "#3b82f6";
        ctx.font = "bold 14px sans-serif";
        ctx.fillText(region.label, region.x + 4, region.y + 16);
      }
    }

    if (drawing) {
      const x = Math.min(drawing.startX, drawing.endX);
      const y = Math.min(drawing.startY, drawing.endY);
      const w = Math.abs(drawing.endX - drawing.startX);
      const h = Math.abs(drawing.endY - drawing.startY);

      ctx.fillStyle = "rgba(34, 197, 94, 0.2)";
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = "#22c55e";
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.strokeRect(x, y, w, h);
      ctx.setLineDash([]);
    }
  }, [regions, currentPage, drawing]);

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
      const newRegion: MaskRegion = {
        pageNumber: currentPage,
        x: Math.round(x),
        y: Math.round(y),
        width: Math.round(w),
        height: Math.round(h),
        label: `Region ${regions.length + 1}`,
      };
      setRegions([...regions, newRegion]);
    }
    setDrawing(null);
  };

  const handleImageLoad = () => {
    drawCanvas();
  };

  return (
    <div className="space-y-6" data-testid="template-create-page">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => setLocation("/templates")} data-testid="button-back">
          <ChevronLeft className="h-4 w-4 mr-1" />
          Back
        </Button>
        <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">Create Template</h1>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <MousePointer2 className="h-5 w-5" />
                Mask Region Editor
              </CardTitle>
              <CardDescription>Upload a PDF and draw rectangles over signature areas</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!pdfFile ? (
                <label className="flex flex-col items-center justify-center border-2 border-dashed rounded-md p-12 cursor-pointer hover:border-primary/50 transition-colors" data-testid="upload-area">
                  <Upload className="h-10 w-10 text-muted-foreground mb-3" />
                  <span className="text-sm font-medium">Upload a PDF document</span>
                  <span className="text-xs text-muted-foreground mt-1">Click or drag to upload</span>
                  <input type="file" accept=".pdf" className="hidden" onChange={handleFileUpload} data-testid="input-pdf-upload" />
                </label>
              ) : (
                <>
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{pdfFile.name}</Badge>
                      <Badge variant="secondary">Page {currentPage} of {pageCount}</Badge>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={currentPage <= 1}
                        onClick={() => setCurrentPage(p => p - 1)}
                        data-testid="button-prev-page"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={currentPage >= pageCount}
                        onClick={() => setCurrentPage(p => p + 1)}
                        data-testid="button-next-page"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setPdfFile(null);
                          setPageImage(null);
                          setPageCount(0);
                          setRegions([]);
                        }}
                        data-testid="button-remove-pdf"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>

                  <div ref={containerRef} className="relative border rounded-md bg-muted/50" style={{ minHeight: "400px" }}>
                    {loadingPage ? (
                      <div className="flex items-center justify-center h-96">
                        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
                      </div>
                    ) : pageImage ? (
                      <>
                        <img
                          ref={imgRef}
                          src={pageImage}
                          alt="PDF page"
                          className="hidden"
                          onLoad={handleImageLoad}
                          crossOrigin="anonymous"
                        />
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

                  <p className="text-xs text-muted-foreground">
                    Click and drag on the page to draw a rectangle over the signature area. The mask will be applied to all pages when verifying.
                  </p>
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
                <Input
                  id="name"
                  placeholder="e.g., Insurance Form Signature"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  data-testid="input-template-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Optional description..."
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  className="resize-none"
                  data-testid="input-template-description"
                />
              </div>
              <div className="space-y-2">
                <Label>Match Mode</Label>
                <Select value={matchMode} onValueChange={setMatchMode}>
                  <SelectTrigger data-testid="select-match-mode">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="strict">Strict</SelectItem>
                    <SelectItem value="relaxed">Relaxed</SelectItem>
                    <SelectItem value="vacation">Vacation</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {matchMode === "strict" ? "No adjustment to raw score" :
                   matchMode === "relaxed" ? "1.25x multiplier for flexibility" :
                   "1.4x multiplier for maximum flexibility"}
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="dpi">DPI</Label>
                <Select value={dpi.toString()} onValueChange={v => setDpi(parseInt(v))}>
                  <SelectTrigger data-testid="select-dpi">
                    <SelectValue />
                  </SelectTrigger>
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
                <p className="text-sm text-muted-foreground text-center py-4">
                  Draw on the PDF to add regions
                </p>
              ) : (
                <div className="space-y-2">
                  {regions.map((r, i) => (
                    <div key={i} className="flex items-center justify-between gap-2 p-2 rounded-md border text-sm" data-testid={`region-item-${i}`}>
                      <div>
                        <span className="font-medium">Page {r.pageNumber}</span>
                        <span className="text-muted-foreground ml-2">
                          {Math.round(r.width)}x{Math.round(r.height)}
                        </span>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setRegions(regions.filter((_, j) => j !== i))}
                        data-testid={`button-remove-region-${i}`}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              <Button
                className="w-full mt-4"
                disabled={!name.trim() || regions.length === 0 || saveMutation.isPending}
                onClick={() => saveMutation.mutate()}
                data-testid="button-save-template"
              >
                <Save className="mr-2 h-4 w-4" />
                {saveMutation.isPending ? "Saving..." : "Save Template"}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
