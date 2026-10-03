import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // 风险四级色板 — 克制、医疗级
        stable: "#16a34a",
        watch: "#d97706",
        important: "#ea580c",
        critical: "#dc2626",
        // 品牌主色：沉稳青蓝（trust / calm）
        brand: {
          50: "#f0f7fa",
          100: "#dcecf2",
          200: "#b9d9e5",
          300: "#8abed2",
          400: "#569cb8",
          500: "#347d9c",
          600: "#246480",
          700: "#1d5067",
          800: "#1a4254",
          900: "#193847",
        },
        ink: {
          DEFAULT: "#0f2231",
          soft: "#39556b",
          mute: "#6b8598",
        },
        surface: {
          DEFAULT: "#ffffff",
          soft: "#f6f9fb",
          line: "#e4edf3",
        },
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Inter",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
      },
      boxShadow: {
        card: "0 1px 2px rgba(15, 34, 49, 0.04), 0 1px 3px rgba(15, 34, 49, 0.06)",
        lift: "0 4px 12px rgba(15, 34, 49, 0.08), 0 2px 4px rgba(15, 34, 49, 0.06)",
      },
      borderRadius: {
        xl2: "1rem",
      },
    },
  },
  plugins: [],
};

export default config;
