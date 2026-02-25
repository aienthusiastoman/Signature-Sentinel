import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { Upload, CheckCircle2, FileText, ArrowRight, Loader2 } from "lucide-react";
import type { Template, Verification } from "@shared/schema";

export default function VerifyPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [templateId, setTemplateId] = useState("");
  const [file1, setFile1] = useState<File | null>(null);
  const [file2, setFile2] = useState<File | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [result, setResult] = useState<Verification | null>(null);

  const { data: templates } = useQuery<Template[]>({ queryKey: ["/api/templates"] });

  const handleVerify = async () => {
    if (!templateId || !file1 || !file2) {
      toast({ title: "Please fill all fields", variant: "destructive" });
      return;
    }

    setVerifying(true);
    setResult(null);
    try {
      const formData = new FormData();
      formData.append("templateId", templateId);
      formData.append("file1", file1);
      formData.append("file2", file2);

      const res = await fetch("/api/verify", {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Verification failed");
      }

      const data = await res.json();
      setResult(data);
      toast({ title: "Verification complete" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setVerifying(false);
    }
  };

  const resultData = result?.results as any;
  const score = result?.confidenceScore || 0;

  return (
    <div className="space-y-6" data-testid="verify-page">
      <div>
        <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">Verify Signatures</h1>
        <p className="text-muted-foreground">Compare signatures between two PDF documents</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Upload Documents</CardTitle>
            <CardDescription>Select a template and upload two PDF files to compare</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Template</Label>
              <Select value={templateId} onValueChange={setTemplateId}>
                <SelectTrigger data-testid="select-template">
                  <SelectValue placeholder="Select a template" />
                </SelectTrigger>
                <SelectContent>
                  {(templates || []).map(t => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Document 1</Label>
              <label
                className={`flex items-center gap-3 border rounded-md p-3 cursor-pointer transition-colors ${file1 ? "border-primary/50 bg-primary/5" : "border-dashed hover:border-primary/30"}`}
                data-testid="upload-file1"
              >
                <div className="h-9 w-9 rounded-md bg-muted flex items-center justify-center flex-shrink-0">
                  {file1 ? <FileText className="h-4 w-4 text-primary" /> : <Upload className="h-4 w-4 text-muted-foreground" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {file1 ? file1.name : "Choose PDF file"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {file1 ? `${(file1.size / 1024 / 1024).toFixed(2)} MB` : "Click to upload"}
                  </p>
                </div>
                <input type="file" accept=".pdf" className="hidden" onChange={e => setFile1(e.target.files?.[0] || null)} />
              </label>
            </div>

            <div className="space-y-2">
              <Label>Document 2</Label>
              <label
                className={`flex items-center gap-3 border rounded-md p-3 cursor-pointer transition-colors ${file2 ? "border-primary/50 bg-primary/5" : "border-dashed hover:border-primary/30"}`}
                data-testid="upload-file2"
              >
                <div className="h-9 w-9 rounded-md bg-muted flex items-center justify-center flex-shrink-0">
                  {file2 ? <FileText className="h-4 w-4 text-primary" /> : <Upload className="h-4 w-4 text-muted-foreground" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {file2 ? file2.name : "Choose PDF file"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {file2 ? `${(file2.size / 1024 / 1024).toFixed(2)} MB` : "Click to upload"}
                  </p>
                </div>
                <input type="file" accept=".pdf" className="hidden" onChange={e => setFile2(e.target.files?.[0] || null)} />
              </label>
            </div>

            <Button
              className="w-full"
              disabled={!templateId || !file1 || !file2 || verifying}
              onClick={handleVerify}
              data-testid="button-verify"
            >
              {verifying ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Analyzing signatures...
                </>
              ) : (
                <>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Verify Signatures
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {result && resultData && (
          <Card data-testid="verification-result">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5" />
                Verification Results
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="text-center py-4">
                <div className={`text-5xl font-bold ${score >= 70 ? "text-green-600 dark:text-green-400" : score >= 40 ? "text-yellow-600 dark:text-yellow-400" : "text-red-600 dark:text-red-400"}`} data-testid="text-confidence-score">
                  {score.toFixed(1)}%
                </div>
                <p className="text-sm text-muted-foreground mt-1">Confidence Score ({resultData.matchMode})</p>
                <Progress
                  value={score}
                  className="mt-3"
                />
              </div>

              {resultData.bestMatch && (
                <div className="flex items-center justify-center gap-3 text-sm">
                  <Badge variant="secondary">Doc 1 - Page {resultData.bestMatch.file1Page}</Badge>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  <Badge variant="secondary">Doc 2 - Page {resultData.bestMatch.file2Page}</Badge>
                </div>
              )}

              {(resultData.signature1Image || resultData.signature2Image) && (
                <div className="space-y-3">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider text-center">Signature Comparison</p>
                  <div className="grid grid-cols-2 gap-3">
                    {resultData.signature1Image && (
                      <div className="border rounded-md p-2 bg-white">
                        <p className="text-xs text-center text-muted-foreground mb-1">Document 1</p>
                        <img src={resultData.signature1Image} alt="Signature 1" className="w-full" data-testid="img-signature-1" />
                      </div>
                    )}
                    {resultData.signature2Image && (
                      <div className="border rounded-md p-2 bg-white">
                        <p className="text-xs text-center text-muted-foreground mb-1">Document 2</p>
                        <img src={resultData.signature2Image} alt="Signature 2" className="w-full" data-testid="img-signature-2" />
                      </div>
                    )}
                  </div>
                </div>
              )}

              {resultData.comparisons && resultData.comparisons.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">All Comparisons</p>
                  <div className="space-y-1.5">
                    {resultData.comparisons.map((c: any, i: number) => (
                      <div key={i} className="flex items-center justify-between gap-2 p-2 border rounded-md text-xs" data-testid={`comparison-row-${i}`}>
                        <span>P{c.file1Page} vs P{c.file2Page}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">Raw: {c.rawScore.toFixed(1)}%</span>
                          <Badge variant={c.adjustedScore >= 70 ? "default" : "secondary"} className="text-xs">
                            {c.adjustedScore.toFixed(1)}%
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <Button
                variant="secondary"
                className="w-full"
                onClick={() => setLocation(`/verifications/${result.id}`)}
                data-testid="button-view-detail"
              >
                View Full Details
              </Button>
            </CardContent>
          </Card>
        )}

        {verifying && (
          <Card>
            <CardContent className="py-16 text-center">
              <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-primary" />
              <h3 className="text-lg font-medium">Analyzing Signatures</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Extracting and comparing signature regions...
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
