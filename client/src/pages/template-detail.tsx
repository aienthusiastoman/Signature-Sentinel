import { useQuery } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { ChevronLeft, Copy, Code, Layers, CheckCircle2, Key } from "lucide-react";
import type { Template } from "@shared/schema";

export default function TemplateDetail() {
  const [, params] = useRoute("/templates/:id");
  const id = params?.id;
  const { user } = useAuth();
  const { toast } = useToast();

  const { data: template, isLoading } = useQuery<Template>({
    queryKey: ["/api/templates", id],
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

  if (!template) {
    return <p className="text-muted-foreground">Template not found</p>;
  }

  const regions = template.maskRegions as any[];
  const curlExample = `curl -X POST "${window.location.origin}/api/v1/verify" \\
  -H "X-API-Key: ${user?.apiKey || 'YOUR_API_KEY'}" \\
  -F "templateId=${template.id}" \\
  -F "file1=@document1.pdf" \\
  -F "file2=@document2.pdf"`;

  return (
    <div className="space-y-6" data-testid="template-detail-page">
      <div className="flex items-center gap-2 flex-wrap">
        <Link href="/templates">
          <Button variant="ghost" size="sm" data-testid="button-back">
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
        </Link>
        <h1 className="text-2xl font-bold tracking-tight" data-testid="text-template-name">{template.name}</h1>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Layers className="h-5 w-5" />
              Template Configuration
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {template.description && (
              <div>
                <p className="text-sm text-muted-foreground">{template.description}</p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Match Mode</p>
                <Badge variant="secondary">{template.matchMode}</Badge>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">DPI</p>
                <Badge variant="secondary">{template.dpi}</Badge>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Regions</p>
                <Badge variant="secondary">{regions.length}</Badge>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Created</p>
                <p className="text-sm">{template.createdAt ? new Date(template.createdAt).toLocaleDateString() : ""}</p>
              </div>
            </div>

            <div className="space-y-2 pt-2">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Template ID</p>
              <div className="flex items-center gap-2">
                <code className="text-sm bg-muted px-2 py-1 rounded font-mono flex-1 truncate" data-testid="text-template-id">
                  {template.id}
                </code>
                <Button
                  variant="secondary"
                  size="icon"
                  onClick={() => {
                    navigator.clipboard.writeText(template.id);
                    toast({ title: "Copied" });
                  }}
                  data-testid="button-copy-template-id"
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Mask Regions</p>
              <div className="space-y-2">
                {regions.map((r: any, i: number) => (
                  <div key={i} className="p-3 border rounded-md text-sm" data-testid={`region-detail-${i}`}>
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-medium">Page {r.pageNumber}</span>
                      <span className="text-muted-foreground text-xs">
                        ({Math.round(r.x)}, {Math.round(r.y)}) {Math.round(r.width)}x{Math.round(r.height)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <Link href="/verify">
              <Button className="w-full" data-testid="button-verify-with-template">
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Verify with this Template
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Code className="h-5 w-5" />
              API Integration
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Use this template via the REST API to verify signatures programmatically.
            </p>

            <div className="space-y-2">
              <p className="text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                <Key className="h-3 w-3" />
                Your API Key
              </p>
              <div className="flex items-center gap-2">
                <code className="text-xs bg-muted px-2 py-1.5 rounded font-mono flex-1 truncate" data-testid="text-api-key">
                  {user?.apiKey || "Not available"}
                </code>
                <Button
                  variant="secondary"
                  size="icon"
                  onClick={() => {
                    if (user?.apiKey) {
                      navigator.clipboard.writeText(user.apiKey);
                      toast({ title: "API key copied" });
                    }
                  }}
                  data-testid="button-copy-api-key"
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Example Request</p>
              <div className="relative">
                <pre className="text-xs bg-muted p-3 rounded-md overflow-x-auto font-mono whitespace-pre-wrap break-all" data-testid="text-curl-example">
                  {curlExample}
                </pre>
                <Button
                  variant="secondary"
                  size="icon"
                  className="absolute top-2 right-2"
                  onClick={() => {
                    navigator.clipboard.writeText(curlExample);
                    toast({ title: "Copied" });
                  }}
                  data-testid="button-copy-curl"
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Response Format</p>
              <pre className="text-xs bg-muted p-3 rounded-md overflow-x-auto font-mono">
{`{
  "verificationId": "uuid",
  "confidenceScore": 85.5,
  "matchMode": "${template.matchMode}",
  "bestMatch": {
    "file1Page": 1,
    "file2Page": 6
  },
  "comparisons": [...],
  "signature1Image": "data:image/png;base64,...",
  "signature2Image": "data:image/png;base64,..."
}`}
              </pre>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
