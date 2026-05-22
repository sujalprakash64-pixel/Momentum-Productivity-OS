import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "#0b0d10",
        foreground: "#f4f7fb",
        muted: "#9aa4b2",
        panel: "#11161d",
        panel2: "#161d26",
        line: "#263241",
        accent: "#f4b942",
        cyan: "#4cc9f0",
        green: "#54d68a",
        red: "#ff6b7a"
      },
      borderRadius: {
        lg: "8px",
        md: "6px",
        sm: "4px"
      }
    }
  },
  plugins: []
};

export default config;
