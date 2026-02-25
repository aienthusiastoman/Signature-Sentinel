import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Shield, PenTool, Eye, ArrowRight } from "lucide-react";

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { login, register } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) return;

    setLoading(true);
    try {
      if (isLogin) {
        await login(username, password);
      } else {
        await register(username, password);
      }
      setLocation("/");
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Authentication failed",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex" data-testid="auth-page">
      <div className="flex-1 flex items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-1">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-10 w-10 rounded-md bg-primary flex items-center justify-center">
                <PenTool className="h-5 w-5 text-primary-foreground" />
              </div>
              <span className="font-semibold text-lg">SignVerify</span>
            </div>
            <CardTitle className="text-2xl" data-testid="text-auth-title">
              {isLogin ? "Welcome back" : "Create an account"}
            </CardTitle>
            <CardDescription>
              {isLogin
                ? "Enter your credentials to access your dashboard"
                : "Get started with signature verification"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  data-testid="input-username"
                  placeholder="Enter your username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  data-testid="input-password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={isLogin ? "current-password" : "new-password"}
                />
              </div>
              <Button
                type="submit"
                className="w-full"
                disabled={loading}
                data-testid="button-submit-auth"
              >
                {loading ? "Please wait..." : isLogin ? "Sign in" : "Create account"}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </form>
            <div className="mt-4 text-center">
              <button
                type="button"
                className="text-sm text-muted-foreground hover:underline"
                onClick={() => setIsLogin(!isLogin)}
                data-testid="button-toggle-auth"
              >
                {isLogin
                  ? "Don't have an account? Sign up"
                  : "Already have an account? Sign in"}
              </button>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="hidden lg:flex flex-1 bg-primary/5 items-center justify-center p-12">
        <div className="max-w-lg space-y-8">
          <h1 className="text-4xl font-bold tracking-tight">
            Signature Verification
            <br />
            <span className="text-primary">Made Simple</span>
          </h1>
          <p className="text-lg text-muted-foreground leading-relaxed">
            Create mask templates to define signature regions on your documents,
            then verify signatures across PDF files with advanced curve-based
            similarity analysis.
          </p>
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="h-8 w-8 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                <PenTool className="h-4 w-4 text-primary" />
              </div>
              <div>
                <h3 className="font-medium">Draw Mask Regions</h3>
                <p className="text-sm text-muted-foreground">
                  Visually define where signatures appear on your document pages
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="h-8 w-8 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Eye className="h-4 w-4 text-primary" />
              </div>
              <div>
                <h3 className="font-medium">Compare & Analyze</h3>
                <p className="text-sm text-muted-foreground">
                  Get confidence scores with side-by-side signature snapshots
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="h-8 w-8 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Shield className="h-4 w-4 text-primary" />
              </div>
              <div>
                <h3 className="font-medium">API Access</h3>
                <p className="text-sm text-muted-foreground">
                  Integrate verification into your workflow via REST API
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
