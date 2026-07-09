import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        canvas: "#ffffff",
        "canvas-dark": "#0a0a0a",
        surface: "#f7f7f7",
        "surface-soft": "#fafafa",
        "surface-code": "#1c1c1e",
        hairline: "#e5e5e5",
        "hairline-soft": "#ededed",
        "hairline-dark": "#1f1f1f",
        ink: "#0a0a0a",
        charcoal: "#1c1c1e",
        slate: "#3a3a3c",
        steel: "#5a5a5c",
        stone: "#888888",
        muted: "#a8a8aa",
        "on-dark": "#ffffff",
        "on-dark-muted": "#b3b3b3",
        brand: {
          DEFAULT: "#00d4a4",
          deep: "#00b48a",
          soft: "#7cebcb",
        },
        clinical: {
          red: "#d45656",
          orange: "#f59e0b",
          blue: "#3772cf",
        },
      },
      fontFamily: {
        sans: ["Inter", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "sans-serif"],
        mono: ["Geist Mono", "SF Mono", "Menlo", "Consolas", "monospace"],
      },
      fontSize: {
        "hero-display": ["72px", { lineHeight: "1.05", letterSpacing: "-2px", fontWeight: "600" }],
        "display-lg": ["56px", { lineHeight: "1.10", letterSpacing: "-1.5px", fontWeight: "600" }],
        "heading-1": ["48px", { lineHeight: "1.10", letterSpacing: "-1px", fontWeight: "600" }],
        "heading-2": ["36px", { lineHeight: "1.20", letterSpacing: "-0.5px", fontWeight: "600" }],
        "heading-3": ["28px", { lineHeight: "1.25", fontWeight: "600" }],
        "heading-4": ["22px", { lineHeight: "1.30", fontWeight: "600" }],
        "heading-5": ["18px", { lineHeight: "1.40", fontWeight: "600" }],
      },
      borderRadius: {
        xs: "4px",
        sm: "6px",
        md: "8px",
        lg: "12px",
        xl: "16px",
        xxl: "24px",
      },
      spacing: {
        section: "64px",
        "section-lg": "96px",
        hero: "120px",
      },
      boxShadow: {
        subtle: "rgba(0, 0, 0, 0.04) 0px 1px 2px 0px",
        card: "rgba(0, 0, 0, 0.08) 0px 4px 12px 0px",
        mockup: "rgba(0, 0, 0, 0.12) 0px 24px 48px -8px",
        brand: "rgba(0, 212, 164, 0.08) 0px 8px 24px",
      },
    },
  },
  plugins: [],
};

export default config;
