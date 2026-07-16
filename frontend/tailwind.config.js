/** @type {import('tailwindcss').Config} */
export default {
  // The `.tsx` glob is essential -- omit it and every class is purged from the
  // production build, producing a completely unstyled page.
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {},
  },
  plugins: [],
};
