import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import PWAInstallPrompt from "@/components/PWAInstallPrompt";

const AuthForm = ({
  action,
  email,
  setEmail,
  password,
  setPassword,
  isSubmitting,
  error,
  handleAuthAction,
}: {
  action: "signIn" | "signUp";
  email: string;
  setEmail: (value: string) => void;
  password: string;
  setPassword: (value: string) => void;
  isSubmitting: boolean;
  error: string | null;
  handleAuthAction: (action: "signIn" | "signUp") => void;
}) => (
  <div className="space-y-4 pt-4">
    <Input
      type="email"
      placeholder="Email"
      value={email}
      onChange={(e) => setEmail(e.target.value)}
      className="bg-background"
    />
    <Input
      type="password"
      placeholder="Password"
      value={password}
      onChange={(e) => setPassword(e.target.value)}
      className="bg-background"
    />
    {error && <p className="text-red-500 text-sm">{error}</p>}
    <Button
      onClick={() => handleAuthAction(action)}
      disabled={isSubmitting}
      className="w-full"
    >
      {isSubmitting
        ? "Processing..."
        : action === "signIn"
        ? "Sign In"
        : "Sign Up"}
    </Button>
  </div>
);

export default function AuthPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAuthAction = async (action: "signIn" | "signUp") => {
    setIsSubmitting(true);
    setError(null);
    try {
      const { error } =
        action === "signIn"
          ? await supabase.auth.signInWithPassword({ email, password })
          : await supabase.auth.signUp({ email, password });
      if (error) throw error;
      if (action === "signUp") {
        toast.success("Check your email for the confirmation link!");
      }
    } catch (error: any) {
      setError(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleLogin = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
      });
      if (error) throw error;
    } catch (error: any) {
      setError(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <PWAInstallPrompt />
      <div className="flex items-center justify-center min-h-screen bg-black px-2 sm:px-0">
        <Card className="w-full max-w-sm bg-zinc-900 border-zinc-700 text-white shadow-lg sm:rounded-xl sm:mx-0 mx-2">
          <CardHeader>
            <CardTitle>Welcome</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="signIn" className="w-full">
              <TabsList className="grid w-full grid-cols-2 bg-zinc-800">
                <TabsTrigger value="signIn">Sign In</TabsTrigger>
                <TabsTrigger value="signUp">Sign Up</TabsTrigger>
              </TabsList>
              <TabsContent value="signIn">
                <AuthForm
                  action="signIn"
                  email={email}
                  setEmail={setEmail}
                  password={password}
                  setPassword={setPassword}
                  isSubmitting={isSubmitting}
                  error={error}
                  handleAuthAction={handleAuthAction}
                />
              </TabsContent>
              <TabsContent value="signUp">
                <AuthForm
                  action="signUp"
                  email={email}
                  setEmail={setEmail}
                  password={password}
                  setPassword={setPassword}
                  isSubmitting={isSubmitting}
                  error={error}
                  handleAuthAction={handleAuthAction}
                />
              </TabsContent>
            </Tabs>
            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-zinc-700" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-zinc-900 px-2 text-muted-foreground">
                  Or continue with
                </span>
              </div>
            </div>
            <Button
              onClick={handleGoogleLogin}
              disabled={isSubmitting}
              className="w-full bg-zinc-800 hover:bg-zinc-700"
              variant="outline"
            >
              Sign In with Google
            </Button>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
