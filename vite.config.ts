import { defineConfig } from 'vite';

export default defineConfig({
  base: '/tension-wheels/',
  test: {
    include: ['tests/**/*.test.ts'],
  },
});
