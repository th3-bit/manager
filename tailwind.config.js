/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./App.{js,jsx,ts,tsx}", "./screens/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#73f218', // Neon green
          light: '#e6ffda', // Light green
        }
      },
      fontFamily: {
        sans: ['Inter_400Regular'],
        medium: ['Inter_500Medium'],
        bold: ['Inter_700Bold'],
        extrabold: ['Inter_800ExtraBold'],
      }
    },
  },
  plugins: [],
}
