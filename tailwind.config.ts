import type { Config } from 'tailwindcss'

/**
 * Seo-Ro design system – Lavender/Violet theme (from app icon).
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
        background: '#FAF9FF', // Light Lavender
        foreground: '#1F1F1F', // Deep Charcoal
        primary: '#847DFF',   // Vibrant Lavender/Violet
        accent: '#6B63E6',    // Darker Violet
        'glass-border': 'rgb(132 125 255 / 0.2)',
        'glass-bg': 'rgb(255 255 255 / 0.92)',
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [],
}

export default config
