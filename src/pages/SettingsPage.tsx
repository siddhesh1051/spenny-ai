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
  const [groqApiKey, setGroqApiKey] = useState("");
  const [whatsappPhone, setWhatsappPhone] = useState("");
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
        .select(`full_name, groq_api_key, whatsapp_phone`)
        .eq("id", user.id)
        .single();

      if (error && error.code !== "PGRST116") {
        // PGRST116: "object not found"
        throw error;
      }
      if (data) {
        setFullName(data.full_name || "");
        setGroqApiKey(data.groq_api_key || "");
        setWhatsappPhone(data.whatsapp_phone || "");
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
      // Normalize phone: strip everything except digits
      const normalizedPhone = whatsappPhone.replace(/\D/g, "") || null;

      const updates = {
        id: user.id,
        full_name: fullName,
        groq_api_key: groqApiKey,
        whatsapp_phone: normalizedPhone,
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
          <label htmlFor="whatsappPhone">WhatsApp Number</label>
          <Input
            id="whatsappPhone"
            type="tel"
            value={whatsappPhone}
            onChange={(e) => setWhatsappPhone(e.target.value)}
            placeholder="e.g. +91 98765 43210"
          />
          <p className="text-sm text-muted-foreground mt-1">
            Link your WhatsApp number to add expenses via chat. Include country
            code (e.g. +91 for India).
            {whatsappPhone && whatsappPhone.replace(/\D/g, "").length > 0 && (
              <span className="block text-green-600 dark:text-green-400 mt-1">
                Stored as: {whatsappPhone.replace(/\D/g, "")}
              </span>
            )}
          </p>
        </div>
        <div>
          <label htmlFor="groqApiKey">Groq API Key</label>
          <Input
            id="groqApiKey"
            type="password"
            value={groqApiKey}
            onChange={(e) => setGroqApiKey(e.target.value)}
            placeholder="Enter your Groq API Key"
          />
          <p className="text-sm text-muted-foreground mt-1">
            Get your API key from{" "}
            <a
              href="https://console.groq.com/keys"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              Groq Console
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
