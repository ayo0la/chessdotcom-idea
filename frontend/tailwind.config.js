/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["DM Sans", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["Space Grotesk", "DM Sans", "ui-sans-serif", "sans-serif"],
      },
      borderRadius: {
        card: "16px",
      },
      boxShadow: {
        glow: "0 0 24px rgba(16, 185, 129, 0.25)",
        "glow-sm": "0 0 12px rgba(16, 185, 129, 0.2)",
        card: "0 1px 0 rgba(255,255,255,0.06) inset, 0 8px 30px rgba(0,0,0,0.35)",
      },
      transitionTimingFunction: {
        swift: "cubic-bezier(0.16, 1, 0.3, 1)",
      },
      keyframes: {
        rise: {
          from: { opacity: "0", transform: "translateY(10px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        drift: {
          "0%, 100%": { transform: "translate(0, 0) scale(1)" },
          "50%": { transform: "translate(40px, -30px) scale(1.1)" },
        },
        fadeOut: {
          "0%, 70%": { opacity: "1" },
          "100%": { opacity: "0" },
        },
      },
      animation: {
        rise: "rise 0.5s cubic-bezier(0.16, 1, 0.3, 1) both",
        drift: "drift 18s ease-in-out infinite",
        "drift-slow": "drift 26s ease-in-out infinite reverse",
        "fade-out": "fadeOut 3s ease-out forwards",
      },
    },
  },
  plugins: [],
};
