/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: { sans: ['Poppins', 'ui-sans-serif', 'system-ui', 'sans-serif'] },
      colors: {
        // White variants: page, cards, wells, borders
        canvas: '#F7F7F7',
        card: '#FFFFFF',
        mist: '#F5F5F5',
        stone: '#EEEEEE',
        line: '#E9E9E9',
        // Ink
        ink: '#111111',
        'ink-soft': '#555555',
        'ink-faint': '#888888',
        // Functional only
        sale: '#B42318',
      },
      fontSize: {
        display: ['3.5rem', { lineHeight: '1.02', letterSpacing: '-0.055em', fontWeight: '700' }],
        'display-sm': ['2.25rem', { lineHeight: '1.05', letterSpacing: '-0.045em', fontWeight: '700' }],
        title: ['1.125rem', { lineHeight: '1.5rem', fontWeight: '600' }],
        body: ['0.875rem', { lineHeight: '1.5rem' }],
        small: ['0.75rem', { lineHeight: '1.15rem' }],
        micro: ['0.625rem', { lineHeight: '0.9rem', letterSpacing: '0.02em' }],
      },
      spacing: { gutter: '1rem', sidebar: '17.5rem', 'page-x': '4vw' },
      maxWidth: { page: '1440px' },
    },
  },
  plugins: [],
};
