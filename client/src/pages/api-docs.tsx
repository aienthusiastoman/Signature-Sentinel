import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Code, Copy, Key, Send, FileText, ArrowRight } from "lucide-react";

export default function ApiDocs() {
  const { user } = useAuth();
  const { toast } = useToast();

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied to clipboard" });
  };

  return (
    <div className="space-y-6" data-testid="api-docs-page">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2" data-testid="text-page-title">
          <Code className="h-6 w-6" />
          API Documentation
        </h1>
        <p className="text-muted-foreground">Integrate signature verification into your applications</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Key className="h-5 w-5" />
            Authentication
          </CardTitle>
          <CardDescription>Include your API key in the request header</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2">
            <code className="text-sm bg-muted px-3 py-1.5 rounded font-mono flex-1 truncate" data-testid="text-api-key">
              {user?.apiKey || "Login to see your API key"}
            </code>
            <Button
              variant="secondary"
              size="icon"
              onClick={() => user?.apiKey && copyToClipboard(user.apiKey)}
              data-testid="button-copy-api-key"
            >
              <Copy className="h-3.5 w-3.5" />
            </Button>
          </div>
          <div className="bg-muted rounded-md p-3">
            <code className="text-xs font-mono">X-API-Key: {user?.apiKey || "YOUR_API_KEY"}</code>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Send className="h-5 w-5" />
            POST /api/v1/verify
          </CardTitle>
          <CardDescription>Verify signatures between two PDF documents</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <p className="text-sm font-medium">Request</p>
            <div className="bg-muted rounded-md p-3 space-y-1">
              <p className="text-xs font-mono text-muted-foreground">Content-Type: multipart/form-data</p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2 p-2 border rounded-md">
                <Badge variant="secondary" className="text-xs font-mono">templateId</Badge>
                <span className="text-sm text-muted-foreground">string (required) - Template ID to use</span>
              </div>
              <div className="flex items-center gap-2 p-2 border rounded-md">
                <Badge variant="secondary" className="text-xs font-mono">file1</Badge>
                <span className="text-sm text-muted-foreground">file (required) - First PDF document</span>
              </div>
              <div className="flex items-center gap-2 p-2 border rounded-md">
                <Badge variant="secondary" className="text-xs font-mono">file2</Badge>
                <span className="text-sm text-muted-foreground">file (required) - Second PDF document</span>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">Example (cURL)</p>
            <div className="relative">
              <pre className="text-xs bg-muted p-3 rounded-md overflow-x-auto font-mono whitespace-pre-wrap">
{`curl -X POST "${window.location.origin}/api/v1/verify" \\
  -H "X-API-Key: ${user?.apiKey || 'YOUR_API_KEY'}" \\
  -F "templateId=TEMPLATE_ID" \\
  -F "file1=@document1.pdf" \\
  -F "file2=@document2.pdf"`}
              </pre>
              <Button
                variant="secondary"
                size="icon"
                className="absolute top-2 right-2"
                onClick={() => copyToClipboard(`curl -X POST "${window.location.origin}/api/v1/verify" \\\n  -H "X-API-Key: ${user?.apiKey || 'YOUR_API_KEY'}" \\\n  -F "templateId=TEMPLATE_ID" \\\n  -F "file1=@document1.pdf" \\\n  -F "file2=@document2.pdf"`)}
                data-testid="button-copy-curl"
              >
                <Copy className="h-3 w-3" />
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">Response</p>
            <pre className="text-xs bg-muted p-3 rounded-md overflow-x-auto font-mono">
{`{
  "verificationId": "uuid-string",
  "confidenceScore": 85.5,
  "matchMode": "relaxed",
  "bestMatch": {
    "file1Page": 1,
    "file2Page": 6
  },
  "comparisons": [
    {
      "file1Page": 1,
      "file2Page": 6,
      "rawScore": 68.4,
      "adjustedScore": 85.5
    }
  ],
  "signature1Image": "data:image/png;base64,...",
  "signature2Image": "data:image/png;base64,..."
}`}
            </pre>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">Response Fields</p>
            <div className="space-y-1.5">
              <div className="flex items-start gap-2 p-2 border rounded-md text-sm">
                <Badge variant="secondary" className="text-xs font-mono flex-shrink-0 mt-0.5">confidenceScore</Badge>
                <span className="text-muted-foreground">Highest adjusted match score (0-100)</span>
              </div>
              <div className="flex items-start gap-2 p-2 border rounded-md text-sm">
                <Badge variant="secondary" className="text-xs font-mono flex-shrink-0 mt-0.5">bestMatch</Badge>
                <span className="text-muted-foreground">Page numbers of the best matching signatures</span>
              </div>
              <div className="flex items-start gap-2 p-2 border rounded-md text-sm">
                <Badge variant="secondary" className="text-xs font-mono flex-shrink-0 mt-0.5">comparisons</Badge>
                <span className="text-muted-foreground">All page-to-page comparison results</span>
              </div>
              <div className="flex items-start gap-2 p-2 border rounded-md text-sm">
                <Badge variant="secondary" className="text-xs font-mono flex-shrink-0 mt-0.5">signature*Image</Badge>
                <span className="text-muted-foreground">Base64 PNG snapshots of extracted signatures</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Error Codes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 p-2 border rounded-md text-sm">
              <Badge variant="destructive" className="text-xs">401</Badge>
              <span className="text-muted-foreground">Missing or invalid API key</span>
            </div>
            <div className="flex items-center gap-2 p-2 border rounded-md text-sm">
              <Badge variant="destructive" className="text-xs">400</Badge>
              <span className="text-muted-foreground">Missing required fields (templateId, file1, file2)</span>
            </div>
            <div className="flex items-center gap-2 p-2 border rounded-md text-sm">
              <Badge variant="destructive" className="text-xs">404</Badge>
              <span className="text-muted-foreground">Template not found</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
