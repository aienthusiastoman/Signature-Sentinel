import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle2, Clock, ArrowRight } from "lucide-react";
import type { Verification } from "@shared/schema";

export default function VerificationsList() {
  const { data: verifications, isLoading } = useQuery<Verification[]>({ queryKey: ["/api/verifications"] });

  return (
    <div className="space-y-6" data-testid="verifications-page">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">Verifications</h1>
          <p className="text-muted-foreground">History of all signature comparisons</p>
        </div>
        <Link href="/verify">
          <Button data-testid="button-new-verification">
            <CheckCircle2 className="mr-2 h-4 w-4" />
            New Verification
          </Button>
        </Link>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-16 w-full rounded-md" />)}
        </div>
      ) : (verifications || []).length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <CheckCircle2 className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="text-lg font-medium mb-1">No verifications yet</h3>
            <p className="text-muted-foreground mb-4">Run your first signature comparison</p>
            <Link href="/verify">
              <Button data-testid="button-first-verification">
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Verify Signatures
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {verifications!.map(v => (
            <Link key={v.id} href={`/verifications/${v.id}`}>
              <Card className="hover-elevate cursor-pointer" data-testid={`card-verification-${v.id}`}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <div className={`h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                      (v.confidenceScore || 0) >= 70 ? "bg-green-100 dark:bg-green-900/30" :
                      (v.confidenceScore || 0) >= 40 ? "bg-yellow-100 dark:bg-yellow-900/30" :
                      "bg-red-100 dark:bg-red-900/30"
                    }`}>
                      <CheckCircle2 className={`h-5 w-5 ${
                        (v.confidenceScore || 0) >= 70 ? "text-green-600 dark:text-green-400" :
                        (v.confidenceScore || 0) >= 40 ? "text-yellow-600 dark:text-yellow-400" :
                        "text-red-600 dark:text-red-400"
                      }`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {v.file1Name} <ArrowRight className="inline h-3 w-3 mx-1" /> {v.file2Name}
                      </p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">
                            {v.createdAt ? new Date(v.createdAt).toLocaleString() : ""}
                          </span>
                        </div>
                      </div>
                    </div>
                    <Badge
                      variant={
                        (v.confidenceScore || 0) >= 70 ? "default" :
                        (v.confidenceScore || 0) >= 40 ? "secondary" : "destructive"
                      }
                      className="text-sm"
                    >
                      {v.confidenceScore?.toFixed(1)}%
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
