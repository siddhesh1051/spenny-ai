import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardDescription,
  CardTitle,
} from "@/components/ui/card";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { User } from "@supabase/supabase-js";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/Skeleton";
import { useCurrency, CURRENCIES } from "@/context/CurrencyContext";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";

export default function SettingsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [fullName, setFullName] = useState("");
  const [groqApiKey, setGroqApiKey] = useState("");
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { currency, setCurrency, currencySymbol } = useCurrency();
  const [currencyOpen, setCurrencyOpen] = useState(false);
  const [currencySearch, setCurrencySearch] = useState("");

  const filteredCurrencies = useMemo(() => {
    const q = currencySearch.toLowerCase();
    if (!q) return CURRENCIES;
    return CURRENCIES.filter(
      (c) =>
        c.code.toLowerCase().includes(q) ||
        c.name.toLowerCase().includes(q) ||
        c.symbol.toLowerCase().includes(q)
    );
  }, [currencySearch]);

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
        .select(`full_name, groq_api_key`)
        .eq("id", user.id)
        .single();

      if (error && error.code !== "PGRST116") {
        throw error;
      }
      if (data) {
        setFullName(data.full_name || "");
        setGroqApiKey(data.groq_api_key || "");
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
        groq_api_key: groqApiKey,
        updated_at: new Date(),
      };
      const { error: profileError } = await supabase
        .from("profiles")
        .upsert(updates);
      if (profileError) throw profileError;

      const { error: userError } = await supabase.auth.updateUser({
        data: { full_name: fullName },
      });
      if (userError) throw userError;

      toast.success("Profile updated successfully!");
    } catch (error: any) {
      toast.error(`Error updating profile: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
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
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-32 mb-2" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  const selectedCurrency = CURRENCIES.find((c) => c.code === currency);

  return (
    <div className="space-y-4">
      {/* Profile card */}
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
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
        </CardContent>
      </Card>

      {/* Currency card */}
      <Card>
        <CardHeader>
          <CardTitle>Currency</CardTitle>
          <CardDescription>
            Choose the currency used to display all amounts across the app. Your preference is saved automatically.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium">Display Currency</label>
            <Popover open={currencyOpen} onOpenChange={(open) => {
              setCurrencyOpen(open);
              if (!open) setCurrencySearch("");
            }}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={currencyOpen}
                  className="w-full sm:w-80 justify-between font-normal"
                >
                  {selectedCurrency ? (
                    <span className="flex items-center gap-2">
                      <span className="font-semibold text-base w-6 text-center shrink-0">
                        {selectedCurrency.symbol}
                      </span>
                      <span>{selectedCurrency.code}</span>
                      <span className="text-muted-foreground">— {selectedCurrency.name}</span>
                    </span>
                  ) : (
                    "Select currency..."
                  )}
                  <ChevronsUpDown className="ml-auto h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full sm:w-80 p-0" align="start">
                {/* Search input */}
                <div className="flex items-center border-b px-3">
                  <Search className="h-4 w-4 shrink-0 text-muted-foreground mr-2" />
                  <input
                    className="flex h-10 w-full bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground"
                    placeholder="Search currency..."
                    value={currencySearch}
                    onChange={(e) => setCurrencySearch(e.target.value)}
                    autoFocus
                  />
                </div>
                {/* Currency list */}
                <div className="max-h-72 overflow-y-auto py-1">
                  {filteredCurrencies.length === 0 ? (
                    <div className="py-6 text-center text-sm text-muted-foreground">
                      No currency found.
                    </div>
                  ) : (
                    filteredCurrencies.map((c) => (
                      <button
                        key={c.code}
                        type="button"
                        className={cn(
                          "flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground cursor-pointer transition-colors",
                          currency === c.code && "bg-accent/50"
                        )}
                        onClick={async () => {
                          await setCurrency(c.code);
                          setCurrencyOpen(false);
                          setCurrencySearch("");
                          toast.success(`Currency changed to ${c.name} (${c.symbol})`);
                        }}
                      >
                        <span className="w-6 text-center font-semibold text-base shrink-0">
                          {c.symbol}
                        </span>
                        <span className="font-medium">{c.code}</span>
                        <span className="text-muted-foreground truncate">{c.name}</span>
                        {currency === c.code && (
                          <Check className="ml-auto h-4 w-4 shrink-0 text-primary" />
                        )}
                      </button>
                    ))
                  )}
                </div>
              </PopoverContent>
            </Popover>
            <p className="text-xs text-muted-foreground">
              Currently showing amounts in{" "}
              <span className="font-semibold">
                {currencySymbol} ({currency})
              </span>
              .
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
