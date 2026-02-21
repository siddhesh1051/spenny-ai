/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./App.{js,jsx,ts,tsx}", "./screens/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: "hsl(var(--card))",
        "card-foreground": "hsl(var(--card-foreground))",
        primary: {
          DEFAULT: "#7c3aed",
          foreground: "#ffffff",
        },
        muted: {
          DEFAULT: "#71717a",
          foreground: "#a1a1aa",
        },
        border: "#3f3f46",
        destructive: "#ef4444",
      },
    },
  },
  plugins: [],
};
