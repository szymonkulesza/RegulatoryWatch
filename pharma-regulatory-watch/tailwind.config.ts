import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef4fb',
          100: '#d9e6f5',
          600: '#1d4e89',
          700: '#163c6a',
          800: '#102a4c',
        },
      },
    },
  },
  plugins: [],
};

export default config;
