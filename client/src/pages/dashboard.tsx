import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { FileText, Plus, CheckCircle2, Clock, BarChart3 } from "lucide-react";
import type { Template, Verification } from "@shared/schema";

export default function Dashboard() {
  const { data: templates, isLoading: tLoading } = useQuery<Template[]>({ queryKey: ["/api/templates"] });
  const { data: verifications, isLoading: vLoading } = useQuery<Verification[]>({ queryKey: ["/api/verifications"] });

  const recentVerifications = (verifications || []).slice(0, 5);
  const avgScore = verifications && verifications.length > 0
    ? Math.round((verifications.reduce((sum, v) => sum + (v.confidenceScore || 0), 0) / verifications.length) * 100) / 100
    : 0;

  return (
    <div className="space-y-6" data-testid="dashboard-page">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">Dashboard</h1>
          <p className="text-muted-foreground">Overview of your signature verification activity</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Link href="/templates/new">
            <Button data-testid="button-new-template">
              <Plus className="mr-2 h-4 w-4" />
              New Template
            </Button>
          </Link>
          <Link href="/verify">
            <Button variant="secondary" data-testid="button-new-verification">
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Verify Signatures
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Templates</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {tLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold" data-testid="text-template-count">{templates?.length || 0}</div>
            )}
            <p className="text-xs text-muted-foreground mt-1">Active mask templates</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Verifications</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {vLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold" data-testid="text-verification-count">{verifications?.length || 0}</div>
            )}
            <p className="text-xs text-muted-foreground mt-1">Total comparisons run</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg. Confidence</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {vLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold" data-testid="text-avg-score">{avgScore}%</div>
            )}
            <p className="text-xs text-muted-foreground mt-1">Across all verifications</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-1">
              <CardTitle className="text-lg">Recent Verifications</CardTitle>
              <Link href="/verifications">
                <Button variant="ghost" size="sm" data-testid="link-all-verifications">View all</Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {vLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-14 w-full" />)}
              </div>
            ) : recentVerifications.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <CheckCircle2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No verifications yet</p>
                <p className="text-sm">Run your first signature comparison</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentVerifications.map(v => (
                  <Link key={v.id} href={`/verifications/${v.id}`}>
                    <div className="flex items-center gap-3 p-3 rounded-md border hover-elevate cursor-pointer" data-testid={`card-verification-${v.id}`}>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{v.file1Name} vs {v.file2Name}</p>
                        <div className="flex items-center gap-1.5 mt-1">
                          <Clock className="h-3 w-3 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">
                            {v.createdAt ? new Date(v.createdAt).toLocaleDateString() : ""}
                          </span>
                        </div>
                      </div>
                      <Badge
                        variant={
                          (v.confidenceScore || 0) >= 70 ? "default" :
                          (v.confidenceScore || 0) >= 40 ? "secondary" : "destructive"
                        }
                      >
                        {v.confidenceScore?.toFixed(1)}%
                      </Badge>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-1">
              <CardTitle className="text-lg">Your Templates</CardTitle>
              <Link href="/templates">
                <Button variant="ghost" size="sm" data-testid="link-all-templates">View all</Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {tLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-14 w-full" />)}
              </div>
            ) : (templates || []).length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No templates created</p>
                <p className="text-sm">Create a mask template to get started</p>
              </div>
            ) : (
              <div className="space-y-3">
                {(templates || []).slice(0, 5).map(t => (
                  <Link key={t.id} href={`/templates/${t.id}`}>
                    <div className="flex items-center gap-3 p-3 rounded-md border hover-elevate cursor-pointer" data-testid={`card-template-${t.id}`}>
                      <div className="h-9 w-9 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <FileText className="h-4 w-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{t.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {(t.maskRegions as any[])?.length || 0} region{((t.maskRegions as any[])?.length || 0) !== 1 ? "s" : ""} &middot; {t.matchMode}
                        </p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
