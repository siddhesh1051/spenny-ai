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

export default function SettingsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [fullName, setFullName] = useState("");
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
        .select(`full_name`)
        .eq("id", user.id)
        .single();
      if (error && error.code !== "PGRST116") {
        // PGRST116: "object not found"
        throw error;
      }
      if (data) {
        setFullName(data.full_name || "");
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

      alert("Profile updated successfully!");
    } catch (error: any) {
      alert(`Error updating profile: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return <div>Loading...</div>;
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
        <Button onClick={updateProfile} disabled={isSubmitting}>
          {isSubmitting ? "Saving..." : "Save Changes"}
        </Button>
      </CardContent>
    </Card>
  );
}
