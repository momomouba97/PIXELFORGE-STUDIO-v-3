import { defineConfig, type Plugin } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Strict CSP is injected for production builds only (dev needs inline HMR scripts).
const csp = (): Plugin => ({
  name: 'pf-csp',
  transformIndexHtml(html, ctx) {
    if (ctx.server) return html;
    const policy =
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; " +
      "img-src 'self' data: blob:; font-src 'self' data: blob:; connect-src 'self'; object-src 'none'";
    return html.replace('<!--CSP-->', `<meta http-equiv="Content-Security-Policy" content="${policy}" />`);
  },
});

export default defineConfig({
  base: './',
  plugins: [react(), csp()],
  build: { outDir: 'dist', emptyOutDir: true, sourcemap: false },
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
});
