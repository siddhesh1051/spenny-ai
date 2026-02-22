import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Linking,
} from "react-native";
import { supabase } from "../lib/supabase";
import { useTheme } from "../context/ThemeContext";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../components/ui/Card";
import { Input } from "../components/ui/Input";
import { Button } from "../components/ui/Button";
import { Skeleton } from "../components/ui/Skeleton";
import { User, Key, Moon, Sun, Monitor, LogOut, ExternalLink, Eye, EyeOff, ChevronRight } from "lucide-react-native";
import Toast from "react-native-toast-message";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import WhatsAppSection from "../components/WhatsAppSection";

type Theme = "light" | "dark" | "system";

export default function SettingsScreen() {
  const { colors, theme, setTheme, isDark } = useTheme();
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [fullName, setFullName] = useState("");
  const [groqApiKey, setGroqApiKey] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showGroqKey, setShowGroqKey] = useState(false);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      if (user) {
        const { data } = await supabase
          .from("profiles")
          .select("full_name, groq_api_key")
          .eq("id", user.id)
          .single();
        if (data) {
          setFullName(data.full_name || "");
          setGroqApiKey(data.groq_api_key || "");
        }
      }
    } catch (err: any) {
      Toast.show({ type: "error", text1: "Failed to load profile" });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const { error: profileError } = await supabase.from("profiles").upsert({
        id: user.id,
        full_name: fullName,
        groq_api_key: groqApiKey,
        updated_at: new Date().toISOString(),
      });
      if (profileError) throw profileError;

      const { error: userError } = await supabase.auth.updateUser({
        data: { full_name: fullName },
      });
      if (userError) throw userError;

      Toast.show({ type: "success", text1: "Profile updated!" });
    } catch (err: any) {
      Toast.show({ type: "error", text1: "Failed to save", text2: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = () => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: () => supabase.auth.signOut(),
      },
    ]);
  };

  type ThemeOption = { value: Theme; label: string; icon: typeof Sun };
  const themeOptions: ThemeOption[] = [
    { value: "light", label: "Light", icon: Sun },
    { value: "dark", label: "Dark", icon: Moon },
    { value: "system", label: "System", icon: Monitor },
  ];

  if (loading) {
    return (
      <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.content}>
        <Skeleton height={80} borderRadius={12} style={{ marginBottom: 16 }} />
        <Skeleton height={160} borderRadius={12} style={{ marginBottom: 16 }} />
        <Skeleton height={120} borderRadius={12} />
      </ScrollView>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Profile Card */}
      <Card style={styles.card}>
        <CardHeader>
          <View style={styles.cardTitleRow}>
            <User size={18} color={colors.textMuted} />
            <CardTitle>Profile</CardTitle>
          </View>
          <CardDescription>Update your name and account info.</CardDescription>
        </CardHeader>
        <CardContent>
          <Input
            label="Email"
            value={user?.email || ""}
            editable={false}
            containerStyle={{ marginBottom: 12, opacity: 0.6 }}
          />
          <Input
            label="Full Name"
            value={fullName}
            onChangeText={setFullName}
            placeholder="Your name"
            containerStyle={{ marginBottom: 16 }}
          />
          <Button onPress={handleSave} loading={saving} disabled={saving}>
            Save Changes
          </Button>
        </CardContent>
      </Card>

      {/* API Key Card */}
      <Card style={styles.card}>
        <CardHeader>
          <View style={styles.cardTitleRow}>
            <Key size={18} color={colors.textMuted} />
            <CardTitle>Groq API Key</CardTitle>
          </View>
          <CardDescription>
            Used for AI-powered expense extraction.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <View style={styles.apiKeyRow}>
            <Input
              value={groqApiKey}
              onChangeText={setGroqApiKey}
              placeholder="gsk_..."
              secureTextEntry={!showGroqKey}
              containerStyle={{ flex: 1, marginBottom: 0 }}
            />
            <TouchableOpacity
              onPress={() => setShowGroqKey(!showGroqKey)}
              style={[styles.eyeBtn, { borderColor: colors.inputBorder, backgroundColor: colors.input }]}
            >
              {showGroqKey ? (
                <EyeOff size={18} color={colors.textMuted} />
              ) : (
                <Eye size={18} color={colors.textMuted} />
              )}
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            onPress={() => Linking.openURL("https://console.groq.com/keys")}
            style={[styles.linkRow, { marginTop: 10 }]}
          >
            <Text style={[styles.linkText, { color: colors.textMuted, textDecorationLine: "underline" }]}>
              Get your API key from Groq Console
            </Text>
            <ExternalLink size={13} color={colors.textMuted} />
          </TouchableOpacity>
          <Button onPress={handleSave} loading={saving} disabled={saving} style={{ marginTop: 12 }}>
            Save API Key
          </Button>
        </CardContent>
      </Card>

      {/* Theme Card */}
      <Card style={styles.card}>
        <CardHeader>
          <View style={styles.cardTitleRow}>
            {isDark ? <Moon size={18} color={colors.textMuted} /> : <Sun size={18} color={colors.textMuted} />}
            <CardTitle>Appearance</CardTitle>
          </View>
        </CardHeader>
        <CardContent>
          <View style={styles.themeRow}>
            {themeOptions.map(({ value, label, icon: Icon }) => (
              <TouchableOpacity
                key={value}
                onPress={() => setTheme(value)}
                style={[
                  styles.themeOption,
                  {
                    backgroundColor: theme === value ? (isDark ? "#27272a" : "#e4e4e7") : colors.input,
                    borderColor: theme === value ? colors.border : colors.inputBorder,
                  },
                ]}
              >
                <Icon size={18} color={theme === value ? colors.text : colors.textMuted} />
                <Text
                  style={[
                    styles.themeLabel,
                    { color: theme === value ? colors.text : colors.textMuted },
                  ]}
                >
                  {label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </CardContent>
      </Card>

      {/* WhatsApp Integration */}
      <WhatsAppSection user={user} />

      {/* Account Actions */}
      <Card style={{ ...(styles.card as object), marginBottom: 40 } as any}>
        <CardContent>
          <TouchableOpacity
            onPress={handleSignOut}
            style={[styles.signOutBtn, { borderColor: colors.destructive }]}
          >
            <LogOut size={18} color={colors.destructive} />
            <Text style={[styles.signOutText, { color: colors.destructive }]}>Sign Out</Text>
            <ChevronRight size={16} color={colors.destructive} style={{ marginLeft: "auto" }} />
          </TouchableOpacity>
        </CardContent>
      </Card>

      <Toast />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16 },
  card: { marginBottom: 16 },
  cardTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
    // icons use colors.textMuted not primary
  },
  apiKeyRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  eyeBtn: {
    width: 44,
    height: 44,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 0,
  },
  linkRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  linkText: { fontSize: 13, fontWeight: "500" },
  themeRow: { flexDirection: "row", gap: 8 },
  themeOption: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    gap: 6,
  },
  themeLabel: { fontSize: 13, fontWeight: "500" },
  signOutBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 10,
    borderWidth: 1.5,
  },
  signOutText: { fontSize: 15, fontWeight: "600" },
});
