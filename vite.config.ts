import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: 'firebase-firestore', test: /node_modules[\\/]@firebase[\\/]firestore/ },
            { name: 'firebase-auth', test: /node_modules[\\/]@firebase[\\/]auth/ },
            { name: 'react-core', test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/ },
            // One shared chunk instead of dozens of sub-kilobyte icon chunks.
            { name: 'icons', test: /node_modules[\\/]lucide-react[\\/]/ },
          ],
        },
      },
    },
  },
  server: {
    port: 3000,
  },
  resolve: {
    alias: [
      { find: '@', replacement: path.resolve(__dirname, './src') },
      // Optional jsPDF dependencies (`.html()` and SVG) that the PDF export never uses.
      {
        find: /^(html2canvas|dompurify|canvg)$/,
        replacement: path.resolve(__dirname, './src/shared/lib/stubs/unsupportedOptionalModule.ts'),
      },
    ],
  },
});
