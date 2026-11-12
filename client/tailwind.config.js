/** @type {import('tailwindcss').Config} */

// "Calm paper notebook" palette. The source values live in src/theme.css; the ramps
// below are built around them so the existing class names keep working:
//   brand  = pine  (primary actions, links, active menu)        600 = --pine
//   accent = mustard (pending, warning)                          500 = --mustard
//   red    = clay  (important actions, alerts, rejected)         500 = --clay, 600 = text-safe clay
//   green  = sage  (success, completed)                          400 = --sage, 600 = text-safe sage
//   slate  = warm paper neutrals                                 200 = --line, 600 = --ink-soft, 900 = --ink
const mustard = {
  50: '#FDF8EC',
  100: '#F9EED3',
  200: '#F3DCA6',
  300: '#ECC772',
  400: '#E6B754',
  500: '#E0A93B',
  600: '#B88523',
  700: '#8A5F12',
  800: '#6B4A10',
  900: '#52380D',
};

const cssVar = (name) => `var(--${name})`;

export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Lexend', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        // Headings, page titles and large figures
        display: ['"Young Serif"', 'Georgia', '"Times New Roman"', 'serif'],
      },
      colors: {
        ink: '#23211E',
        // Named theme colours (read from theme.css)
        paper: cssVar('paper'),
        panel: cssVar('panel'),
        line: cssVar('line'),
        pine: { DEFAULT: cssVar('pine'), dark: cssVar('pine-dark'), light: cssVar('pine-light') },
        clay: { DEFAULT: cssVar('clay'), text: cssVar('clay-text'), wash: cssVar('clay-wash') },
        mustard: { DEFAULT: cssVar('mustard'), text: cssVar('mustard-text'), wash: cssVar('mustard-wash') },
        sage: { DEFAULT: cssVar('sage'), text: cssVar('sage-text'), wash: cssVar('sage-wash') },
        'ink-soft': cssVar('ink-soft'),
        brand: {
          50: '#F1F6F2',
          100: '#E3ECE5',
          200: '#C7D8CC',
          300: '#9DBBA6',
          400: '#6A967A',
          500: '#3F7258',
          600: '#1F4D3A',
          700: '#193F30',
          800: '#143326',
          900: '#0F271D',
          950: '#0A1A13',
        },
        accent: mustard,
        amber: mustard,
        red: {
          50: '#FBF1EC',
          100: '#F8E8DF',
          200: '#EDC0AD',
          300: '#E19A7D',
          400: '#D47A55',
          500: '#C8643B',
          600: '#A9502C',
          700: '#8A4024',
          800: '#6C321D',
          900: '#532718',
        },
        green: {
          50: '#F2F6F1',
          100: '#E6EDE3',
          200: '#C9D7C6',
          300: '#A9BFA5',
          400: '#7F9A7A',
          500: '#66805F',
          600: '#4F664C',
          700: '#42563F',
          800: '#334331',
          900: '#283527',
        },
        slate: {
          50: '#FAF6EE',
          100: '#F1EBDF',
          200: '#E2D9C8',
          300: '#CFC4AF',
          400: '#A39A8B',
          500: '#776F64',
          600: '#6B655C',
          700: '#4E4942',
          800: '#36332E',
          900: '#23211E',
          950: '#171513',
        },
      },
      maxWidth: {
        content: cssVar('content-max'),
      },
      width: {
        sidebar: cssVar('sidebar-width'),
      },
      borderRadius: {
        card: cssVar('radius-card'),
        control: cssVar('radius-control'),
      },
      boxShadow: {
        // Paper does not float: at most a 1px edge
        card: '0 1px 0 rgba(35,33,30,0.04)',
        cardHover: '0 1px 2px rgba(35,33,30,0.08)',
      },
      screens: {
        // The sidebar collapses below 900px
        nav: '900px',
      },
    },
  },
  plugins: [],
};
