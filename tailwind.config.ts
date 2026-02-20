import type { Config } from 'tailwindcss'

/**
 * Seo-Ro "Frosted Paper" design system (UI_SPECS.md).
 * Tailwind v4 prefers @theme in CSS (see app/globals.css); this file keeps
 * theme tokens in sync for tooling and reference.
 */
const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: '#F9F5EB', // Warm Beige
        primary: '#2F5233',   // Forest Green
        accent: '#C15B46',    // Terracotta
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [],
}

export default config
