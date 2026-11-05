import { existsSync } from 'node:fs';
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import netlify from '@astrojs/netlify';
import tailwindcss from '@tailwindcss/vite';
const logoFile = ['logo-societa.png', 'logo-societa.jpg', 'logo-societa.jpeg', 'logo-societa.webp'].find(name => existsSync(new URL(`./public/${name}`, import.meta.url)));
export default defineConfig({
  site: process.env.SITE_URL || undefined,
  output: 'static',
  adapter: netlify(),
  integrations: [react()],
  vite: { define: { __CLUB_LOGO__: JSON.stringify(logoFile ? `/${logoFile}` : '/crest.svg') }, plugins: [tailwindcss()] },
});
