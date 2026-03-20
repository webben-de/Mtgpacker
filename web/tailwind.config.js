const { createGlobPatternsForDependencies } = require('@nx/angular/tailwind');
const { join } = require('path');

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    join(__dirname, 'src/**/!(*.stories|*.spec).{ts,html}'),
    ...createGlobPatternsForDependencies(__dirname),
  ],
  theme: {
    extend: {
      colors: {
        mtg: {
          bg:        '#0F0F23',
          card:      '#1A1833',
          'card-hover': '#221F42',
          border:    '#2D2B55',
          'border-bright': '#7C3AED',
          primary:   '#7C3AED',
          secondary: '#A78BFA',
          accent:    '#F43F5E',
          gold:      '#D4AF37',
          text:      '#E2E8F0',
          muted:     '#64748B',
          destructive: '#EF4444',
          success:   '#22C55E',
        },
      },
      fontFamily: {
        display: ['"Russo One"', 'sans-serif'],
        body:    ['"Chakra Petch"', 'sans-serif'],
      },
      boxShadow: {
        'glow-primary': '0 0 20px rgba(124,58,237,0.3)',
        'glow-accent':  '0 0 20px rgba(244,63,94,0.3)',
        'glow-gold':    '0 0 15px rgba(212,175,55,0.2)',
        'card':         '0 4px 24px rgba(0,0,0,0.4)',
      },
      keyframes: {
        'fade-in': { from: { opacity: '0', transform: 'translateY(8px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        'scale-in': { from: { opacity: '0', transform: 'scale(0.95)' }, to: { opacity: '1', transform: 'scale(1)' } },
        'pulse-glow': { '0%,100%': { boxShadow: '0 0 10px rgba(124,58,237,0.2)' }, '50%': { boxShadow: '0 0 25px rgba(124,58,237,0.5)' } },
      },
      animation: {
        'fade-in':    'fade-in 0.2s ease-out',
        'scale-in':   'scale-in 0.15s ease-out',
        'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
