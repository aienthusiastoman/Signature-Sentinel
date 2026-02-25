import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { Users, Trash2, Shield, User as UserIcon, Clock } from "lucide-react";

interface SafeUser {
  id: string;
  username: string;
  role: string;
  apiKey: string | null;
  createdAt: string | null;
}

export default function AdminUsers() {
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const { data: users, isLoading } = useQuery<SafeUser[]>({ queryKey: ["/api/admin/users"] });

  const updateRoleMutation = useMutation({
    mutationFn: async ({ id, role }: { id: string; role: string }) => {
      await apiRequest("PATCH", `/api/admin/users/${id}/role`, { role });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "Role updated" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/admin/users/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "User deleted" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  if (currentUser?.role !== "admin") {
    return (
      <div className="text-center py-12">
        <Shield className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
        <h2 className="text-lg font-medium">Access Denied</h2>
        <p className="text-muted-foreground">Admin access is required to manage users</p>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="admin-users-page">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2" data-testid="text-page-title">
          <Users className="h-6 w-6" />
          User Management
        </h1>
        <p className="text-muted-foreground">Manage user accounts and roles</p>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full rounded-md" />)}
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="divide-y">
              {(users || []).map(u => (
                <div key={u.id} className="flex items-center gap-4 p-4" data-testid={`user-row-${u.id}`}>
                  <div className={`h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0 ${u.role === "admin" ? "bg-primary/10" : "bg-muted"}`}>
                    {u.role === "admin" ? (
                      <Shield className="h-5 w-5 text-primary" />
                    ) : (
                      <UserIcon className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{u.username}</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">
                          {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : ""}
                        </span>
                      </div>
                      {u.id === currentUser?.id && (
                        <Badge variant="secondary" className="text-xs">You</Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Select
                      value={u.role}
                      onValueChange={(role) => updateRoleMutation.mutate({ id: u.id, role })}
                      disabled={u.id === currentUser?.id}
                    >
                      <SelectTrigger className="w-24" data-testid={`select-role-${u.id}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="user">User</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={u.id === currentUser?.id}
                      onClick={() => deleteMutation.mutate(u.id)}
                      data-testid={`button-delete-user-${u.id}`}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
