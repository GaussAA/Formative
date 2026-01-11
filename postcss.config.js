/**
 * PostCSS Configuration for Tailwind CSS v4
 *
 * Tailwind CSS v4 uses a new PostCSS plugin that processes:
 * - @import 'tailwindcss' statements
 * - @theme { } directives
 * - All utility classes
 *
 * @see https://tailwindcss.com/docs/installation/using-postcss
 */
module.exports = {
  plugins: {
    '@tailwindcss/postcss': {},
  },
};
