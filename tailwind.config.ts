import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx}", "./components/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#211F1B",
        paper: "#F5F1E8",
        ivory: "#FFFDF8",
        sage: "#65736A",
        clay: "#B47B62",
        pewter: "#8A8479"
      },
      boxShadow: {
        paper: "0 22px 45px rgba(33, 31, 27, 0.12)",
        entry: "0 12px 26px rgba(33, 31, 27, 0.07)"
      }
    }
  },
  plugins: []
};

export default config;
