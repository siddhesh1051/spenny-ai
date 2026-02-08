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

export default function WhatsAppIntegrationPage() {
  const [user, setUser] = useState<User | null>(null);
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
        const { data } = await supabase
          .from("profiles")
          .select("whatsapp_phone")
          .eq("id", user.id)
          .single();
        if (data) {
          setWhatsappPhone(data.whatsapp_phone || "");
        }
      }
      setLoading(false);
    };
    fetchUser();
  }, []);

  const saveWhatsAppNumber = async () => {
    if (!user) return;
    setIsSubmitting(true);
    try {
      const normalizedPhone = whatsappPhone.replace(/\D/g, "") || null;

      const { error } = await supabase
        .from("profiles")
        .update({
          whatsapp_phone: normalizedPhone,
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id);

      if (error) throw error;

      toast.success("WhatsApp number saved successfully!");
    } catch (error: any) {
      toast.error(`Error saving: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32 mb-2" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-32" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>WhatsApp Integration</CardTitle>
        <CardDescription>
          Add your WhatsApp number to add expenses via chat.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
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
            Include country code (e.g. +91 for India). Your number is used to
            link chat messages to your account.
            {whatsappPhone && whatsappPhone.replace(/\D/g, "").length > 0 && (
              <span className="block text-green-600 dark:text-green-400 mt-1">
                Stored as: {whatsappPhone.replace(/\D/g, "")}
              </span>
            )}
          </p>
        </div>
        <Button onClick={saveWhatsAppNumber} disabled={isSubmitting}>
          {isSubmitting ? "Saving..." : "Save WhatsApp Number"}
        </Button>
      </CardContent>
    </Card>
  );
}
