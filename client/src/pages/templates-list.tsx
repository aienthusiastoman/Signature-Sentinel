import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, FileText, Trash2, Copy, Settings } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Template } from "@shared/schema";

export default function TemplatesList() {
  const { data: templates, isLoading } = useQuery<Template[]>({ queryKey: ["/api/templates"] });
  const { toast } = useToast();

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/templates/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/templates"] });
      toast({ title: "Template deleted" });
    },
  });

  return (
    <div className="space-y-6" data-testid="templates-page">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">Templates</h1>
          <p className="text-muted-foreground">Manage your signature mask templates</p>
        </div>
        <Link href="/templates/new">
          <Button data-testid="button-create-template">
            <Plus className="mr-2 h-4 w-4" />
            Create Template
          </Button>
        </Link>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-40 w-full rounded-md" />)}
        </div>
      ) : (templates || []).length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="text-lg font-medium mb-1">No templates yet</h3>
            <p className="text-muted-foreground mb-4">Create your first mask template to start verifying signatures</p>
            <Link href="/templates/new">
              <Button data-testid="button-create-first-template">
                <Plus className="mr-2 h-4 w-4" />
                Create Template
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {templates!.map(t => (
            <Card key={t.id} className="group" data-testid={`card-template-${t.id}`}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="h-9 w-9 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <FileText className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-medium text-sm leading-tight">{t.name}</h3>
                      {t.description && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{t.description}</p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="secondary">
                    {(t.maskRegions as any[])?.length || 0} region{((t.maskRegions as any[])?.length || 0) !== 1 ? "s" : ""}
                  </Badge>
                  <Badge variant="secondary">{t.matchMode}</Badge>
                  <Badge variant="secondary">{t.dpi} DPI</Badge>
                </div>

                <div className="flex items-center gap-1.5 pt-1">
                  <Link href={`/templates/${t.id}`}>
                    <Button variant="secondary" size="sm" data-testid={`button-view-template-${t.id}`}>
                      <Settings className="mr-1.5 h-3.5 w-3.5" />
                      Details
                    </Button>
                  </Link>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      navigator.clipboard.writeText(t.id);
                      toast({ title: "Template ID copied" });
                    }}
                    data-testid={`button-copy-id-${t.id}`}
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteMutation.mutate(t.id)}
                    data-testid={`button-delete-template-${t.id}`}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
