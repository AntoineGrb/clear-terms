/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./*.html",
    "./*.js",
    "./services/**/*.js",
    "./utils/**/*.js",
    "./content-script/**/*.js",
    "./pages/**/*.js",
    "./pages/**/*.html"
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          500: '#667eea',
          600: '#5568d3',
        },
        secondary: {
          500: '#764ba2',
        }
      },
      keyframes: {
        spin: {
          from: { transform: 'rotate(0deg)' },
          to: { transform: 'rotate(360deg)' }
        }
      },
      animation: {
        spin: 'spin 1s linear infinite'
      }
    },
  },
  plugins: [],
}
