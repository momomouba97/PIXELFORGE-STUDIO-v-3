/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg0: '#0d0e12', bg1: '#15171c', bg2: '#1d2027', bg3: '#272b34',
        line: '#2a2e37', accent: '#ff6a3d', accent2: '#ffb36b', ink: '#e8eaf0', mute: '#8a90a0',
      },
      fontFamily: {
        ui: ['-apple-system', 'BlinkMacSystemFont', '"Helvetica Neue"', '"Geeza Pro"', 'Arial', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
