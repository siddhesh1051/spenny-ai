import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Linking,
  Modal,
  BackHandler,
} from "react-native";
import { supabase } from "../lib/supabase";
import { useTheme } from "../context/ThemeContext";
import { Card, CardContent } from "../components/ui/Card";
import { Input } from "../components/ui/Input";
import { Button } from "../components/ui/Button";
import { Skeleton } from "../components/ui/Skeleton";
import {
  User,
  Key,
  Moon,
  Sun,
  Monitor,
  LogOut,
  ExternalLink,
  Eye,
  EyeOff,
  ChevronRight,
  ChevronLeft,
  MessageCircle,
} from "lucide-react-native";
import Toast from "react-native-toast-message";
import { TOAST_PROPS } from "../lib/toastConfig";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import WhatsAppSection from "../components/WhatsAppSection";

type Theme = "light" | "dark" | "system";
type Section = null | "profile" | "appearance" | "whatsapp" | "groq";

export default function SettingsScreen() {
  const { colors, theme, setTheme, isDark } = useTheme();
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [fullName, setFullName] = useState("");
  const [groqApiKey, setGroqApiKey] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingApiKey, setSavingApiKey] = useState(false);
  const [showGroqKey, setShowGroqKey] = useState(false);
  const [activeSection, setActiveSection] = useState<Section>(null);
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);

  useEffect(() => {
    loadProfile();
  }, []);

  // Intercept Android hardware back button inside sub-screens
  useEffect(() => {
    if (activeSection === null) return;
    const handler = BackHandler.addEventListener("hardwareBackPress", () => {
      setActiveSection(null);
      return true; // swallow the event — don't let navigation handle it
    });
    return () => handler.remove();
  }, [activeSection]);

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

  const handleSaveProfile = async () => {
    if (!user) return;
    setSavingProfile(true);
    try {
      const { error: profileError } = await supabase.from("profiles").upsert({
        id: user.id,
        full_name: fullName,
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
      setSavingProfile(false);
    }
  };

  const handleSaveApiKey = async () => {
    if (!user) return;
    setSavingApiKey(true);
    try {
      const { error } = await supabase.from("profiles").upsert({
        id: user.id,
        groq_api_key: groqApiKey,
        updated_at: new Date().toISOString(),
      });
      if (error) throw error;
      Toast.show({ type: "success", text1: "API key saved!" });
    } catch (err: any) {
      Toast.show({ type: "error", text1: "Failed to save", text2: err.message });
    } finally {
      setSavingApiKey(false);
    }
  };

  const handleSignOut = () => setShowSignOutConfirm(true);

  type ThemeOption = { value: Theme; label: string; icon: typeof Sun };
  const themeOptions: ThemeOption[] = [
    { value: "light", label: "Light", icon: Sun },
    { value: "dark", label: "Dark", icon: Moon },
    { value: "system", label: "System", icon: Monitor },
  ];

  if (loading) {
    return (
      <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.content}>
        <Skeleton height={56} borderRadius={12} style={{ marginBottom: 8 }} />
        <Skeleton height={56} borderRadius={12} style={{ marginBottom: 8 }} />
        <Skeleton height={56} borderRadius={12} style={{ marginBottom: 8 }} />
        <Skeleton height={56} borderRadius={12} style={{ marginBottom: 24 }} />
        <Skeleton height={52} borderRadius={12} />
      </ScrollView>
    );
  }

  // ---- Back header shared by all sub-screens ----
  const BackHeader = ({ title }: { title: string }) => (
    <View style={styles.backHeader}>
      <TouchableOpacity
        onPress={() => setActiveSection(null)}
        style={styles.backBtn}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <ChevronLeft size={22} color={colors.text} />
      </TouchableOpacity>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>{title}</Text>
    </View>
  );

  // ---- Profile sub-screen ----
  if (activeSection === "profile") {
    return (
      <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.content}>
        <BackHeader title="Profile" />
        <Card style={styles.card}>
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
            <Button variant="secondary" onPress={handleSaveProfile} loading={savingProfile} disabled={savingProfile}>
              Save Changes
            </Button>
          </CardContent>
        </Card>
        <Toast {...TOAST_PROPS} />
      </ScrollView>
    );
  }

  // ---- Appearance sub-screen ----
  if (activeSection === "appearance") {
    return (
      <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.content}>
        <BackHeader title="Appearance" />
        <Card style={styles.card}>
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
                  <Text style={[styles.themeLabel, { color: theme === value ? colors.text : colors.textMuted }]}>
                    {label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </CardContent>
        </Card>
        <Toast {...TOAST_PROPS} />
      </ScrollView>
    );
  }

  // ---- WhatsApp sub-screen ----
  if (activeSection === "whatsapp") {
    return (
      <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.content}>
        <BackHeader title="WhatsApp Integration" />
        <WhatsAppSection user={user} />
        <Toast {...TOAST_PROPS} />
      </ScrollView>
    );
  }

  // ---- Groq API Key sub-screen ----
  if (activeSection === "groq") {
    return (
      <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.content}>
        <BackHeader title="Groq API Key" />
        <Card style={styles.card}>
          <CardContent>
            <Text style={[styles.subDesc, { color: colors.textMuted }]}>
              Used for AI-powered expense extraction.
            </Text>
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
            <Button variant="secondary" onPress={handleSaveApiKey} loading={savingApiKey} disabled={savingApiKey} style={{ marginTop: 16 }}>
              Save API Key
            </Button>
          </CardContent>
        </Card>
        <Toast {...TOAST_PROPS} />
      </ScrollView>
    );
  }

  // ---- Main settings list ----
  type SettingItem = { id: Section; icon: typeof User; label: string; description: string };
  const settingsItems: SettingItem[] = [
    {
      id: "profile",
      icon: User,
      label: "Profile",
      description: "Update your name and account info",
    },
    {
      id: "appearance",
      icon: isDark ? Moon : Sun,
      label: "Appearance",
      description: `${theme.charAt(0).toUpperCase() + theme.slice(1)} mode`,
    },
    {
      id: "whatsapp",
      icon: MessageCircle,
      label: "WhatsApp",
      description: "Add expenses via WhatsApp chat",
    },
    {
      id: "groq",
      icon: Key,
      label: "Groq API Key",
      description: "AI-powered expense extraction",
    },
  ];

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Settings list */}
      <Card style={styles.card}>
        {settingsItems.map(({ id, icon: Icon, label, description }, index) => (
          <TouchableOpacity
            key={id}
            onPress={() => setActiveSection(id)}
            style={[
              styles.settingsItem,
              {
                borderBottomColor: colors.border,
                borderBottomWidth: index < settingsItems.length - 1 ? StyleSheet.hairlineWidth : 0,
              },
            ]}
            activeOpacity={0.6}
          >
            <View style={[styles.settingsIconBox, { backgroundColor: colors.input, borderColor: colors.inputBorder }]}>
              <Icon size={17} color={colors.textMuted} />
            </View>
            <View style={styles.settingsItemContent}>
              <Text style={[styles.settingsItemLabel, { color: colors.text }]}>{label}</Text>
              <Text style={[styles.settingsItemDesc, { color: colors.textMuted }]} numberOfLines={1}>
                {description}
              </Text>
            </View>
            <ChevronRight size={17} color={colors.textMuted} />
          </TouchableOpacity>
        ))}
      </Card>

      {/* Sign Out */}
      <Card style={{ ...(styles.card as object), marginBottom: 40 } as any}>
        <TouchableOpacity
          onPress={handleSignOut}
          style={styles.signOutItem}
        >
          <LogOut size={18} color={colors.destructive} />
          <Text style={[styles.settingsItemLabel, { color: colors.destructive, flex: 1 }]}>Sign Out</Text>
          <ChevronRight size={17} color={colors.destructive} />
        </TouchableOpacity>
      </Card>

      {/* Sign Out Confirm Modal */}
      <Modal visible={showSignOutConfirm} transparent animationType="slide" onRequestClose={() => setShowSignOutConfirm(false)}>
        <TouchableOpacity style={styles.backdrop} onPress={() => setShowSignOutConfirm(false)} activeOpacity={1} />
        <View style={[styles.confirmSheet, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <View style={[styles.confirmIconWrap, { backgroundColor: "rgba(239,68,68,0.1)" }]}>
            <LogOut size={22} color={colors.destructive} />
          </View>
          <Text style={[styles.confirmTitle, { color: colors.text }]}>Sign Out</Text>
          <Text style={[styles.confirmDesc, { color: colors.textMuted }]}>
            Are you sure you want to sign out?
          </Text>
          <View style={styles.confirmActions}>
            <Button variant="outline" onPress={() => setShowSignOutConfirm(false)} style={{ flex: 1 }}>
              Cancel
            </Button>
            <Button variant="destructive" onPress={() => { setShowSignOutConfirm(false); supabase.auth.signOut(); }} style={{ flex: 1 }}>
              Sign Out
            </Button>
          </View>
        </View>
      </Modal>

      <Toast {...TOAST_PROPS} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 10, paddingVertical: 10 },
  card: { marginBottom: 8 },

  // Back header
  backHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 14,
  },
  backBtn: {
    padding: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
  },

  // Settings list items
  settingsItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  settingsIconBox: {
    width: 32,
    height: 32,
    borderRadius: 7,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  settingsItemContent: {
    flex: 1,
    gap: 1,
  },
  settingsItemLabel: {
    fontSize: 14,
    fontWeight: "600",
  },
  settingsItemDesc: {
    fontSize: 11,
  },
  signOutItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },

  // Confirm modal
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.6)" },
  confirmSheet: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, borderWidth: 1, paddingBottom: 44,
    alignItems: "center",
  },
  confirmIconWrap: {
    width: 52, height: 52, borderRadius: 26,
    alignItems: "center", justifyContent: "center", marginBottom: 14,
  },
  confirmTitle: { fontSize: 17, fontWeight: "700", marginBottom: 6, textAlign: "center" },
  confirmDesc: { fontSize: 13, textAlign: "center", lineHeight: 19, marginBottom: 4 },
  confirmActions: { flexDirection: "row", gap: 10, marginTop: 20, width: "100%" },

  // Sub-screen shared
  subDesc: {
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 14,
  },
  apiKeyRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  eyeBtn: {
    width: 44,
    height: 44,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
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
});
