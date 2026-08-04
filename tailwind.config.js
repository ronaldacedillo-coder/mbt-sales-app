/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      colors: {
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
        },
        status: {
          draft: '#6b7280',
          pending: '#f59e0b',
          approved: '#10b981',
          rejected: '#ef4444',
        }
      },
      transitionTimingFunction: {
        'out-strong': 'cubic-bezier(0.23, 1, 0.32, 1)',      // strong ease-out, for entrances/exits
        'in-out-strong': 'cubic-bezier(0.77, 0, 0.175, 1)',  // strong ease-in-out, for on-screen movement (e.g. sidebar slide)
      },
      transitionDuration: {
        '160': '160ms', // press feedback
      },
    },
  },
  plugins: [],
}