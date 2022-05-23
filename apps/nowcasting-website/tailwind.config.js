module.exports = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        goldenrod: {
          DEFAULT: "#FFC629",
          50: "#FFF7E1",
          100: "#FFF1CC",
          200: "#FFE7A3",
          300: "#FFDC7B",
          400: "#FFD152",
          500: "#FFC629",
          600: "#F0B000",
          700: "#B88700",
          800: "#805E00",
          900: "#483500",
        },
      },
    },
  },
  plugins: [require("@tailwindcss/forms"), require("@tailwindcss/typography")],
};
