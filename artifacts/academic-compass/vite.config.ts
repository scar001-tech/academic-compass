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
const isProduction = process.env.NODE_ENV === 'production';

async function getReplPlugins() {
  if (isProduction || process.env.REPL_ID === undefined) return [];
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
    sourcemap: isProduction ? 'hidden' : true,
    minify: 'esbuild',
    cssCodeSplit: true,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-ui': [
            '@radix-ui/react-dialog',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-select',
            '@radix-ui/react-tabs',
            '@radix-ui/react-toast',
            '@radix-ui/react-tooltip',
            '@radix-ui/react-popover',
            '@radix-ui/react-accordion',
            '@radix-ui/react-alert-dialog',
            '@radix-ui/react-aspect-ratio',
            '@radix-ui/react-avatar',
            '@radix-ui/react-checkbox',
            '@radix-ui/react-collapsible',
            '@radix-ui/react-context-menu',
            '@radix-ui/react-hover-card',
            '@radix-ui/react-label',
            '@radix-ui/react-menubar',
            '@radix-ui/react-navigation-menu',
            '@radix-ui/react-progress',
            '@radix-ui/react-radio-group',
            '@radix-ui/react-scroll-area',
            '@radix-ui/react-separator',
            '@radix-ui/react-slider',
            '@radix-ui/react-slot',
            '@radix-ui/react-switch',
            '@radix-ui/react-toggle',
            '@radix-ui/react-toggle-group',
            'lucide-react',
            'clsx',
            'tailwind-merge',
            'class-variance-authority',
          ],
          'vendor-forms': [
            'react-hook-form',
            '@hookform/resolvers',
            'zod',
          ],
          'vendor-data': [
            '@tanstack/react-query',
            'wouter',
            'date-fns',
          ],
          'vendor-charts': ['recharts'],
          'vendor-pdf': ['pdfjs-dist', 'jspdf', 'pdf-parse'],
          'vendor-xlsx': ['xlsx'],
          'vendor-docx': ['mammoth'],
          'vendor-utils': [
            'cmdk',
            'embla-carousel-react',
            'framer-motion',
            'input-otp',
            'next-themes',
            'react-day-picker',
            'react-icons',
            'react-resizable-panels',
            'sonner',
            'vaul',
          ],
        },
        chunkFileNames: 'assets/js/[name]-[hash].js',
        entryFileNames: 'assets/js/[name]-[hash].js',
        assetFileNames: (assetInfo) => {
          const info = assetInfo.name.split('.');
          const ext = info[info.length - 1];
          if (/\.(png|jpe?g|gif|svg|webp|avif)$/.test(assetInfo.name)) {
            return `assets/images/[name]-[hash].${ext}`;
          }
          if (/\.(woff2?|eot|ttf|otf)$/.test(assetInfo.name)) {
            return `assets/fonts/[name]-[hash].${ext}`;
          }
          return `assets/[ext]/[name]-[hash].${ext}`;
        },
      },
    },
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
