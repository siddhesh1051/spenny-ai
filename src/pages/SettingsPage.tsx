import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import type { User } from "@supabase/supabase-js";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/Skeleton";
import ApiKeysManagement from "../components/ApiKeysManagement";

export default function SettingsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [fullName, setFullName] = useState("");
  const [geminiApiKey, setGeminiApiKey] = useState("");
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const fetchUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUser(user);
      if (user) {
        getProfile(user);
      } else {
        setLoading(false);
      }
    };
    fetchUser();
  }, []);

  const getProfile = async (user: User) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select(`full_name, gemini_api_key`)
        .eq("id", user.id)
        .single();
      if (error && error.code !== "PGRST116") {
        // PGRST116: "object not found"
        throw error;
      }
      if (data) {
        setFullName(data.full_name || "");
        setGeminiApiKey(data.gemini_api_key || "");
      }
    } catch (error: any) {
      console.error("Error fetching profile:", error.message);
    } finally {
      setLoading(false);
    }
  };

  const updateProfile = async () => {
    if (!user) return;
    setIsSubmitting(true);
    try {
      const updates = {
        id: user.id,
        full_name: fullName,
        gemini_api_key: geminiApiKey,
        updated_at: new Date(),
      };
      // update the profile table
      const { error: profileError } = await supabase
        .from("profiles")
        .upsert(updates);
      if (profileError) {
        throw profileError;
      }

      // update the user metadata
      const { error: userError } = await supabase.auth.updateUser({
        data: { full_name: fullName },
      });

      if (userError) {
        throw userError;
      }

      toast.success("Profile updated successfully!");
    } catch (error: any) {
      toast.error(`Error updating profile: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32 mb-2" />
          <Skeleton className="h-4 w-48" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-32" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Settings</CardTitle>
        <CardDescription>Update your profile information.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <label htmlFor="email">Email</label>
          <Input id="email" type="email" value={user?.email || ""} disabled />
        </div>
        <div>
          <label htmlFor="fullName">Full Name</label>
          <Input
            id="fullName"
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Your name"
          />
        </div>
        <div>
          <label htmlFor="geminiApiKey">Gemini API Key</label>
          <Input
            id="geminiApiKey"
            type="password"
            value={geminiApiKey}
            onChange={(e) => setGeminiApiKey(e.target.value)}
            placeholder="Enter your Gemini API Key"
          />
          <p className="text-sm text-muted-foreground mt-1">
            Get your API key from{" "}
            <a
              href="https://aistudio.google.com/app/apikey"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              Google AI Studio
            </a>
            . Your key is stored securely and only used by you.
          </p>
        </div>
        <Button onClick={updateProfile} disabled={isSubmitting}>
          {isSubmitting ? "Saving..." : "Save Changes"}
        </Button>
        <ApiKeysManagement />
      </CardContent>
    </Card>
  );
}
