import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

const shellSrc = fileURLToPath(new URL('../../packages/shell/src', import.meta.url));

export default defineConfig({
  base: './',
  plugins: [react()],
  resolve: {
    alias: [
      { find: /^@games\/shell\/styles\.css$/, replacement: `${shellSrc}/ui/styles.css` },
      { find: /^@games\/shell$/, replacement: `${shellSrc}/index.ts` },
    ],
  },
  server: { host: true },
});
