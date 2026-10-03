import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // 统一风险四级色板 — PRD §3
        stable: "#22c55e",
        watch: "#eab308",
        important: "#f97316",
        critical: "#ef4444",
      },
    },
  },
  plugins: [],
};

export default config;
