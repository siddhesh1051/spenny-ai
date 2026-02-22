import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
} from "react-native";
import { supabase } from "../lib/supabase";
import { useTheme } from "../context/ThemeContext";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Skeleton } from "../components/ui/Skeleton";
import { CheckCircle, Send, RefreshCw } from "lucide-react-native";
import Toast from "react-native-toast-message";
import { TOAST_PROPS } from "../lib/toastConfig";
import type { User } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

type VerificationStep = "enter_phone" | "enter_otp" | "verified";

export default function WhatsAppScreen() {
  const { colors } = useTheme();
  const [user, setUser] = useState<User | null>(null);
  const [countryCode, setCountryCode] = useState("91");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [savedPhone, setSavedPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [verificationStep, setVerificationStep] = useState<VerificationStep>("enter_phone");
  const [otpError, setOtpError] = useState("");

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      if (user) {
        const { data } = await supabase
          .from("profiles")
          .select("whatsapp_phone")
          .eq("id", user.id)
          .single();
        if (data?.whatsapp_phone) {
          const phone = data.whatsapp_phone;
          if (phone.startsWith("91") && phone.length > 2) {
            setCountryCode("91");
            setPhoneNumber(phone.substring(2));
          } else {
            setPhoneNumber(phone);
          }
          setSavedPhone(phone);
          setVerificationStep("verified");
        }
      }
    } catch (err) {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  const sendOTP = async () => {
    if (!user) return;
    setIsSubmitting(true);
    try {
      const fullPhone = countryCode + phoneNumber.replace(/\D/g, "");
      if (phoneNumber.replace(/\D/g, "").length < 10) {
        Toast.show({ type: "error", text1: "Invalid number", text2: "Please enter a valid 10-digit number." });
        return;
      }
      if (savedPhone && fullPhone === savedPhone) {
        Toast.show({ type: "info", text1: "Already verified", text2: "This number is already linked." });
        return;
      }

      const response = await fetch(`${SUPABASE_URL}/functions/v1/send-whatsapp-otp`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ phone: fullPhone, userId: user.id }),
      });

      const data = await response.json();
      if (!response.ok) {
        Toast.show({ type: "error", text1: "Failed to send OTP", text2: data.error || "Please try again." });
        return;
      }

      setVerificationStep("enter_otp");
      Toast.show({ type: "success", text1: "OTP sent!", text2: "Check your WhatsApp." });
    } catch (err: any) {
      Toast.show({ type: "error", text1: "Error", text2: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const verifyOTP = async () => {
    if (!user) return;
    setIsSubmitting(true);
    setOtpError("");
    try {
      if (otp.length !== 4) {
        setOtpError("Please enter all 4 digits");
        return;
      }

      const fullPhone = countryCode + phoneNumber.replace(/\D/g, "");
      const response = await fetch(`${SUPABASE_URL}/functions/v1/verify-whatsapp-otp`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ phone: fullPhone, otp, userId: user.id }),
      });

      const data = await response.json();
      if (!response.ok) {
        const errorMessage = data.error || "Failed to verify OTP.";
        setOtpError(errorMessage);
        Toast.show({ type: "error", text1: "Verification failed", text2: errorMessage });
        return;
      }

      setSavedPhone(fullPhone);
      setVerificationStep("verified");
      setOtp("");
      setOtpError("");
      Toast.show({ type: "success", text1: "WhatsApp verified!", text2: "You can now add expenses via WhatsApp." });
    } catch (err: any) {
      const msg = err.message || "Failed to verify.";
      setOtpError(msg);
      Toast.show({ type: "error", text1: "Error", text2: msg });
    } finally {
      setIsSubmitting(false);
    }
  };

  const unlinkNumber = async () => {
    if (!user) return;
    Alert.alert("Unlink Number", "Remove your WhatsApp number?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Unlink",
        style: "destructive",
        onPress: async () => {
          setIsSubmitting(true);
          try {
            const { error } = await supabase
              .from("profiles")
              .update({ whatsapp_phone: null, updated_at: new Date().toISOString() })
              .eq("id", user.id);
            if (error) throw error;
            setSavedPhone("");
            setPhoneNumber("");
            setOtp("");
            setVerificationStep("enter_phone");
            Toast.show({ type: "success", text1: "Number unlinked." });
          } catch (err: any) {
            Toast.show({ type: "error", text1: "Failed to unlink" });
          } finally {
            setIsSubmitting(false);
          }
        },
      },
    ]);
  };

  const changeNumber = () => {
    setPhoneNumber("");
    setOtp("");
    setOtpError("");
    setVerificationStep("enter_phone");
  };

  // OTP input digits
  const otpDigits = otp.split("").concat(Array(4 - otp.length).fill(""));

  if (loading) {
    return (
      <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.content}>
        <Skeleton height={200} borderRadius={12} />
      </ScrollView>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Info Banner */}
      <Card style={{ ...(styles.infoBanner as object), backgroundColor: colors.card, borderColor: colors.cardBorder } as any}>
        <Text style={{ fontSize: 28, marginBottom: 8 }}>💬</Text>
        <CardTitle style={{ color: colors.text, marginBottom: 4 }}>WhatsApp Integration</CardTitle>
        <CardDescription>
          Link your WhatsApp number to add expenses, query your spending, and export data — all through chat.
        </CardDescription>
      </Card>

      {verificationStep === "verified" ? (
        <Card style={styles.card}>
          {/* Verified State */}
          <View style={[styles.verifiedBadge, { backgroundColor: colors.successBg, borderColor: "#22c55e30" }]}>
            <CheckCircle size={22} color={colors.success} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.verifiedTitle, { color: colors.success }]}>
                WhatsApp Verified
              </Text>
              <Text style={[styles.verifiedPhone, { color: colors.text }]}>
                +{savedPhone}
              </Text>
            </View>
          </View>

          <View style={styles.btnRow}>
            <Button variant="outline" onPress={changeNumber} style={{ flex: 1 }}>
              Change Number
            </Button>
            <Button variant="destructive" onPress={unlinkNumber} loading={isSubmitting} disabled={isSubmitting} style={{ flex: 1 }}>
              Unlink
            </Button>
          </View>

          {/* Usage instructions */}
          <View style={[styles.instructionsBox, { backgroundColor: colors.card, borderColor: colors.border, marginTop: 16 }]}>
            <Text style={[styles.instructionsTitle, { color: colors.text }]}>How to use:</Text>
            {[
              ["💬 Log expenses", "\"Spent 150 on lunch\""],
              ["🔍 Query spending", "\"How much did I spend this week?\""],
              ["📊 Export data", "\"Export last month as CSV\""],
            ].map(([title, example]) => (
              <View key={title} style={styles.instructionItem}>
                <Text style={[styles.instructionTitle, { color: colors.text }]}>{title}</Text>
                <Text style={[styles.instructionExample, { color: colors.textMuted }]}>{example}</Text>
              </View>
            ))}
          </View>
        </Card>
      ) : verificationStep === "enter_phone" ? (
        <Card style={styles.card}>
          <CardHeader>
            <CardTitle>Enter Your WhatsApp Number</CardTitle>
            <CardDescription>
              We'll send a verification code to this number.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <View style={styles.phoneRow}>
              <View style={[styles.countryCodeBox, { borderColor: colors.inputBorder, backgroundColor: colors.input }]}>
                <Text style={[styles.countryCodePlus, { color: colors.textMuted }]}>+</Text>
                <TextInput
                  value={countryCode}
                  onChangeText={(v) => setCountryCode(v.replace(/\D/g, ""))}
                  keyboardType="numeric"
                  maxLength={3}
                  style={[styles.countryCodeInput, { color: colors.text }]}
                  placeholderTextColor={colors.textSecondary}
                />
              </View>
              <TextInput
                value={phoneNumber}
                onChangeText={(v) => setPhoneNumber(v.replace(/\D/g, ""))}
                keyboardType="phone-pad"
                placeholder="9876543210"
                placeholderTextColor={colors.textSecondary}
                maxLength={15}
                style={[styles.phoneInput, { flex: 1, color: colors.text, borderColor: colors.inputBorder, backgroundColor: colors.input }]}
              />
            </View>
            {phoneNumber.length > 0 && (
              <Text style={[styles.previewText, { color: colors.info }]}>
                Will verify: +{countryCode} {phoneNumber}
              </Text>
            )}
            <Button
              onPress={sendOTP}
              loading={isSubmitting}
              disabled={isSubmitting || phoneNumber.replace(/\D/g, "").length < 10}
              style={{ marginTop: 16 }}
            >
              Send Verification Code
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card style={styles.card}>
          <CardHeader>
            <CardTitle>Enter Verification Code</CardTitle>
            <CardDescription>
              Enter the 4-digit code sent to +{countryCode} {phoneNumber} via WhatsApp. Expires in 10 minutes.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* OTP Input - 4 boxes */}
            <View style={styles.otpRow}>
              <TextInput
                value={otp}
                onChangeText={(v) => {
                  const digits = v.replace(/\D/g, "").slice(0, 4);
                  setOtp(digits);
                  setOtpError("");
                }}
                keyboardType="numeric"
                maxLength={4}
                style={styles.hiddenOtpInput}
                autoFocus
                caretHidden
              />
              {[0, 1, 2, 3].map((i) => (
                <View
                  key={i}
                  style={[
                    styles.otpBox,
                    {
                      borderColor: otpError
                        ? colors.destructive
                        : otp.length === i
                        ? colors.text
                        : colors.inputBorder,
                      backgroundColor: colors.input,
                    },
                  ]}
                >
                  <Text style={[styles.otpDigit, { color: colors.text }]}>
                    {otpDigits[i] || ""}
                  </Text>
                </View>
              ))}
            </View>

            {otpError ? (
              <Text style={[styles.otpError, { color: colors.destructive }]}>⚠️ {otpError}</Text>
            ) : null}

            <Button
              onPress={verifyOTP}
              loading={isSubmitting}
              disabled={isSubmitting || otp.length !== 4}
              style={{ marginTop: 16 }}
            >
              Verify & Save
            </Button>

            <View style={styles.btnRow}>
              <Button variant="ghost" onPress={changeNumber} disabled={isSubmitting} style={{ flex: 1 }}>
                Change Number
              </Button>
              <Button variant="ghost" onPress={sendOTP} disabled={isSubmitting} style={{ flex: 1 }}>
                Resend Code
              </Button>
            </View>
          </CardContent>
        </Card>
      )}
      <Toast {...TOAST_PROPS} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  infoBanner: {
    marginBottom: 16,
    alignItems: "flex-start",
  },
  card: { marginBottom: 16 },
  verifiedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 16,
  },
  verifiedTitle: { fontSize: 14, fontWeight: "600" },
  verifiedPhone: { fontSize: 16, fontWeight: "700", marginTop: 2 },
  btnRow: { flexDirection: "row", gap: 10 },
  instructionsBox: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 14,
  },
  instructionsTitle: { fontSize: 14, fontWeight: "600", marginBottom: 12 },
  instructionItem: { marginBottom: 10 },
  instructionTitle: { fontSize: 14, fontWeight: "500" },
  instructionExample: { fontSize: 13, fontStyle: "italic", marginTop: 2 },
  phoneRow: { flexDirection: "row", gap: 10, alignItems: "center" },
  countryCodeBox: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 10,
    width: 80,
  },
  countryCodePlus: { fontSize: 15, marginRight: 2 },
  countryCodeInput: { fontSize: 15, flex: 1 },
  phoneInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  previewText: { fontSize: 13, marginTop: 8, fontWeight: "500" },
  otpRow: {
    flexDirection: "row",
    gap: 12,
    justifyContent: "center",
    marginVertical: 8,
    position: "relative",
  },
  hiddenOtpInput: {
    position: "absolute",
    opacity: 0,
    width: 1,
    height: 1,
  },
  otpBox: {
    width: 56,
    height: 60,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  otpDigit: { fontSize: 24, fontWeight: "700" },
  otpError: { fontSize: 13, textAlign: "center", marginTop: 8 },
});
