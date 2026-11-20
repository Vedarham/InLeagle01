/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        /* Page surfaces */
        paper: '#F7F8F7',
        rail: '#FBFCFB',
        surface: '#FFFFFF',
        line: '#E4EBE7',
        'line-soft': '#EFF3F0',

        /* Type */
        ink: '#16363D',
        'ink-soft': '#33544E',
        muted: '#7C8E88',
        'muted-2': '#95A59E',

        /* Brand teal */
        teal: {
          DEFAULT: '#153F44',
          deep: '#0F3135',
          600: '#1D5B59',
          700: '#12363A',
          soft: '#E7F0ED',
          tint: '#DCEBE4',
        },

        sage: '#A6BAB3',
        ember: '#C4703D',
        gold: '#C4B37F',

        /* Legal update (amber) */
        amber: {
          bg: '#FBF6EF',
          line: '#F3E5D4',
          tile: '#F6E9D9',
          accent: '#9A6B4F',
          ink: '#5C4438',
          text: '#9A7A68',
        },

        /* Research tip (mint) */
        mint: {
          bg: '#EAF2ED',
          line: '#DCEAE0',
          tile: '#D6E7DA',
          accent: '#2F6B57',
          ink: '#2C4E46',
        },

        lilac: '#EFEDF7',
      },
      fontFamily: {
        serif: ['Fraunces', 'Georgia', 'Times New Roman', 'serif'],
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
      },
      borderRadius: {
        xl: '14px',
        '2xl': '18px',
        '3xl': '22px',
      },
      boxShadow: {
        card: '0 1px 2px rgba(21,63,68,0.04)',
        lift: '0 18px 40px -26px rgba(21,63,68,0.45)',
        hero: '0 24px 60px -34px rgba(21,63,68,0.65)',
        pop: '0 20px 48px -20px rgba(21,63,68,0.28)',
      },
      transitionTimingFunction: {
        soft: 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
      keyframes: {
        fadeUp: {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        blink: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0' },
        },
        typing: {
          '0%, 60%, 100%': { transform: 'translateY(0)', opacity: '0.35' },
          '30%': { transform: 'translateY(-4px)', opacity: '1' },
        },
        slideIn: {
          from: { transform: 'translateX(24px)', opacity: '0' },
          to: { transform: 'translateX(0)', opacity: '1' },
        },
        toastIn: {
          from: { transform: 'translateY(12px)', opacity: '0' },
          to: { transform: 'translateY(0)', opacity: '1' },
        },
      },
      animation: {
        'fade-up': 'fadeUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) both',
        'fade-in': 'fadeIn 0.25s ease-out both',
        blink: 'blink 0.9s steps(1) infinite',
        typing: 'typing 1.4s infinite',
        'slide-in': 'slideIn 0.35s cubic-bezier(0.16, 1, 0.3, 1) both',
        'toast-in': 'toastIn 0.25s cubic-bezier(0.16, 1, 0.3, 1) both',
      },
    },
  },
  plugins: [],
};
