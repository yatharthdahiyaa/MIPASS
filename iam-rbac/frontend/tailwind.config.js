/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        aws: {
          navy: '#232F3E',
          navydark: '#131A22',
          orange: '#FF9900',
          orangeHover: '#EC7211',
          blue: '#0073BB',
          blueHover: '#005A94',
          lightbg: '#EAEDED',
          border: '#D5DBDB',
          card: '#FFFFFF',
          text: '#16191F',
          textMuted: '#545B64',
          darkCard: '#1E2738',
          darkBg: '#0F172A',
          darkBorder: '#334155',
        },
      },
      fontFamily: {
        sans: [
          '"Amazon Ember"',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          'Helvetica',
          'Arial',
          'sans-serif',
        ],
        mono: ['"Amazon Ember Mono"', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [],
};
