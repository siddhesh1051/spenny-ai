import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Modal,
  TextInput,
  StyleSheet,
  Animated,
  Easing,
  Alert,
  Image,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import { Audio } from "expo-av";
import { useTheme } from "../context/ThemeContext";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Input } from "../components/ui/Input";
import { Badge } from "../components/ui/Badge";
import { Mic, Plus, Upload, FileText, Check, X, Pencil, Square } from "lucide-react-native";
import Toast from "react-native-toast-message";
import Groq from "groq-sdk";

// Buffer polyfill not available in RN - use fetch-based approach for audio

const GROQ_API_KEY = process.env.EXPO_PUBLIC_GROQ_API_KEY!;

interface PendingExpense {
  amount: number;
  category: string;
  description: string;
}

interface HomeScreenProps {
  expenses: any[];
  userGroqKey: string | null;
  onAddExpenses: (expenses: any[]) => Promise<void>;
  isLoading: boolean;
}

async function callGroqText(apiKey: string, prompt: string): Promise<string> {
  const groq = new Groq({ apiKey, dangerouslyAllowBrowser: true });
  const completion = await groq.chat.completions.create({
    model: "llama-3.1-8b-instant",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.7,
  });
  return completion.choices[0]?.message?.content || "";
}

async function callGroqVision(apiKey: string, prompt: string, imageBase64: string, mimeType: string): Promise<string> {
  const groq = new Groq({ apiKey, dangerouslyAllowBrowser: true });
  const completion = await groq.chat.completions.create({
    model: "llama-3.2-11b-vision-preview",
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: prompt },
          { type: "image_url", image_url: { url: `data:${mimeType};base64,${imageBase64}` } },
        ],
      },
    ],
    temperature: 0.7,
  });
  return completion.choices[0]?.message?.content || "";
}

function parseExpensesFromJSON(text: string): PendingExpense[] | null {
  try {
    const cleaned = text.replace(/```json/g, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(cleaned);
    if (!Array.isArray(parsed)) return null;
    return parsed.filter(
      (e) =>
        typeof e.amount === "number" &&
        e.amount > 0 &&
        typeof e.category === "string" &&
        typeof e.description === "string" &&
        e.description.trim().length > 0
    );
  } catch {
    return null;
  }
}

const CATEGORY_EMOJI: Record<string, string> = {
  food: "🍔",
  travel: "✈️",
  groceries: "🛒",
  entertainment: "🎉",
  utilities: "💡",
  rent: "🏠",
  other: "🤷",
};

export default function HomeScreen({ expenses, userGroqKey, onAddExpenses, isLoading }: HomeScreenProps) {
  const { colors, isDark } = useTheme();
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [pendingExpenses, setPendingExpenses] = useState<PendingExpense[] | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [countdown, setCountdown] = useState(5);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [textInput, setTextInput] = useState("");
  const [lastImageUri, setLastImageUri] = useState<string | null>(null);
  const [transcript, setTranscript] = useState("");
  const [isExpensesClosing, setIsExpensesClosing] = useState(false);

  const recordingRef = useRef<Audio.Recording | null>(null);
  const dismissTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pendingRef = useRef<PendingExpense[] | null>(null);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);

  // Mic glow animation
  const micGlowAnim = useRef(new Animated.Value(0)).current;
  const micScaleAnim = useRef(new Animated.Value(1)).current;
  const closingAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    pendingRef.current = pendingExpenses;
  }, [pendingExpenses]);

  useEffect(() => {
    if (isRecording) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(micGlowAnim, { toValue: 1, duration: 800, useNativeDriver: true, easing: Easing.ease }),
          Animated.timing(micGlowAnim, { toValue: 0.3, duration: 800, useNativeDriver: true, easing: Easing.ease }),
        ])
      ).start();
      Animated.loop(
        Animated.sequence([
          Animated.spring(micScaleAnim, { toValue: 1.08, useNativeDriver: true, friction: 3 }),
          Animated.spring(micScaleAnim, { toValue: 1, useNativeDriver: true, friction: 3 }),
        ])
      ).start();
    } else {
      micGlowAnim.stopAnimation();
      micScaleAnim.stopAnimation();
      Animated.timing(micGlowAnim, { toValue: 0, duration: 300, useNativeDriver: true }).start();
      Animated.spring(micScaleAnim, { toValue: 1, useNativeDriver: true, friction: 5 }).start();
    }
  }, [isRecording]);

  useEffect(() => {
    if (pendingExpenses && pendingExpenses.length > 0 && editingIndex === null) {
      setCountdown(5);
      closingAnim.setValue(1);
      setIsExpensesClosing(false);

      if (countdownRef.current) clearInterval(countdownRef.current);
      countdownRef.current = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(countdownRef.current!);
            return 0;
          }
          return prev - 1;
        });
      }, 1000) as unknown as NodeJS.Timeout;

      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = setTimeout(() => {
        confirmPendingExpenses();
      }, 5000);
    }
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [pendingExpenses, editingIndex]);

  const getApiKey = () => userGroqKey || GROQ_API_KEY;

  const handleMicPress = async () => {
    if (isRecording) {
      await stopRecording();
    } else {
      await startRecording();
    }
  };

  const startRecording = async () => {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission Required", "Microphone access is needed to record expenses.");
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      await recording.startAsync();
      recordingRef.current = recording;
      setIsRecording(true);
      setTranscript("");
    } catch (err: any) {
      Alert.alert("Recording Error", err.message || "Failed to start recording");
    }
  };

  const stopRecording = async () => {
    if (!recordingRef.current) return;
    setIsRecording(false);
    setIsProcessing(true);

    try {
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      recordingRef.current = null;

      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });

      if (!uri) throw new Error("No recording URI");

      // Read file as base64
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // Send to Groq Whisper for transcription via REST API
      const apiKey = getApiKey();

      const formData = new FormData();
      formData.append("file", {
        uri,
        name: "recording.m4a",
        type: "audio/m4a",
      } as any);
      formData.append("model", "whisper-large-v3-turbo");
      formData.append("language", "en");
      formData.append("response_format", "json");

      const whisperResponse = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
        body: formData,
      });

      if (!whisperResponse.ok) {
        const errData = await whisperResponse.json().catch(() => ({}));
        throw new Error(errData?.error?.message || "Transcription failed");
      }

      const transcriptionData = await whisperResponse.json();
      const text = transcriptionData.text;
      setTranscript(text);
      if (text && text.trim()) {
        await extractExpensesFromText(text);
      } else {
        Toast.show({ type: "error", text1: "No speech detected", text2: "Please try again." });
      }
    } catch (err: any) {
      // Fallback: try sending text directly
      Toast.show({ type: "error", text1: "Processing failed", text2: err.message || "Please try again." });
    } finally {
      setIsProcessing(false);
    }
  };

  const extractExpensesFromText = async (text: string) => {
    const apiKey = getApiKey();
    setIsProcessing(true);
    try {
      const prompt = `You are an AI that extracts structured expense data from natural language input.

Extract ALL expenses from: '${text}'

Return a JSON array with this exact format:
[{"amount": number, "category": string, "description": string}]

Categories: food, travel, groceries, entertainment, utilities, rent, other
Keep descriptions short (max 50 chars). Return ONLY valid JSON array.`;

      const response = await callGroqText(apiKey, prompt);
      const expenses = parseExpensesFromJSON(response);

      if (expenses && expenses.length > 0) {
        setPendingExpenses(expenses);
      } else {
        Toast.show({ type: "error", text1: "Could not extract expenses", text2: "Please try again." });
      }
    } catch (err: any) {
      Toast.show({ type: "error", text1: "AI Error", text2: err.message || "Failed to process." });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleManualSave = async () => {
    if (!textInput.trim()) return;
    setIsAddModalOpen(false);
    await extractExpensesFromText(textInput);
    setTextInput("");
  };

  const handleImagePick = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      base64: true,
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setLastImageUri(asset.uri);
      if (asset.base64) {
        await extractExpensesFromImage(asset.base64, asset.mimeType || "image/jpeg");
      }
    }
  };

  const handleCameraCapture = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission Required", "Camera access is needed to capture receipts.");
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      quality: 0.8,
      base64: true,
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setLastImageUri(asset.uri);
      if (asset.base64) {
        await extractExpensesFromImage(asset.base64, asset.mimeType || "image/jpeg");
      }
    }
  };

  const extractExpensesFromImage = async (base64: string, mimeType: string) => {
    const apiKey = getApiKey();
    setIsProcessing(true);
    Toast.show({ type: "info", text1: "Processing image...", text2: "AI is analyzing your receipt." });
    try {
      const prompt = "You are an AI that extracts structured expense data from an image of a receipt or bill. Return a JSON array of {amount, category, description} objects. Categories: food, travel, groceries, entertainment, utilities, rent, other. Return ONLY valid JSON array.";
      const response = await callGroqVision(apiKey, prompt, base64, mimeType);
      const expenses = parseExpensesFromJSON(response);
      if (expenses && expenses.length > 0) {
        const withDate = expenses.map((e) => ({ ...e, date: new Date().toISOString() }));
        await onAddExpenses(withDate);
        Toast.show({ type: "success", text1: `Added ${expenses.length} expense(s)!` });
      } else {
        Toast.show({ type: "error", text1: "No expenses found in image." });
      }
    } catch (err: any) {
      Toast.show({ type: "error", text1: "Failed to process image", text2: err.message });
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePDFPick = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "application/pdf",
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets?.[0]) return;

      const asset = result.assets[0];
      if (asset.size && asset.size > 5 * 1024 * 1024) {
        Toast.show({ type: "error", text1: "File too large", text2: "Please use a PDF smaller than 5MB." });
        return;
      }

      setIsProcessing(true);
      Toast.show({ type: "info", text1: "Processing PDF...", text2: "AI is analyzing your bank statement." });

      const base64 = await FileSystem.readAsStringAsync(asset.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      await extractExpensesFromPDF(base64);
    } catch (err: any) {
      Toast.show({ type: "error", text1: "Failed to open PDF", text2: err.message });
      setIsProcessing(false);
    }
  };

  const extractExpensesFromPDF = async (base64: string) => {
    const apiKey = getApiKey();
    try {
      const prompt = `You are an AI that extracts expense data from bank statement PDFs. Extract only DEBIT transactions (money going OUT). Return a JSON array of {amount, category, description, date} objects. Categories: food, travel, groceries, entertainment, utilities, rent, other. Keep descriptions short. date should be ISO string. Return ONLY valid JSON array.`;
      const response = await callGroqVision(apiKey, prompt, base64, "application/pdf");
      const expenses = parseExpensesFromJSON(response);
      if (expenses && expenses.length > 0) {
        const validExpenses = expenses.filter(
          (e: any) => !e.date || !isNaN(Date.parse(e.date))
        ).map((e: any) => ({
          ...e,
          amount: Math.abs(e.amount),
          date: e.date ? new Date(e.date).toISOString() : new Date().toISOString(),
        }));
        if (validExpenses.length > 0) {
          await onAddExpenses(validExpenses);
          Toast.show({ type: "success", text1: `Added ${validExpenses.length} transactions!` });
        }
      } else {
        Toast.show({ type: "info", text1: "No expense transactions found in PDF." });
      }
    } catch (err: any) {
      Toast.show({ type: "error", text1: "Failed to process PDF", text2: err.message });
    } finally {
      setIsProcessing(false);
    }
  };

  const confirmPendingExpenses = () => {
    if (pendingRef.current) {
      setIsExpensesClosing(true);
      if (countdownRef.current) clearInterval(countdownRef.current);
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);

      const withDate = pendingRef.current.map((e) => ({
        ...e,
        date: new Date().toISOString(),
      }));

      Animated.timing(closingAnim, {
        toValue: 0,
        duration: 280,
        useNativeDriver: true,
        easing: Easing.out(Easing.back(1.5)),
      }).start(() => {
        onAddExpenses(withDate);
        setPendingExpenses(null);
        setEditingIndex(null);
        closingAnim.setValue(1);
      });
    }
  };

  const cancelPendingExpenses = () => {
    setIsExpensesClosing(true);
    if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);

    Animated.timing(closingAnim, {
      toValue: 0,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      setPendingExpenses(null);
      setEditingIndex(null);
      closingAnim.setValue(1);
    });
  };

  const editPendingExpense = (index: number, field: keyof PendingExpense, value: string | number) => {
    if (!pendingExpenses) return;
    const updated = [...pendingExpenses];
    if (field === "amount") updated[index][field] = Number(value);
    else updated[index][field] = String(value);
    setPendingExpenses(updated);
  };

  const glowOpacity = micGlowAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.7] });
  const glowScale = micGlowAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.6] });

  const showProcessing = isProcessing || isLoading;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Last uploaded image */}
        {lastImageUri && (
          <View style={styles.imagePreview}>
            <Image
              source={{ uri: lastImageUri }}
              style={styles.previewImage}
              resizeMode="contain"
            />
            <Text style={[styles.imageLabel, { color: colors.textMuted }]}>
              Last uploaded image
            </Text>
          </View>
        )}

        {/* Main mic area */}
        <View style={styles.micArea}>
          <Text style={[styles.micHint, { color: colors.text }]}>
            {isRecording ? "Listening... tap to stop" : "Tap mic to add expense"}
          </Text>

          <View style={styles.micWrapper}>
            {/* Glow rings — cyan/purple/pink like the web */}
            {isRecording && (
              <>
                <Animated.View
                  style={[
                    styles.glowRing,
                    {
                      opacity: glowOpacity,
                      transform: [{ scale: glowScale }],
                    },
                  ]}
                />
                <Animated.View
                  style={[
                    styles.glowRingInner,
                    { opacity: micGlowAnim },
                  ]}
                />
              </>
            )}

            <Animated.View style={{ transform: [{ scale: micScaleAnim }] }}>
              <TouchableOpacity
                onPress={handleMicPress}
                disabled={showProcessing}
                style={[
                  styles.micButton,
                  { opacity: showProcessing ? 0.6 : 1 },
                ]}
                activeOpacity={0.85}
              >
                <View style={styles.micInner}>
                  {showProcessing ? (
                    <ActivityIndicator size="large" color="#fff" />
                  ) : isRecording ? (
                    <Square size={36} color="#fff" fill="#fff" />
                  ) : (
                    <Mic size={40} color="#fff" />
                  )}
                </View>
              </TouchableOpacity>
            </Animated.View>
          </View>

          {/* Transcript */}
          {(isRecording || transcript) && (
            <View style={[styles.transcriptBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.transcriptLabel, { color: colors.textMuted }]}>
                {isRecording ? "You're saying:" : "Heard:"}
              </Text>
              <Text style={[styles.transcriptText, { color: colors.text }]}>
                {transcript || "..."}
              </Text>
            </View>
          )}

          {/* Action buttons */}
          <View style={styles.actionButtons}>
            <Button
              variant="outline"
              onPress={() => setIsAddModalOpen(true)}
              disabled={showProcessing}
              style={styles.actionBtn}
            >
              <View style={styles.btnInner}>
                <Plus size={16} color={colors.text} />
                <Text style={[styles.actionBtnText, { color: colors.text }]}>Add Manually</Text>
              </View>
            </Button>

            <Button
              variant="outline"
              onPress={handleImagePick}
              disabled={showProcessing}
              style={styles.actionBtn}
            >
              <View style={styles.btnInner}>
                <Upload size={16} color={colors.text} />
                <Text style={[styles.actionBtnText, { color: colors.text }]}>Upload Image</Text>
              </View>
            </Button>

            <Button
              variant="outline"
              onPress={handlePDFPick}
              disabled={showProcessing}
              style={styles.actionBtn}
            >
              <View style={styles.btnInner}>
                <FileText size={16} color={colors.text} />
                <Text style={[styles.actionBtnText, { color: colors.text }]}>Upload PDF</Text>
              </View>
            </Button>
          </View>
        </View>

        {/* Pending Expenses */}
        {pendingExpenses && pendingExpenses.length > 0 && (
          <Animated.View
            style={[
              styles.pendingContainer,
              {
                opacity: closingAnim,
                transform: [{ scale: closingAnim }],
              },
            ]}
          >
            <Card>
              {/* Close button */}
              <TouchableOpacity
                onPress={cancelPendingExpenses}
                style={styles.closeBtn}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <X size={18} color={colors.textMuted} />
              </TouchableOpacity>

              <Text style={[styles.pendingTitle, { color: colors.text }]}>
                Adding these expenses:
              </Text>
              {editingIndex === null && (
                <View style={styles.countdownBar}>
                  <View
                    style={[
                      styles.countdownFill,
                      {
                        backgroundColor: colors.primary,
                        width: `${(countdown / 5) * 100}%`,
                      },
                    ]}
                  />
                </View>
              )}

              <View style={styles.expenseList}>
                {pendingExpenses.map((expense, index) => (
                  <View
                    key={index}
                    style={[
                      styles.expenseItem,
                      { backgroundColor: colors.background, borderColor: colors.border },
                    ]}
                  >
                    {editingIndex === index ? (
                      <View style={styles.editRow}>
                        <TextInput
                          value={String(expense.amount)}
                          onChangeText={(v) => editPendingExpense(index, "amount", v)}
                          keyboardType="numeric"
                          style={[styles.editInput, { color: colors.text, borderColor: colors.inputBorder, backgroundColor: colors.input, width: 70 }]}
                          placeholderTextColor={colors.textMuted}
                        />
                        <TextInput
                          value={expense.category}
                          onChangeText={(v) => editPendingExpense(index, "category", v)}
                          style={[styles.editInput, { color: colors.text, borderColor: colors.inputBorder, backgroundColor: colors.input, width: 90 }]}
                          placeholderTextColor={colors.textMuted}
                        />
                        <TextInput
                          value={expense.description}
                          onChangeText={(v) => editPendingExpense(index, "description", v)}
                          style={[styles.editInput, { color: colors.text, borderColor: colors.inputBorder, backgroundColor: colors.input, flex: 1 }]}
                          placeholderTextColor={colors.textMuted}
                        />
                        <TouchableOpacity
                          onPress={() => setEditingIndex(null)}
                          style={styles.iconBtn}
                        >
                          <Check size={18} color={colors.success} />
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <View style={styles.displayRow}>
                        <Text style={[styles.expenseAmount, { color: colors.text }]}>
                          ₹{expense.amount}
                        </Text>
                        <Badge variant="default" style={{ minWidth: 80, alignItems: "center" }}>
                          {CATEGORY_EMOJI[expense.category] || ""} {expense.category}
                        </Badge>
                        <Text style={[styles.expenseDesc, { color: colors.textMuted }]} numberOfLines={1}>
                          {expense.description}
                        </Text>
                        <TouchableOpacity
                          onPress={() => {
                            setEditingIndex(index);
                            if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
                            if (countdownRef.current) clearInterval(countdownRef.current);
                          }}
                          style={styles.iconBtn}
                        >
                          <Pencil size={16} color={colors.textMuted} />
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                ))}
              </View>

              {editingIndex !== null ? (
              <Button onPress={confirmPendingExpenses} style={{ marginTop: 12 }}>
                Confirm & Save
              </Button>
              ) : (
                <Text style={[styles.autoSaveHint, { color: colors.textMuted }]}>
                  Auto-saving in {countdown}s...
                </Text>
              )}
            </Card>
          </Animated.View>
        )}
      </ScrollView>

      {/* Manual Add Modal */}
      <Modal
        visible={isAddModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setIsAddModalOpen(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <TouchableOpacity
            style={styles.modalBackdrop}
            onPress={() => setIsAddModalOpen(false)}
            activeOpacity={1}
          />
          <View style={[styles.modalContent, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Add Expenses Manually</Text>
            <Text style={[styles.modalDesc, { color: colors.textMuted }]}>
              Type expenses like "Spent 10 on coffee and 150 for groceries"
            </Text>
            <TextInput
              value={textInput}
              onChangeText={setTextInput}
              placeholder="Enter expenses here..."
              placeholderTextColor={colors.textSecondary}
              multiline
              numberOfLines={4}
              style={[
                styles.textArea,
                { color: colors.text, borderColor: colors.inputBorder, backgroundColor: colors.input },
              ]}
              autoFocus
            />
            <View style={styles.modalActions}>
              <Button variant="ghost" onPress={() => setIsAddModalOpen(false)} style={{ flex: 1 }}>
                Cancel
              </Button>
              <Button onPress={handleManualSave} disabled={!textInput.trim()} style={{ flex: 1 }}>
                Save Expenses
              </Button>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Toast />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 32 },
  imagePreview: { alignItems: "center", marginBottom: 16 },
  previewImage: { width: "100%", height: 180, borderRadius: 12 },
  imageLabel: { fontSize: 12, marginTop: 6 },
  micArea: { alignItems: "center", paddingVertical: 32 },
  micHint: { fontSize: 16, fontWeight: "500", marginBottom: 24 },
  micWrapper: {
    width: 140,
    height: 140,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  glowRing: {
    position: "absolute",
    width: 168,
    height: 168,
    borderRadius: 84,
    // cyan-purple-pink gradient effect via shadow layering
    backgroundColor: "transparent",
    borderWidth: 0,
    shadowColor: "#a855f7",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 28,
    elevation: 0,
  },
  glowRingInner: {
    position: "absolute",
    width: 142,
    height: 142,
    borderRadius: 71,
    backgroundColor: "transparent",
    shadowColor: "#06b6d4",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 20,
    elevation: 0,
  },
  micButton: {
    width: 120,
    height: 120,
    borderRadius: 60,
    shadowColor: "#a855f7",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 12,
  },
  micInner: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "#1a0a30",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "rgba(139, 92, 246, 0.35)",
  },
  transcriptBox: {
    width: "100%",
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 20,
  },
  transcriptLabel: { fontSize: 12, marginBottom: 6 },
  transcriptText: { fontSize: 16, fontWeight: "500", lineHeight: 24 },
  actionButtons: { width: "100%", gap: 10 },
  actionBtn: { width: "100%", borderRadius: 24 },
  btnInner: { flexDirection: "row", alignItems: "center", gap: 8 },
  actionBtnText: { fontSize: 14, fontWeight: "500" },
  pendingContainer: { marginTop: 8 },
  closeBtn: {
    position: "absolute",
    top: 12,
    right: 12,
    zIndex: 10,
    padding: 4,
  },
  pendingTitle: { fontSize: 16, fontWeight: "600", marginBottom: 8, paddingRight: 28 },
  countdownBar: {
    height: 3,
    backgroundColor: "rgba(124, 58, 237, 0.2)",
    borderRadius: 1.5,
    marginBottom: 16,
    overflow: "hidden",
  },
  countdownFill: {
    height: "100%",
    borderRadius: 1.5,
  },
  expenseList: { gap: 8 },
  expenseItem: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 10,
  },
  editRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  displayRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  editInput: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    fontSize: 13,
  },
  expenseAmount: { fontSize: 16, fontWeight: "700", minWidth: 56 },
  expenseDesc: { flex: 1, fontSize: 13 },
  iconBtn: { padding: 4 },
  autoSaveHint: { textAlign: "center", fontSize: 12, marginTop: 12 },
  modalOverlay: { flex: 1, justifyContent: "flex-end" },
  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.6)" },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    borderWidth: 1,
    paddingBottom: 36,
  },
  modalTitle: { fontSize: 18, fontWeight: "700", marginBottom: 6 },
  modalDesc: { fontSize: 13, marginBottom: 16 },
  textArea: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    minHeight: 100,
    textAlignVertical: "top",
    marginBottom: 16,
  },
  modalActions: { flexDirection: "row", gap: 10 },
});
