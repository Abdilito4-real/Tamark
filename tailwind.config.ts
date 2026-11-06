import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        navy: "var(--navy)",
        emerald: "var(--em)",
        light: "var(--lt)",
        canvas: "var(--bg)",
        sun: "var(--sun)",
        ink: "var(--tx)",
        muted: "var(--mu)",
        border: "var(--bd)",
      },
      fontFamily: {
        sans: ["var(--font-jakarta)", "system-ui", "sans-serif"],
      },
      maxWidth: { content: "1180px" },
      boxShadow: { card: "var(--sh)" },
    },
  },
  plugins: [],
};

export default config;
