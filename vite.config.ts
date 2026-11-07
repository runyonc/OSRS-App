import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// ARTIFACT=1 builds a single-file bundle (no code splitting) for hosts that cannot serve extra files.
const singleFile = process.env.ARTIFACT === '1';

export default defineConfig({
  plugins: [react()],
  base: './',
  build: singleFile
    ? { outDir: 'dist-artifact', rollupOptions: { output: { inlineDynamicImports: true } } }
    : undefined,
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
