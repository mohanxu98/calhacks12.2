/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f0fff4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#4ade80',
          500: '#39FF14',
          600: '#22c55e',
          700: '#16a34a',
          800: '#15803d',
          900: '#14532d',
        },
        neon: {
          green: '#39FF14',
          'green-dark': '#2ECC40',
          'green-light': '#7FFF00',
        },
      },
    },
  },
  plugins: [],
}
