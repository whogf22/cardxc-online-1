import type { Config } from 'tailwindcss'

export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Satoshi', 'Inter', 'system-ui', 'sans-serif'],
        display: ['Satoshi', 'Space Grotesk', 'Inter', 'sans-serif'],
      },
      colors: {
        dark: {
          bg: '#030303',
          card: '#0d0d0d',
          elevated: '#141414',
          border: '#1a1a1a',
          hover: '#1f1f1f',
        },
        cream: {
          50: '#fefdfb', 100: '#fdfaf5', 200: '#fbf5eb', 300: '#f7dccc', 400: '#f0c8a8',
          500: '#e8b48a', 600: '#d89a6c', 700: '#c8804e', 800: '#a86a40', 900: '#885534',
        },
        fintech: {
          50: '#f0fdf4', 100: '#dcfce7', 200: '#bbf7d0', 300: '#86efac', 400: '#4ade80',
          500: '#22c55e', 600: '#16a34a', 700: '#15803d', 800: '#166534', 900: '#14532d',
        },
        light: {
          bg: '#ffffff', card: '#f8fafc', border: '#e2e8f0', text: '#1e293b', muted: '#64748b',
        },
        primary: {
          50: '#f0f9ff', 100: '#e0f2fe', 200: '#bae6fd', 300: '#7dd3fc', 400: '#38bdf8',
          500: '#0ea5e9', 600: '#0284c7', 700: '#0369a1', 800: '#075985', 900: '#0c4a6e', 950: '#082f49',
        },
        accent: {
          DEFAULT: '#f7dccc', light: '#fdfaf5', dark: '#e8b48a',
        },
      },
      boxShadow: {
        'card': '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1)',
        'card-hover': '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)',
        'elevated': '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
        'glow': '0 0 20px rgba(247, 220, 204, 0.3)',
        'glow-sm': '0 0 10px rgba(247, 220, 204, 0.2)',
        'inner-glow': 'inset 0 1px 0 rgba(255, 255, 255, 0.05)',
        'dark-card': '0 4px 20px rgba(0, 0, 0, 0.5)',
        'dark-elevated': '0 8px 32px rgba(0, 0, 0, 0.6)',
        '3d-depth': '0 20px 40px -10px rgba(0, 0, 0, 0.8), 0 5px 15px -5px rgba(247, 220, 204, 0.1)',
        '3d-float': '0 30px 60px -12px rgba(0, 0, 0, 0.9), 0 18px 36px -18px rgba(0, 0, 0, 1), 0 -12px 36px -8px rgba(255, 255, 255, 0.05)',
        '3d-pressed': 'inset 0 4px 12px 0 rgba(0, 0, 0,  0.6)',
      },
      borderRadius: {
        '4xl': '2rem',
        '5xl': '2.5rem',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'slide-down': 'slideDown 0.3s ease-out',
        'scale-in': 'scaleIn 0.2s ease-out',
        'pulse-soft': 'pulseSoft 2s ease-in-out infinite',
        'shimmer': 'shimmer 2s linear infinite',
        'float': 'float 3s ease-in-out infinite',
        'perspective-tilt': 'perspectiveTilt 1s ease-out forwards',
      },
      keyframes: {
        fadeIn: { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        slideUp: { '0%': { transform: 'translateY(10px)', opacity: '0' }, '100%': { transform: 'translateY(0)', opacity: '1' } },
        slideDown: { '0%': { transform: 'translateY(-10px)', opacity: '0' }, '100%': { transform: 'translateY(0)', opacity: '1' } },
        scaleIn: { '0%': { transform: 'scale(0.95)', opacity: '0' }, '100%': { transform: 'scale(1)', opacity: '1' } },
        pulseSoft: { '0%, 100%': { opacity: '1' }, '50%': { opacity: '0.7' } },
        shimmer: { '0%': { backgroundPosition: '-1000px 0' }, '100%': { backgroundPosition: '1000px 0' } },
        float: { '0%, 100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-5px)' } },
        perspectiveTilt: {
          '0%': { transform: 'perspective(1000px) rotateX(0deg) rotateY(0deg)' },
          '100%': { transform: 'perspective(1000px) rotateX(2deg) rotateY(-1deg)' },
        },
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-dark': 'linear-gradient(180deg, #0d0d0d 0%, #030303 100%)',
        'gradient-card': 'linear-gradient(145deg, #141414 0%, #0d0d0d 100%)',
        'gradient-cream': 'linear-gradient(135deg, #f7dccc 0%, #e8b48a 100%)',
        'gradient-premium': 'linear-gradient(135deg, #f7dccc 0%, #d89a6c 50%, #c8804e 100%)',
        '3d-mesh': 'radial-gradient(at 0% 0%, rgba(247, 220, 204, 0.05) 0, transparent 50%), radial-gradient(at 100% 0%, rgba(247, 220, 204, 0.02) 0, transparent 50%)',
      },
    },
  },
  plugins: [],
} satisfies Config
