import React from "react";
import { View, Text, ViewStyle, TextStyle } from "react-native";
import { useTheme } from "../../context/ThemeContext";

interface BadgeProps {
  children: React.ReactNode;
  variant?: "default" | "secondary" | "destructive" | "success" | "outline";
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export function Badge({ children, variant = "secondary", style, textStyle }: BadgeProps) {
  const { colors, isDark } = useTheme();

  const variantStyles: Record<string, { bg: string; text: string; border?: string }> = {
    default: {
      bg: isDark ? "#27272a" : "#f4f4f5",
      text: colors.text,
    },
    secondary: {
      bg: isDark ? "#27272a" : "#f4f4f5",
      text: colors.textMuted,
    },
    destructive: {
      bg: "rgba(239, 68, 68, 0.12)",
      text: "#ef4444",
    },
    success: {
      bg: colors.successBg,
      text: colors.success,
    },
    outline: {
      bg: "transparent",
      text: colors.text,
      border: colors.border,
    },
  };

  const vs = variantStyles[variant];

  return (
    <View
      style={[
        {
          backgroundColor: vs.bg,
          paddingHorizontal: 8,
          paddingVertical: 2,
          borderRadius: 4,
          alignSelf: "flex-start",
          borderWidth: vs.border ? 1 : 0,
          borderColor: vs.border,
        },
        style,
      ]}
    >
      <Text
        style={[
          {
            fontSize: 11,
            fontWeight: "500",
            color: vs.text,
            textTransform: "capitalize",
          },
          textStyle,
        ]}
      >
        {children}
      </Text>
    </View>
  );
}
