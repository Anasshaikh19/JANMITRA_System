/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        janmitra: {
          navy: '#0d2a53',
          blue: '#1A56DB',
          lightBlue: '#EBF5FF',
          dark: '#0B192C',
        },
        dept: {
          pwd: '#1A56DB',
          swm: '#16A34A',
          phe: '#0891B2',
          electrical: '#D97706',
        }
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
