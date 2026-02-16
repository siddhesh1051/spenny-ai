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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import type { User } from "@supabase/supabase-js";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/Skeleton";
import { CheckCircle2, Send, Loader2 } from "lucide-react";

type VerificationStep = "enter_phone" | "enter_otp" | "verified";

export default function WhatsAppIntegrationPage() {
  const [user, setUser] = useState<User | null>(null);
  const [countryCode, setCountryCode] = useState("91");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [savedPhone, setSavedPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [verificationStep, setVerificationStep] = useState<VerificationStep>("enter_phone");
  const [otpError, setOtpError] = useState<string>("");

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
        if (data && data.whatsapp_phone) {
          const phone = data.whatsapp_phone;
          // Extract country code and phone number
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
      setLoading(false);
    };
    fetchUser();
  }, []);

  const sendOTP = async () => {
    if (!user) return;
    setIsSubmitting(true);
    try {
      const fullPhone = countryCode + phoneNumber.replace(/\D/g, "");

      if (phoneNumber.replace(/\D/g, "").length < 10) {
        toast.error("Please enter a valid phone number");
        setIsSubmitting(false);
        return;
      }

      // Check if trying to verify the same number that's already saved
      if (savedPhone && fullPhone === savedPhone) {
        toast.info("This number is already verified on your account");
        setIsSubmitting(false);
        return;
      }

      // Call the send-whatsapp-otp Edge Function
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-whatsapp-otp`,
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            phone: fullPhone,
            userId: user.id,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        // Handle error responses
        const errorMessage = data.error || "Failed to send OTP. Please try again.";
        toast.error(errorMessage);
        setIsSubmitting(false);
        return;
      }

      setVerificationStep("enter_otp");
      toast.success("OTP sent to your WhatsApp number!");
    } catch (error: any) {
      console.error("Error sending OTP:", error);
      toast.error(error.message || "Failed to send OTP");
    } finally {
      setIsSubmitting(false);
    }
  };

  const verifyOTP = async () => {
    if (!user) return;
    setIsSubmitting(true);
    setOtpError(""); // Clear previous errors

    try {
      const fullPhone = countryCode + phoneNumber.replace(/\D/g, "");

      if (otp.length !== 4) {
        const error = "Please enter all 4 digits";
        setOtpError(error);
        toast.error(error);
        setIsSubmitting(false);
        return;
      }

      // Call the verify-whatsapp-otp Edge Function
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/verify-whatsapp-otp`,
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            phone: fullPhone,
            otp: otp,
            userId: user.id,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        // Handle error responses
        const errorMessage = data.error || "Failed to verify OTP. Please try again.";
        setOtpError(errorMessage);
        toast.error(errorMessage);
        setIsSubmitting(false);
        return;
      }

      // Success!
      setSavedPhone(fullPhone);
      setVerificationStep("verified");
      setOtp("");
      setOtpError("");
      toast.success("WhatsApp number verified and saved successfully!");
    } catch (error: any) {
      console.error("Error verifying OTP:", error);
      const errorMessage = error.message || "Failed to verify OTP. Please try again.";
      setOtpError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const changeNumber = () => {
    setPhoneNumber("");
    setOtp("");
    setOtpError("");
    setVerificationStep("enter_phone");
  };

  const unlinkNumber = async () => {
    if (!user) return;
    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          whatsapp_phone: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id);

      if (error) throw error;

      setSavedPhone("");
      setPhoneNumber("");
      setCountryCode("91");
      setVerificationStep("enter_phone");
      toast.success("WhatsApp number unlinked successfully");
    } catch (error: any) {
      console.error("Error unlinking number:", error);
      toast.error("Failed to unlink number. Please try again.");
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
        {verificationStep === "verified" ? (
          <>
            <Alert className="bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800 [&>svg]:static [&>svg]:inline [&>svg]:mr-2 [&>svg~*]:pl-0 flex items-center">
              <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0" />
              <AlertTitle className="text-green-800 dark:text-green-300 flex items-center leading-tight">
                Your WhatsApp number is verified
              </AlertTitle>
              <AlertDescription className="text-green-800 dark:text-green-300 flex items-center leading-tight">
                <strong className="ml-1">+{savedPhone}</strong>
              </AlertDescription>
            </Alert>
            <div className="flex gap-2">
              <Button onClick={changeNumber} variant="outline">
                Change Number
              </Button>
              <Button onClick={unlinkNumber} variant="destructive" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Unlinking...
                  </>
                ) : (
                  "Unlink Number"
                )}
              </Button>
            </div>
          </>
        ) : verificationStep === "enter_phone" ? (
          <>
            <div>
              <label htmlFor="whatsappPhone" className="text-sm font-medium">
                WhatsApp Number
              </label>
              <div className="flex gap-2 mt-1">
                <div className="relative w-24">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    +
                  </span>
                  <Input
                    type="tel"
                    value={countryCode}
                    onChange={(e) => setCountryCode(e.target.value.replace(/\D/g, ""))}
                    placeholder="91"
                    maxLength={3}
                    className="pl-6"
                  />
                </div>
                <Input
                  id="whatsappPhone"
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, ""))}
                  placeholder="9876543210"
                  className="flex-1"
                />
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Enter your country code and phone number. We'll send a verification code to this number.
                {phoneNumber && phoneNumber.length > 0 && (
                  <span className="block text-blue-600 dark:text-blue-400 mt-1">
                    Will verify: +{countryCode} {phoneNumber}
                  </span>
                )}
              </p>
            </div>
            <Button onClick={sendOTP} disabled={isSubmitting || !phoneNumber || phoneNumber.length < 10}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Send Verification Code
                </>
              )}
            </Button>
          </>
        ) : (
          <>
            <Alert className="bg-blue-50 border-blue-200 dark:bg-blue-950 dark:border-blue-800">
              <Send className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <AlertDescription className="text-blue-800 dark:text-blue-300">
                We sent a 4-digit code to <strong>+{countryCode} {phoneNumber}</strong> via
                WhatsApp. It will expire in 10 minutes.
              </AlertDescription>
            </Alert>
            <div>
              <label className="text-sm font-medium block mb-2">
                Enter 4-Digit Code
              </label>
              <InputOTP
                maxLength={4}
                value={otp}
                onChange={(value) => {
                  setOtp(value);
                  setOtpError(""); // Clear error when user types
                }}
                disabled={isSubmitting}
                containerClassName="gap-3"
              >
                <InputOTPGroup className="gap-3">
                  <InputOTPSlot
                    index={0}
                    className={`h-12 w-12 text-xl font-semibold rounded-md border-2 ${otpError ? 'border-red-500 dark:border-red-400' : ''}`}
                  />
                  <InputOTPSlot
                    index={1}
                    className={`h-12 w-12 text-xl font-semibold rounded-md border-2 ${otpError ? 'border-red-500 dark:border-red-400' : ''}`}
                  />
                  <InputOTPSlot
                    index={2}
                    className={`h-12 w-12 text-xl font-semibold rounded-md border-2 ${otpError ? 'border-red-500 dark:border-red-400' : ''}`}
                  />
                  <InputOTPSlot
                    index={3}
                    className={`h-12 w-12 text-xl font-semibold rounded-md border-2 ${otpError ? 'border-red-500 dark:border-red-400' : ''}`}
                  />
                </InputOTPGroup>
              </InputOTP>
              {otpError && (
                <p className="text-sm text-red-600 dark:text-red-400 mt-2 flex items-center gap-1">
                  <span className="font-medium">⚠️</span> {otpError}
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <Button onClick={verifyOTP} disabled={isSubmitting || otp.length !== 4}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Verify & Save
                  </>
                )}
              </Button>
              <Button onClick={changeNumber} variant="outline" disabled={isSubmitting}>
                Change Number
              </Button>
            </div>
            <Button onClick={sendOTP} variant="link" disabled={isSubmitting} className="text-sm">
              Resend Code
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
