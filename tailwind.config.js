/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#1c1a17',
        parchment: '#f4ecd8',
        iron: '#9a9a9a',
        // OSRS interface browns stand in for the neutral scale.
        zinc: {
          50: '#faf4e4', 100: '#f1e6cc', 200: '#e2d1ab', 300: '#c9b48a', 400: '#a78f6a', 500: '#846e4f',
          600: '#64523a', 700: '#4a3c2a', 800: '#352b1e', 900: '#241d14', 950: '#17120c',
        },
        // OSRS orange for the accent.
        amber: {
          100: '#ffe3b8', 200: '#ffd08a', 300: '#ffbb5c', 400: '#ffa733', 500: '#ff981f',
          600: '#e07f0f', 700: '#b4640b', 800: '#8a4c0a', 900: '#5e3408', 950: '#3a2005',
        },
      },
      fontFamily: {
        display: ['Cinzel', 'Georgia', 'serif'],
      },
    },
  },
  plugins: [],
};
