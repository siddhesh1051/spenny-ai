import "./global.css";
import "react-native-url-polyfill/auto";
import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StatusBar,
} from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { StyleSheet } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { SafeAreaProvider } from "react-native-safe-area-context";
import type { Session, User } from "@supabase/supabase-js";
import Toast from "react-native-toast-message";
import { useFonts, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from "@expo-google-fonts/inter";

import { supabase } from "./lib/supabase";
import { ThemeProvider, useTheme } from "./context/ThemeContext";
import { AnimatedTabBar } from "./components/AnimatedTabBar";

import AuthScreen from "./screens/AuthScreen";
import HomeScreen from "./screens/HomeScreen";
import AnalyticsScreen from "./screens/AnalyticsScreen";
import TransactionsScreen from "./screens/TransactionsScreen";
import SettingsScreen from "./screens/SettingsScreen";

interface Expense {
  id: string;
  amount: number;
  category: string;
  description: string;
  date: string;
}

const Tab = createBottomTabNavigator();

async function ensureProfile(user: User): Promise<void> {
  const { data: existing } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();
  if (existing) return;
  const fullName =
    user.user_metadata?.full_name ??
    user.user_metadata?.name ??
    (user.email ? user.email.split("@")[0] : "");
  await supabase.from("profiles").upsert({
    id: user.id,
    full_name: fullName,
    updated_at: new Date().toISOString(),
  });
}

function MainApp() {
  const { colors, isDark } = useTheme();
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });
  const [session, setSession] = useState<Session | null>(null);
  const [userGroqKey, setUserGroqKey] = useState<string | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
      if (session) {
        await ensureProfile(session.user);
        await loadGroqKey(session.user.id);
        await fetchExpenses();
      }
      setIsAuthLoading(false);
    };
    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      if (session) {
        await ensureProfile(session.user);
        await loadGroqKey(session.user.id);
        await fetchExpenses();
      } else {
        setExpenses([]);
        setUserGroqKey(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const loadGroqKey = async (userId: string) => {
    try {
      const { data } = await supabase
        .from("profiles")
        .select("groq_api_key")
        .eq("id", userId)
        .single();
      setUserGroqKey(data?.groq_api_key || null);
    } catch {}
  };

  const fetchExpenses = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("expenses")
        .select("*")
        .order("date", { ascending: false });
      if (error) throw error;
      setExpenses(data || []);
    } catch (err) {
      console.error("Failed to fetch expenses:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const addExpenses = useCallback(async (newExpenses: Omit<Expense, "id">[]) => {
    if (!session) return;
    try {
      const expensesWithUser = newExpenses.map((e) => ({
        ...e,
        date: e.date || new Date().toISOString(),
        user_id: session.user.id,
      }));
      const { data, error } = await supabase
        .from("expenses")
        .insert(expensesWithUser)
        .select();
      if (error) throw error;
      setExpenses((prev) => [...(data || []), ...prev]);
      Toast.show({
        type: "success",
        text1: `Added ${(data || []).length} expense(s)!`,
      });
    } catch (err: any) {
      Toast.show({ type: "error", text1: "Failed to save expenses", text2: err.message });
    }
  }, [session]);

  const deleteExpense = useCallback(async (id: string) => {
    try {
      const { error } = await supabase.from("expenses").delete().eq("id", id);
      if (error) throw error;
      setExpenses((prev) => prev.filter((e) => e.id !== id));
      Toast.show({ type: "success", text1: "Expense deleted." });
    } catch (err: any) {
      Toast.show({ type: "error", text1: "Failed to delete" });
    }
  }, []);

  const updateExpense = useCallback(async (id: string, fields: Partial<Expense>) => {
    try {
      const { data, error } = await supabase
        .from("expenses")
        .update(fields)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      setExpenses((prev) => prev.map((e) => (e.id === id ? data : e)));
    } catch (err: any) {
      Toast.show({ type: "error", text1: "Failed to update" });
    }
  }, []);

  if (isAuthLoading || !fontsLoaded) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#000000" }}>
        <Text style={{ color: "#fafafa", fontSize: 28, fontWeight: "700", letterSpacing: -0.5 }}>Spenny AI</Text>
        <Text style={{ color: "#52525b", marginTop: 8, fontSize: 14 }}>Loading...</Text>
      </View>
    );
  }

  if (!session) {
    return (
      <>
        <StatusBar barStyle="light-content" backgroundColor="#09090b" />
        <AuthScreen />
        <Toast />
      </>
    );
  }

  const userName =
    session.user?.user_metadata?.full_name ||
    session.user?.email?.split("@")[0] ||
    "there";

  return (
    <NavigationContainer>
      <StatusBar
        barStyle={isDark ? "light-content" : "dark-content"}
        backgroundColor={colors.background}
      />
      <Tab.Navigator
        tabBar={(props) => <AnimatedTabBar {...props} />}
        screenOptions={{
          headerStyle: {
            backgroundColor: colors.background,
            shadowColor: "transparent",
            elevation: 0,
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderBottomColor: colors.border,
          } as any,
          headerTitleStyle: {
            color: colors.text,
            fontSize: 17,
            fontWeight: "600",
            fontFamily: "Inter_600SemiBold",
          },
          headerTintColor: colors.text,
          headerShadowVisible: false,
        }}
      >
        <Tab.Screen
          name="Home"
          options={{
            title: `Welcome, ${userName.split(" ")[0]}!`,
            headerTitleStyle: { fontSize: 16, fontWeight: "700", color: colors.text },
          }}
        >
          {() => (
            <HomeScreen
              expenses={expenses}
              userGroqKey={userGroqKey}
              onAddExpenses={addExpenses}
              isLoading={isLoading}
            />
          )}
        </Tab.Screen>

        <Tab.Screen
          name="Analytics"
          options={{ title: "Analytics" }}
        >
          {() => (
            <AnalyticsScreen expenses={expenses} isLoading={isLoading} />
          )}
        </Tab.Screen>

        <Tab.Screen
          name="Transactions"
          options={{ title: "All Transactions" }}
        >
          {() => (
            <TransactionsScreen
              expenses={expenses}
              isLoading={isLoading}
              deleteExpense={deleteExpense}
              updateExpense={updateExpense}
            />
          )}
        </Tab.Screen>

        <Tab.Screen
          name="Settings"
          options={{ title: "Settings" }}
        >
          {() => <SettingsScreen />}
        </Tab.Screen>
      </Tab.Navigator>
      <Toast />
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <MainApp />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
