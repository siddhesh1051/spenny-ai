import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  external: [
    "react",
    "react/jsx-runtime",
    "recharts",
    "lucide-react",
    "clsx",
    "tailwind-merge",
  ],
  jsx: "react-jsx",
  clean: true,
});
