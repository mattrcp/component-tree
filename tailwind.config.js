/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        "figma-bg": "#ffffff",
        "figma-text": "#1a1a1a",
        "figma-border": "#e5e5e5",
        "figma-blue": "#18A0FB",
        "figma-surface": "#f7f7f5",
        "figma-muted": "#737373",
        "figma-hover": "#f0f0f0",
      },
    },
  },
  plugins: [],
};
