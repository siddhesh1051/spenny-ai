import React from "react";
import { BaseToast, ErrorToast } from "react-native-toast-message";
import type { BaseToastProps } from "react-native-toast-message";

const sharedStyle = {
  height: 50,
  borderLeftWidth: 4,
  borderRadius: 10,
  marginHorizontal: 12,
};

const contentContainerStyle = { paddingVertical: 0, paddingHorizontal: 14 };
const text1Style = { fontSize: 13, fontWeight: "600" as const };
const text2Style = { fontSize: 11 };

export const toastConfig = {
  success: (props: BaseToastProps) => (
    <BaseToast
      {...props}
      style={{ ...sharedStyle, borderLeftColor: "#22c55e" }}
      contentContainerStyle={contentContainerStyle}
      text1Style={text1Style}
      text2Style={text2Style}
      text2NumberOfLines={1}
    />
  ),
  error: (props: BaseToastProps) => (
    <ErrorToast
      {...props}
      style={{ ...sharedStyle, borderLeftColor: "#ef4444" }}
      contentContainerStyle={contentContainerStyle}
      text1Style={text1Style}
      text2Style={text2Style}
      text2NumberOfLines={1}
    />
  ),
  info: (props: BaseToastProps) => (
    <BaseToast
      {...props}
      style={{ ...sharedStyle, borderLeftColor: "#60a5fa" }}
      contentContainerStyle={contentContainerStyle}
      text1Style={text1Style}
      text2Style={text2Style}
      text2NumberOfLines={1}
    />
  ),
};

export const TOAST_PROPS = {
  position: "top" as const,
  topOffset: 56,
  config: toastConfig,
};
