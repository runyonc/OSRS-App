/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#1c1a17',
        parchment: '#f4ecd8',
        iron: '#8c8c8c',
      },
    },
  },
  plugins: [],
};
