import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

export default function AuthPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
      // The user will be redirected by the AuthProvider
    } catch (error: any) {
      setError(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSignUp = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) throw error;
      toast.success("Check your email for the confirmation link!");
    } catch (error: any) {
      setError(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGitHubLogin = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "github",
      });
      if (error) throw error;
    } catch (error: any) {
      setError(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex items-center justify-center h-screen bg-background">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Welcome</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <div className="flex space-x-2">
              <Button
                onClick={handleLogin}
                disabled={isSubmitting}
                className="w-full"
              >
                {isSubmitting ? "Signing In..." : "Sign In"}
              </Button>
              <Button
                onClick={handleSignUp}
                disabled={isSubmitting}
                className="w-full"
                variant="outline"
              >
                {isSubmitting ? "Signing Up..." : "Sign Up"}
              </Button>
            </div>
            <Button
              onClick={handleGitHubLogin}
              disabled={isSubmitting}
              className="w-full"
              variant="outline"
            >
              Sign In with GitHub
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
