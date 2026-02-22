import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from "react-native";
import { supabase } from "../lib/supabase";
import { useTheme } from "../context/ThemeContext";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "./ui/Card";
import { Button } from "./ui/Button";
import { Skeleton } from "./ui/Skeleton";
import { CheckCircle, Send, RefreshCw, MessageCircle } from "lucide-react-native";
import Toast from "react-native-toast-message";
import type { User } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

type Step = "enter_phone" | "enter_otp" | "verified";

interface Props {
  user: User | null;
}

export default function WhatsAppSection({ user }: Props) {
  const { colors } = useTheme();
  const [countryCode, setCountryCode] = useState("91");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [savedPhone, setSavedPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [step, setStep] = useState<Step>("enter_phone");
  const [otpError, setOtpError] = useState("");

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    supabase
      .from("profiles")
      .select("whatsapp_phone")
      .eq("id", user.id)
      .single()
      .then(({ data }) => {
        if (data?.whatsapp_phone) {
          const phone = data.whatsapp_phone;
          setSavedPhone(phone);
          if (phone.startsWith("91") && phone.length > 2) {
            setCountryCode("91");
            setPhoneNumber(phone.substring(2));
          } else {
            setPhoneNumber(phone);
          }
          setStep("verified");
        }
        setLoading(false);
      });
  }, [user]);

  const sendOTP = async () => {
    if (!user) return;
    const digits = phoneNumber.replace(/\D/g, "");
    if (digits.length < 10) {
      Toast.show({ type: "error", text1: "Enter a valid 10-digit number." });
      return;
    }
    const fullPhone = countryCode + digits;
    if (savedPhone && fullPhone === savedPhone) {
      Toast.show({ type: "info", text1: "Already verified." });
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/send-whatsapp-otp`, {
        method: "POST",
        headers: { Authorization: `Bearer ${SUPABASE_ANON_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ phone: fullPhone, userId: user.id }),
      });
      const data = await res.json();
      if (!res.ok) { Toast.show({ type: "error", text1: data.error || "Failed to send OTP." }); return; }
      setStep("enter_otp");
      Toast.show({ type: "success", text1: "OTP sent to WhatsApp!" });
    } catch (e: any) {
      Toast.show({ type: "error", text1: e.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const verifyOTP = async () => {
    if (!user) return;
    if (otp.length !== 4) { setOtpError("Enter all 4 digits"); return; }
    const fullPhone = countryCode + phoneNumber.replace(/\D/g, "");
    setIsSubmitting(true);
    setOtpError("");
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/verify-whatsapp-otp`, {
        method: "POST",
        headers: { Authorization: `Bearer ${SUPABASE_ANON_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ phone: fullPhone, otp, userId: user.id }),
      });
      const data = await res.json();
      if (!res.ok) { const msg = data.error || "Failed."; setOtpError(msg); Toast.show({ type: "error", text1: msg }); return; }
      setSavedPhone(fullPhone);
      setStep("verified");
      setOtp("");
      Toast.show({ type: "success", text1: "WhatsApp verified!" });
    } catch (e: any) {
      setOtpError(e.message);
      Toast.show({ type: "error", text1: e.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const unlink = () => {
    if (!user) return;
    Alert.alert("Unlink WhatsApp", "Remove your linked number?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Unlink", style: "destructive", onPress: async () => {
          setIsSubmitting(true);
          await supabase.from("profiles").update({ whatsapp_phone: null }).eq("id", user.id);
          setSavedPhone(""); setPhoneNumber(""); setOtp(""); setStep("enter_phone");
          Toast.show({ type: "success", text1: "Number unlinked." });
          setIsSubmitting(false);
        },
      },
    ]);
  };

  const reset = () => { setOtp(""); setOtpError(""); setStep("enter_phone"); };

  const otpDigits = otp.split("").concat(Array(4 - otp.length).fill(""));

  if (loading) return <Skeleton height={100} borderRadius={12} />;

  return (
    <Card style={{ marginBottom: 16 }}>
      <CardHeader>
        <View style={styles.titleRow}>
          <MessageCircle size={17} color={colors.textMuted} />
          <CardTitle>WhatsApp Integration</CardTitle>
        </View>
        <CardDescription>
          Add expenses and query your spending via WhatsApp chat.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {step === "verified" ? (
          <>
            <View style={[styles.verifiedRow, { backgroundColor: colors.successBg, borderColor: "rgba(34,197,94,0.2)" }]}>
              <CheckCircle size={18} color={colors.success} />
              <Text style={[styles.verifiedText, { color: colors.success }]}>
                +{savedPhone}
              </Text>
            </View>
            <View style={styles.btnRow}>
              <Button variant="outline" onPress={reset} style={{ flex: 1 }}>
                Change
              </Button>
              <Button variant="destructive" onPress={unlink} loading={isSubmitting} style={{ flex: 1 }}>
                Unlink
              </Button>
            </View>
          </>
        ) : step === "enter_phone" ? (
          <>
            <View style={styles.phoneRow}>
              {/* Country code — compact */}
              <View style={[styles.ccBox, { borderColor: colors.inputBorder, backgroundColor: colors.input }]}>
                <Text style={[styles.plus, { color: colors.textMuted }]}>+</Text>
                <TextInput
                  value={countryCode}
                  onChangeText={(v) => setCountryCode(v.replace(/\D/g, ""))}
                  keyboardType="numeric"
                  maxLength={3}
                  style={[styles.ccInput, { color: colors.text }]}
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
                style={[styles.phoneInput, { color: colors.text, borderColor: colors.inputBorder, backgroundColor: colors.input }]}
              />
            </View>
            {phoneNumber.length > 0 && (
              <Text style={[styles.preview, { color: colors.textMuted }]}>
                Will verify: +{countryCode} {phoneNumber}
              </Text>
            )}
            <Button
              variant="secondary"
              onPress={sendOTP}
              loading={isSubmitting}
              disabled={isSubmitting || phoneNumber.replace(/\D/g, "").length < 10}
              style={{ marginTop: 12 }}
            >
              Send Verification Code
            </Button>
          </>
        ) : (
          <>
            <Text style={[styles.otpDesc, { color: colors.textMuted }]}>
              Enter the 4-digit code sent to +{countryCode} {phoneNumber}
            </Text>
            {/* OTP boxes */}
            <View style={styles.otpRow}>
              <TextInput
                value={otp}
                onChangeText={(v) => { setOtp(v.replace(/\D/g, "").slice(0, 4)); setOtpError(""); }}
                keyboardType="numeric"
                maxLength={4}
                style={styles.hiddenInput}
                autoFocus
                caretHidden
              />
              {[0, 1, 2, 3].map((i) => (
                <View key={i} style={[
                  styles.otpBox,
                  {
                    borderColor: otpError ? colors.destructive : otp.length === i ? colors.text : colors.inputBorder,
                    backgroundColor: colors.input,
                  },
                ]}>
                  <Text style={[styles.otpDigit, { color: colors.text }]}>{otpDigits[i] || ""}</Text>
                </View>
              ))}
            </View>
            {otpError ? <Text style={[styles.otpError, { color: colors.destructive }]}>⚠️ {otpError}</Text> : null}
            <Button variant="secondary" onPress={verifyOTP} loading={isSubmitting} disabled={isSubmitting || otp.length !== 4} style={{ marginTop: 14 }}>
              Verify & Save
            </Button>
            <View style={styles.btnRow}>
              <Button variant="ghost" onPress={reset} disabled={isSubmitting} style={{ flex: 1 }}>
                Change Number
              </Button>
              <Button variant="ghost" onPress={sendOTP} disabled={isSubmitting} style={{ flex: 1 }}>
                Resend Code
              </Button>
            </View>
          </>
        )}
      </CardContent>
    </Card>
  );
}

const styles = StyleSheet.create({
  titleRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  verifiedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 12,
  },
  verifiedText: { fontSize: 15, fontWeight: "600" },
  btnRow: { flexDirection: "row", gap: 10, marginTop: 4 },
  phoneRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  ccBox: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 10,
    width: 62,           // compact — just enough for "+91"
  },
  plus: { fontSize: 15, marginRight: 1 },
  ccInput: { fontSize: 15, flex: 1, padding: 0, minWidth: 28 },
  phoneInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  preview: { fontSize: 12, marginTop: 6 },
  otpDesc: { fontSize: 13, marginBottom: 14, lineHeight: 18 },
  otpRow: {
    flexDirection: "row",
    gap: 12,
    justifyContent: "center",
    position: "relative",
  },
  hiddenInput: { position: "absolute", opacity: 0, width: 1, height: 1 },
  otpBox: {
    width: 54,
    height: 58,
    borderRadius: 8,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  otpDigit: { fontSize: 22, fontWeight: "700" },
  otpError: { fontSize: 12, textAlign: "center", marginTop: 8 },
});
