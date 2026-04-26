/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "media",
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "-apple-system",
          '"SF Pro Text"',
          '"SF Pro Display"',
          "system-ui",
          '"PingFang SC"',
          "sans-serif",
        ],
        mono: ['"SF Mono"', "Menlo", "Consolas", "monospace"],
      },
      colors: {
        accent: { light: "#007AFF", dark: "#0A84FF" },
        success: { light: "#34C759", dark: "#32D74B" },
        warning: { light: "#FF9500", dark: "#FF9F0A" },
        danger: { light: "#FF3B30", dark: "#FF453A" },
      },
      spacing: {
        "0.5": "2px",
        "1": "4px",
        "2": "8px",
        "3": "12px",
        "4": "16px",
        "6": "24px",
        "8": "32px",
        "12": "48px",
      },
      borderRadius: {
        sm: "6px",
        DEFAULT: "8px",
        md: "12px",
        lg: "16px",
      },
      transitionTimingFunction: {
        "apple-out": "cubic-bezier(0.16, 1, 0.3, 1)",
      },
      transitionDuration: {
        fast: "120ms",
        base: "180ms",
        slow: "240ms",
        page: "320ms",
      },
    },
  },
  plugins: [],
};
