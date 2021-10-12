const defaultTheme = require("tailwindcss/defaultTheme");

module.exports = {
  purge: ["./pages/**/*.{js,ts,jsx,tsx}", "./components/**/*.{js,ts,jsx,tsx}"],
  darkMode: false, // or 'media' or 'class'
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter var", ...defaultTheme.fontFamily.sans],
      },
    },
    colors: {
      yellow: {
        DEFAULT: "#FFC425",
        50: "#FFFFFF",
        100: "#FFFBF1",
        200: "#FFEDBE",
        300: "#FFE08B",
        400: "#FFD258",
        500: "#FFC425",
        600: "#F1B000",
        700: "#BE8B00",
        800: "#8B6500",
        900: "#584000",
      },
    },
  },
  variants: {
    extend: {},
  },
  plugins: [require("@tailwindcss/forms")],
};
