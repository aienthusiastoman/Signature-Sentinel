import { useQuery } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft, CheckCircle2, ArrowRight, FileText, Clock } from "lucide-react";
import type { Verification } from "@shared/schema";

export default function VerificationDetail() {
  const [, params] = useRoute("/verifications/:id");
  const id = params?.id;

  const { data: verification, isLoading } = useQuery<Verification>({
    queryKey: ["/api/verifications", id],
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!verification) {
    return <p className="text-muted-foreground">Verification not found</p>;
  }

  const resultData = verification.results as any;
  const score = verification.confidenceScore || 0;
  const fileNames = (verification as any).fileNames as Record<string, string> | null;

  const getFileName = (slot: number) => {
    if (fileNames && fileNames[`slot${slot}`]) return fileNames[`slot${slot}`];
    if (slot === 1) return verification.file1Name || `File ${slot}`;
    if (slot === 2) return verification.file2Name || `File ${slot}`;
    return `File ${slot}`;
  };

  const signatureImages = resultData?.signatureImages || {};
  const legacySig1 = resultData?.signature1Image;
  const legacySig2 = resultData?.signature2Image;

  return (
    <div className="space-y-6" data-testid="verification-detail-page">
      <div className="flex items-center gap-2 flex-wrap">
        <Link href="/verifications">
          <Button variant="ghost" size="sm" data-testid="button-back">
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
        </Link>
        <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">Verification Result</h1>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5" />
              Confidence Score
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="text-center py-6">
              <div className={`text-6xl font-bold ${score >= 70 ? "text-green-600 dark:text-green-400" : score >= 40 ? "text-yellow-600 dark:text-yellow-400" : "text-red-600 dark:text-red-400"}`} data-testid="text-confidence-score">
                {score.toFixed(1)}%
              </div>
              <p className="text-muted-foreground mt-2">
                Match Mode: <Badge variant="secondary">{resultData?.matchMode}</Badge>
              </p>
              <Progress value={score} className="mt-4 max-w-md mx-auto" />
            </div>

            {resultData?.bestMatch && (
              <div className="flex items-center justify-center gap-3">
                <div className="text-center">
                  <div className="h-12 w-12 rounded-md bg-primary/10 flex items-center justify-center mx-auto mb-1">
                    <FileText className="h-6 w-6 text-primary" />
                  </div>
                  <p className="text-sm font-medium">{getFileName(resultData.bestMatch.file1Slot || 1)}</p>
                  <p className="text-xs text-muted-foreground">Page {resultData.bestMatch.file1Page}</p>
                </div>
                <ArrowRight className="h-6 w-6 text-muted-foreground" />
                <div className="text-center">
                  <div className="h-12 w-12 rounded-md bg-primary/10 flex items-center justify-center mx-auto mb-1">
                    <FileText className="h-6 w-6 text-primary" />
                  </div>
                  <p className="text-sm font-medium">{getFileName(resultData.bestMatch.file2Slot || 2)}</p>
                  <p className="text-xs text-muted-foreground">Page {resultData.bestMatch.file2Page}</p>
                </div>
              </div>
            )}

            {(Object.keys(signatureImages).length > 0 || legacySig1 || legacySig2) && (
              <div className="space-y-3 pt-2">
                <p className="text-sm font-medium text-center">Signature Snapshots</p>
                <div className="grid grid-cols-2 gap-4">
                  {Object.keys(signatureImages).length > 0 ? (
                    Object.entries(signatureImages).map(([key, img]) => (
                      <div key={key} className="border rounded-md p-3 bg-white">
                        <p className="text-xs text-center text-muted-foreground mb-2">{key.replace("slot", "File ")}</p>
                        <img src={img as string} alt={`Signature ${key}`} className="w-full" data-testid={`img-signature-${key}`} />
                      </div>
                    ))
                  ) : (
                    <>
                      {legacySig1 && (
                        <div className="border rounded-md p-3 bg-white">
                          <p className="text-xs text-center text-muted-foreground mb-2">Document 1</p>
                          <img src={legacySig1} alt="Signature 1" className="w-full" data-testid="img-signature-1" />
                        </div>
                      )}
                      {legacySig2 && (
                        <div className="border rounded-md p-3 bg-white">
                          <p className="text-xs text-center text-muted-foreground mb-2">Document 2</p>
                          <img src={legacySig2} alt="Signature 2" className="w-full" data-testid="img-signature-2" />
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {fileNames ? (
                Object.entries(fileNames).map(([key, name]) => (
                  <div key={key} className="space-y-1">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">{key.replace("slot", "Document ")}</p>
                    <p className="text-sm font-medium truncate">{name}</p>
                  </div>
                ))
              ) : (
                <>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Document 1</p>
                    <p className="text-sm font-medium truncate">{verification.file1Name}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Document 2</p>
                    <p className="text-sm font-medium truncate">{verification.file2Name}</p>
                  </div>
                </>
              )}
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Date</p>
                <div className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                  <p className="text-sm">
                    {verification.createdAt ? new Date(verification.createdAt).toLocaleString() : ""}
                  </p>
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Verification ID</p>
                <code className="text-xs bg-muted px-2 py-1 rounded font-mono block truncate">
                  {verification.id}
                </code>
              </div>
            </CardContent>
          </Card>

          {resultData?.comparisons && resultData.comparisons.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">All Comparisons</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {resultData.comparisons.map((c: any, i: number) => (
                    <div key={i} className="flex items-center justify-between gap-2 p-2 border rounded-md text-xs" data-testid={`comparison-row-${i}`}>
                      <span className="font-medium">
                        {c.slot1 && c.slot2 ? `F${c.slot1} P${c.file1Page} vs F${c.slot2} P${c.file2Page}` : `P${c.file1Page} vs P${c.file2Page}`}
                      </span>
                      <div className="flex flex-col items-end gap-0.5">
                        <span className="text-muted-foreground">Raw: {c.rawScore.toFixed(1)}%</span>
                        <Badge variant={c.adjustedScore >= 70 ? "default" : "secondary"} className="text-xs">
                          {c.adjustedScore.toFixed(1)}%
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
