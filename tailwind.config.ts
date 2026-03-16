import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#1F3864',
          50: '#EBF0F7',
          100: '#D6E0EF',
          200: '#ADC1DF',
          300: '#85A2CF',
          400: '#5C83BF',
          500: '#3A659F',
          600: '#2E5082',
          700: '#1F3864',
          800: '#162847',
          900: '#0D182B',
        },
        accent: {
          DEFAULT: '#2E75B6',
          50: '#EDF4FA',
          100: '#DBEAF5',
          200: '#B7D4EB',
          300: '#93BFE1',
          400: '#6FA9D7',
          500: '#2E75B6',
          600: '#255E92',
          700: '#1C476E',
          800: '#13304A',
          900: '#0A1926',
        },
        success: {
          DEFAULT: '#27AE60',
          50: '#EDFBF3',
          500: '#27AE60',
          700: '#1E8549',
        },
        warning: {
          DEFAULT: '#E8A020',
          50: '#FDF5E6',
          500: '#E8A020',
          700: '#B37D19',
        },
        error: {
          DEFAULT: '#E74C3C',
          50: '#FDECEB',
          500: '#E74C3C',
          700: '#C0392B',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};

export default config;
