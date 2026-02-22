import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Dimensions,
  StatusBar,
  Linking,
} from "react-native";
import * as WebBrowser from "expo-web-browser";
import { supabase } from "../lib/supabase";
import { useTheme } from "../context/ThemeContext";
import { Input } from "../components/ui/Input";
import { Button } from "../components/ui/Button";
import Toast from "react-native-toast-message";
import { TOAST_PROPS } from "../lib/toastConfig";

WebBrowser.maybeCompleteAuthSession();

// This deep-link URI must be added to your Supabase project:
//   Dashboard → Authentication → URL Configuration → Redirect URLs
//   Add: spenny-ai://auth/callback
const REDIRECT_URI = "spenny-ai://auth/callback";

const { width, height } = Dimensions.get("window");

type AuthMode = "signIn" | "signUp";

export default function AuthScreen() {
  const { colors, isDark } = useTheme();
  const [mode, setMode] = useState<AuthMode>("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Handle deep-link redirect from Google → Supabase → app
  useEffect(() => {
    const handleUrl = async ({ url }: { url: string }) => {
      if (!url.startsWith("spenny-ai://")) return;
      try {
        const { error } = await supabase.auth.exchangeCodeForSession(url);
        if (error) setError(error.message);
      } catch (e: any) {
        setError(e.message);
      }
    };

    // If app was opened from a cold start via deep link
    Linking.getInitialURL().then((url) => {
      if (url) handleUrl({ url });
    });

    const sub = Linking.addEventListener("url", handleUrl);
    return () => sub.remove();
  }, []);

  const handleEmailAuth = async () => {
    if (!email.trim() || !password.trim()) {
      setError("Please enter email and password");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      if (mode === "signIn") {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: {
              full_name: email.split("@")[0],
              groq_api_key: "",
            },
          },
        });
        if (error) throw error;
        Toast.show({
          type: "success",
          text1: "Check your email!",
          text2: "We sent you a confirmation link.",
        });
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          // Must match exactly what's in Supabase → Auth → Redirect URLs
          redirectTo: REDIRECT_URI,
          skipBrowserRedirect: true,
        },
      });

      if (error) throw error;
      if (!data.url) throw new Error("No OAuth URL returned");

      // Open browser and wait — WebBrowser intercepts the spenny-ai:// redirect
      const result = await WebBrowser.openAuthSessionAsync(data.url, REDIRECT_URI);

      if (result.type === "success" && result.url) {
        const { error: sessionError } = await supabase.auth.exchangeCodeForSession(result.url);
        if (sessionError) throw sessionError;
      } else if (result.type === "cancel") {
        // User closed the browser — no error needed
      }
    } catch (err: any) {
      setError(err.message || "Google sign-in failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: "#09090b" }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <StatusBar barStyle="light-content" backgroundColor="#09090b" />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Logo / Brand */}
        <View style={styles.brandContainer}>
          <View style={styles.logoCircle}>
            <Text style={styles.logoEmoji}>💸</Text>
          </View>
          <Text style={styles.brandName}>Spenny AI</Text>
          <Text style={styles.brandTagline}>Smart expense tracking, powered by AI</Text>
        </View>

        {/* Auth Card */}
        <View style={styles.card}>
          {/* Tab Switcher */}
          <View style={styles.tabSwitcher}>
            {(["signIn", "signUp"] as AuthMode[]).map((m) => (
              <TouchableOpacity
                key={m}
                onPress={() => { setMode(m); setError(null); }}
                style={[
                  styles.tab,
                  mode === m && styles.activeTab,
                ]}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.tabText,
                    mode === m ? styles.activeTabText : styles.inactiveTabText,
                  ]}
                >
                  {m === "signIn" ? "Sign In" : "Sign Up"}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Form */}
          <View style={styles.form}>
            <Input
              label="Email"
              placeholder="you@example.com"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              containerStyle={styles.inputContainer}
            />
            <Input
              label="Password"
              placeholder="••••••••"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              containerStyle={styles.inputContainer}
            />

            {error && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            <Button
              onPress={handleEmailAuth}
              loading={isLoading}
              disabled={isLoading}
              style={styles.authButton}
            >
              {mode === "signIn" ? "Sign In" : "Create Account"}
            </Button>
          </View>

          {/* Divider */}
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or continue with</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Google Button */}
          <TouchableOpacity
            onPress={handleGoogleLogin}
            disabled={isLoading}
            style={[styles.googleButton, isLoading && { opacity: 0.6 }]}
            activeOpacity={0.8}
          >
            <Text style={styles.googleIcon}>G</Text>
            <Text style={styles.googleButtonText}>Sign in with Google</Text>
          </TouchableOpacity>
        </View>

        {/* Footer */}
        <Text style={styles.footer}>
          By continuing, you agree to our Terms of Service
        </Text>
      </ScrollView>
      <Toast {...TOAST_PROPS} />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingVertical: 40,
  },
  brandContainer: {
    alignItems: "center",
    marginBottom: 32,
  },
  logoCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#18181b",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#27272a",
  },
  logoEmoji: { fontSize: 32 },
  brandName: {
    fontSize: 28,
    fontWeight: "700",
    color: "#fafafa",
    letterSpacing: -0.5,
  },
  brandTagline: {
    fontSize: 14,
    color: "#71717a",
    marginTop: 6,
    textAlign: "center",
  },
  card: {
    backgroundColor: "#18181b",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#27272a",
    padding: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  tabSwitcher: {
    flexDirection: "row",
    backgroundColor: "#27272a",
    borderRadius: 8,
    padding: 4,
    marginBottom: 20,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
    borderRadius: 6,
  },
  activeTab: { backgroundColor: "#3f3f46" },
  tabText: { fontSize: 14, fontWeight: "500" },
  activeTabText: { color: "#fafafa" },
  inactiveTabText: { color: "#71717a" },
  form: { gap: 16 },
  inputContainer: { marginBottom: 0 },
  errorBox: {
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.3)",
  },
  errorText: { color: "#ef4444", fontSize: 13 },
  authButton: { marginTop: 4, paddingVertical: 13, borderRadius: 6 },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 20,
    gap: 12,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: "#27272a" },
  dividerText: { color: "#71717a", fontSize: 12, fontWeight: "500", textTransform: "uppercase", letterSpacing: 0.5 },
  googleButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#27272a",
    borderRadius: 8,
    paddingVertical: 13,
    gap: 10,
    borderWidth: 1,
    borderColor: "#3f3f46",
  },
  googleIcon: {
    fontSize: 16,
    fontWeight: "700",
    color: "#4285f4",
  },
  googleButtonText: { color: "#fafafa", fontSize: 15, fontWeight: "500" },
  footer: {
    textAlign: "center",
    color: "#52525b",
    fontSize: 12,
    marginTop: 24,
  },
});
