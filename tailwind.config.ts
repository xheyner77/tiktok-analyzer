import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'var(--font-sans)', 'system-ui', 'sans-serif'],
      },
      colors: {
        vn: {
          bg: '#050508',
          surface: '#0b0b10',
          elevated: '#12121a',
          line: 'rgba(255,255,255,0.06)',
          fuchsia: '#e879f9',
          violet: '#a78bfa',
          indigo: '#6366f1',
          glow: '#c084fc',
        },
      },
      backgroundImage: {
        'vn-gradient': 'linear-gradient(120deg, #e879f9 0%, #a78bfa 45%, #6366f1 100%)',
        'vn-radial': 'radial-gradient(ellipse 80% 50% at 50% -20%, rgba(232,121,249,0.15), transparent)',
      },
      animation: {
        'fade-up': 'fadeUp 0.6s ease-out forwards',
        'fade-in': 'fadeIn 0.4s ease-out forwards',
        'spin-slow': 'spin 3s linear infinite',
        'vn-float': 'vnFloat 8s ease-in-out infinite',
        'vn-pulse-soft': 'vnPulseSoft 4s ease-in-out infinite',
      },
      keyframes: {
        fadeUp: {
          '0%': { opacity: '0', transform: 'translateY(24px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        vnFloat: {
          '0%, 100%': { transform: 'translateY(0) scale(1)' },
          '50%': { transform: 'translateY(-6px) scale(1.01)' },
        },
        vnPulseSoft: {
          '0%, 100%': { opacity: '0.4' },
          '50%': { opacity: '0.7' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
