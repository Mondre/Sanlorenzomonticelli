import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import netlify from '@astrojs/netlify';
import tailwindcss from '@tailwindcss/vite';
export default defineConfig({
  site: process.env.SITE_URL || undefined,
  output: 'static',
  adapter: netlify(),
  integrations: [react()],
  vite: { plugins: [tailwindcss()] },
});
