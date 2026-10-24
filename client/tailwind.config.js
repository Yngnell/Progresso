/** @type {import('tailwindcss').Config} */

// Palette taken from the seal of the Sangguniang Kabataan, Salinas 1, City of Bacoor.
// brand  = the seal's azure field, ending in its navy shadow (shell rail)
// accent = the seal's golden sun / SK mark
// red    = the seal's signal-red ribbon
// green  = the seal's bamboo
// slate  = neutrals tinted toward the azure, so greys never feel off-palette
const gold = {
  50: '#FFFBEA',
  100: '#FFF3C4',
  200: '#FCE588',
  300: '#FADB5F',
  400: '#F7C948',
  500: '#F2B705',
  600: '#CB8F00',
  700: '#8A5A00',
  800: '#6B4500',
  900: '#523500',
};

export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Barlow', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        // Numerals, ribbon labels and headings that need the seal's lettering weight
        display: ['"Barlow Condensed"', 'Barlow', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        ink: '#0A0C10', // the seal's black ring
        brand: {
          50: '#EEF5FE',
          100: '#DCEAFD',
          200: '#BBD5FA',
          300: '#8AB8F5',
          400: '#5797EC',
          500: '#2F7FE6',
          600: '#1C66CC',
          700: '#174FA3',
          800: '#123A78',
          900: '#0B1F4A',
          950: '#06122E',
        },
        accent: gold,
        amber: gold,
        red: {
          50: '#FEF1F0',
          100: '#FDE0DE',
          200: '#FBC2BE',
          300: '#F59A93',
          400: '#EB6459',
          500: '#DE3E34',
          600: '#D52826',
          700: '#B01E1E',
          800: '#8F1A1A',
          900: '#761B1B',
        },
        green: {
          50: '#F3F9E8',
          100: '#E3F2C9',
          200: '#C9E79B',
          300: '#A6D562',
          400: '#86BE35',
          500: '#6AA524',
          600: '#538A1B',
          700: '#426E18',
          800: '#37591A',
          900: '#2F4B1A',
        },
        slate: {
          50: '#F4F7FC',
          100: '#E9EEF7',
          200: '#D8E0EE',
          300: '#BAC6DB',
          400: '#627290',
          500: '#566681',
          600: '#445269',
          700: '#334055',
          800: '#222D40',
          900: '#141C2C',
          950: '#0A0F1A',
        },
      },
      boxShadow: {
        card: '0 1px 2px rgba(10,27,68,0.06), 0 1px 1px rgba(10,27,68,0.04)',
        cardHover: '0 14px 30px -10px rgba(10,27,68,0.22), 0 4px 10px -4px rgba(10,27,68,0.10)',
      },
    },
  },
  plugins: [],
};
