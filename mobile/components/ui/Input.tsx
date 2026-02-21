import React from "react";
import {
  TextInput,
  TextInputProps,
  View,
  Text,
  ViewStyle,
} from "react-native";
import { useTheme } from "../../context/ThemeContext";

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  containerStyle?: ViewStyle;
}

export function Input({ label, error, containerStyle, style, ...props }: InputProps) {
  const { colors } = useTheme();

  return (
    <View style={containerStyle}>
      {label && (
        <Text
          style={{
            fontSize: 13,
            fontWeight: "500",
            color: colors.textMuted,
            marginBottom: 6,
          }}
        >
          {label}
        </Text>
      )}
      <TextInput
        style={[
          {
            backgroundColor: colors.input,
            borderWidth: 1,
            borderColor: error ? colors.destructive : colors.inputBorder,
            borderRadius: 8,
            paddingHorizontal: 12,
            paddingVertical: 10,
            fontSize: 15,
            color: colors.text,
          },
          style,
        ]}
        placeholderTextColor={colors.textSecondary}
        {...props}
      />
      {error && (
        <Text style={{ fontSize: 12, color: colors.destructive, marginTop: 4 }}>
          {error}
        </Text>
      )}
    </View>
  );
}
