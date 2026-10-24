import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", "Arial", "sans-serif"],
        serif: ["var(--font-serif)", "Georgia", "serif"],
      },
      // Heart Witness palette
      colors: {
        cream: "#FAF7F2", // page & navbar background
        ink: "#44332D", // headings and primary text
        muted: {
          DEFAULT: "#75675F", // paragraphs and secondary text
          light: "#A39589", // hints, placeholders
        },
        sand: {
          DEFAULT: "#E8D8C7", // borders and dividers
          light: "#F3EBE1", // subtle fills (tags, hovers)
        },
        // Brand accent — 600 is the primary button colour
        terracotta: {
          50: "#FBF1EC",
          100: "#F6E6E0",
          200: "#ECCFC4",
          300: "#DDB3A5",
          500: "#C27460",
          600: "#B76550",
          700: "#9E5242",
        },
      },
      borderColor: {
        DEFAULT: "#E8D8C7",
      },
    },
  },
  plugins: [],
};

export default config;
