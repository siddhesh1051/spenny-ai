import React, { useEffect, useRef } from "react";
import {
  View,
  TouchableOpacity,
  Text,
  Animated,
  StyleSheet,
  Dimensions,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../context/ThemeContext";
import {
  Home,
  BarChart2,
  List,
  Settings,
} from "lucide-react-native";

const { width } = Dimensions.get("window");

const tabs = [
  { name: "Home", icon: Home, label: "Home" },
  { name: "Analytics", icon: BarChart2, label: "Analytics" },
  { name: "Transactions", icon: List, label: "Transactions" },
  { name: "Settings", icon: Settings, label: "Settings" },
];

interface TabBarProps {
  state: any;
  descriptors: any;
  navigation: any;
}

function TabItem({
  tab,
  isFocused,
  onPress,
}: {
  tab: (typeof tabs)[0];
  isFocused: boolean;
  onPress: () => void;
}) {
  const { colors, isDark } = useTheme();

  const translateY = useRef(new Animated.Value(0)).current;
  const iconScale = useRef(new Animated.Value(1)).current;
  const labelOpacity = useRef(new Animated.Value(isFocused ? 1 : 0.45)).current;
  const tapScale = useRef(new Animated.Value(1)).current;

  // JS-driver group: indicator width + opacity
  const indicatorWidth = useRef(new Animated.Value(isFocused ? 20 : 0)).current;
  const indicatorOpacity = useRef(new Animated.Value(isFocused ? 1 : 0)).current;

  useEffect(() => {
    // Native driver: transform + label opacity
    Animated.parallel([
      Animated.spring(translateY, {
        toValue: isFocused ? -3 : 0,
        tension: 120,
        friction: 9,
        useNativeDriver: true,
      }),
      Animated.spring(iconScale, {
        toValue: isFocused ? 1.15 : 1,
        tension: 120,
        friction: 9,
        useNativeDriver: true,
      }),
      Animated.timing(labelOpacity, {
        toValue: isFocused ? 1 : 0.45,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start();

    // JS driver: indicator geometry
    Animated.parallel([
      Animated.spring(indicatorWidth, {
        toValue: isFocused ? 20 : 0,
        tension: 120,
        friction: 9,
        useNativeDriver: false,
      }),
      Animated.timing(indicatorOpacity, {
        toValue: isFocused ? 1 : 0,
        duration: 180,
        useNativeDriver: false,
      }),
    ]).start();
  }, [isFocused]);

  const handlePress = () => {
    Animated.sequence([
      Animated.timing(tapScale, { toValue: 0.87, duration: 65, useNativeDriver: true }),
      Animated.spring(tapScale, { toValue: 1, tension: 220, friction: 5, useNativeDriver: true }),
    ]).start();
    onPress();
  };

  const IconComponent = tab.icon;
  const activeColor = colors.text;
  // Inactive must be readable on black — zinc-400 in dark (#a1a1aa), zinc-500 in light
  const inactiveColor = isDark ? "#888892" : "#8f8f99";

  return (
    <TouchableOpacity
      onPress={handlePress}
      style={styles.tabItem}
      activeOpacity={1}
    >
      <Animated.View
        style={{
          alignItems: "center",
          transform: [{ scale: tapScale }, { translateY }],
        }}
      >
        {/* Indicator above icon */}
        <Animated.View
          style={{
            width: indicatorWidth,
            height: 2,
            borderRadius: 1,
            backgroundColor: activeColor,
            opacity: indicatorOpacity,
            marginBottom: 6,
          }}
        />

        {/* Icon */}
        <Animated.View style={{ transform: [{ scale: iconScale }] }}>
          <IconComponent
            size={21}
            color={isFocused ? activeColor : inactiveColor}
            strokeWidth={isFocused ? 2.2 : 1.8}
          />
        </Animated.View>

        {/* Label */}
        <Animated.Text
          style={{
            fontSize: 10,
            fontWeight: isFocused ? "600" : "400",
            color: isFocused ? activeColor : inactiveColor,
            marginTop: 3,
            letterSpacing: 0.1,
            opacity: labelOpacity,
          }}
        >
          {tab.label}
        </Animated.Text>
      </Animated.View>
    </TouchableOpacity>
  );
}

export function AnimatedTabBar({ state, descriptors, navigation }: TabBarProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.tabBar,
          borderTopColor: colors.tabBarBorder,
          // Proper safe area: bottom inset for home indicator / navigation bar
          paddingBottom: Math.max(insets.bottom, Platform.OS === "android" ? 8 : 0),
        },
      ]}
    >
      {state.routes.map((route: any, index: number) => {
        const isFocused = state.index === index;
        const tab = tabs[index];

        const onPress = () => {
          const event = navigation.emit({
            type: "tabPress",
            target: route.key,
            canPreventDefault: true,
          });
          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        if (!tab) return null;

        return (
          <TabItem
            key={route.key}
            tab={tab}
            isFocused={isFocused}
            onPress={onPress}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 8,
  },
  tabItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-start",
    paddingTop: 4,
    minHeight: 52,
  },
});
