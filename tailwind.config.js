/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        yellow: {
          DEFAULT: '#FFFBD3',
          lt: '#fffde7',
          md: '#ffe9a0',
          text: '#a07800',
        },
        blue: {
          DEFAULT: '#9FBAC5',
          lt: '#edf3f6',
          dk: '#6a95a5',
        },
        green: {
          DEFAULT: '#27ae60',
        },
      },
      borderRadius: {
        DEFAULT: '10px',
      },
      boxShadow: {
        card: '0 2px 12px rgba(0,0,0,.07)',
        md: '0 4px 20px rgba(0,0,0,.10)',
      },
    },
  },
  plugins: [],
}
