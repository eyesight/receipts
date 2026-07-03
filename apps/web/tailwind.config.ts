import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{astro,html,js,jsx,ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Montserrat", "sans-serif"],
        serif: ["Lora", "serif"],
      },
      colors: {
        turkies: "#50e3c2",
        blacky: "#282c29",
        "light-grey": "#fafafa",
      },
    },
  },
  plugins: [],
} satisfies Config;
