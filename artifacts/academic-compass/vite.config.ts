import path from 'path';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

const rawPort = process.env.VITE_PORT ?? process.env.PORT ?? '5173';
const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid frontend port value: "${rawPort}"`);
}

const basePath = process.env.BASE_PATH ?? '/';
const apiOrigin = process.env.VITE_API_ORIGIN ?? process.env.API_ORIGIN ?? 'http://localhost:8080';
const projectRoot = process.cwd();

async function getReplPlugins() {
  if (process.env.NODE_ENV === 'production' || process.env.REPL_ID === undefined) return [];
  const plugins = [];
  try {
    const m = await import('@replit/vite-plugin-cartographer');
    if (m?.cartographer) plugins.push(m.cartographer({ root: path.resolve(import.meta.dirname, '..') }));
  } catch {}
  try {
    const m = await import('@replit/vite-plugin-dev-banner');
    if (m?.default) plugins.push(m.default());
  } catch {}
  try {
    const m = await import('@replit/vite-plugin-runtime-error-modal');
    if (m?.default) plugins.push(m.default);
  } catch {}
  return plugins;
}

export default defineConfig({
  base: basePath,
  plugins: [
    react(),
    tailwindcss(),
    ...(await getReplPlugins()),
  ],
  resolve: {
    alias: {
      '@': path.resolve(projectRoot, 'src'),
      '@assets': path.resolve(
        projectRoot,
        '..',
        'attached_assets',
      ),
    },
    dedupe: ['react', 'react-dom'],
  },
  root: projectRoot,
  build: {
    outDir: path.resolve(projectRoot, 'dist/public'),
    emptyOutDir: true,
  },
  server: {
    port,
    strictPort: true,
    host: '0.0.0.0',
    allowedHosts: true,
    proxy: {
      '/api': {
        target: apiOrigin,
        changeOrigin: true,
      },
    },
    fs: {
      strict: true,
    },
  },
  preview: {
    port,
    host: '0.0.0.0',
    allowedHosts: true,
  },
});
