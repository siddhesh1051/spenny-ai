import React from "react";
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
} from "react-native";
import { useTheme } from "../../context/ThemeContext";

type Variant = "default" | "outline" | "ghost" | "destructive" | "secondary" | "link";
type Size = "default" | "sm" | "lg" | "icon";

interface ButtonProps {
  onPress?: () => void;
  children?: React.ReactNode;
  variant?: Variant;
  size?: Size;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export function Button({
  onPress,
  children,
  variant = "default",
  size = "default",
  disabled = false,
  loading = false,
  style,
  textStyle,
}: ButtonProps) {
  const { colors, isDark } = useTheme();

  const getContainerStyle = (): ViewStyle => {
    const base: ViewStyle = {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 6,
      opacity: disabled || loading ? 0.5 : 1,
    };

    const sizeMap: Record<Size, ViewStyle> = {
      default: { paddingHorizontal: 16, paddingVertical: 10 },
      sm: { paddingHorizontal: 12, paddingVertical: 6 },
      lg: { paddingHorizontal: 20, paddingVertical: 13 },
      icon: { width: 36, height: 36, padding: 0 },
    };

    const variantMap: Record<Variant, ViewStyle> = {
      // Dark: zinc-100 bg + black text. Light: zinc-900 bg + white text.
      // This matches shadcn's high-contrast button that is always readable.
      default: {
        backgroundColor: isDark ? "#e4e4e7" : "#18181b",
      },
      outline: {
        backgroundColor: "transparent",
        borderWidth: 1,
        borderColor: colors.inputBorder,
      },
      ghost: { backgroundColor: "transparent" },
      destructive: { backgroundColor: "#ef4444" },
      secondary: {
        backgroundColor: isDark ? "#27272a" : "#f4f4f5",
        borderWidth: 1,
        borderColor: colors.cardBorder,
      },
      link: { backgroundColor: "transparent" },
    };

    return { ...base, ...sizeMap[size], ...variantMap[variant] };
  };

  // Text color always contrasts the background
  const getTextColor = (): string => {
    switch (variant) {
      case "default":
        return isDark ? "#09090b" : "#fafafa"; // black on light btn (dark mode), white on dark btn (light mode)
      case "outline":
      case "ghost":
      case "secondary":
        return colors.text;
      case "destructive":
        return "#ffffff";
      case "link":
        return colors.text;
      default:
        return colors.text;
    }
  };

  const getSizeTextStyle = (): TextStyle => {
    const map: Record<Size, TextStyle> = {
      default: { fontSize: 14, fontWeight: "500" },
      sm: { fontSize: 13, fontWeight: "500" },
      lg: { fontSize: 15, fontWeight: "600" },
      icon: { fontSize: 14 },
    };
    return map[size];
  };

  const spinnerColor =
    variant === "default"
      ? isDark ? "#09090b" : "#fafafa"
      : variant === "destructive"
      ? "#fff"
      : colors.textMuted;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      style={[getContainerStyle(), style]}
      activeOpacity={0.75}
    >
      {loading && (
        <ActivityIndicator
          size="small"
          color={spinnerColor}
          style={{ marginRight: 6 }}
        />
      )}
      {typeof children === "string" ? (
        <Text style={[{ color: getTextColor() }, getSizeTextStyle(), textStyle]}>
          {children}
        </Text>
      ) : (
        children
      )}
    </TouchableOpacity>
  );
}
