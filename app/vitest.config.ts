import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    environment: 'node',
    fileParallelism: false,
    env: {
      DATABASE_URL: process.env.TEST_DATABASE_URL ?? 'postgres://style:style@localhost:5433/style',
      PHOTO_DIR: './data/test-photos',
      ANTHROPIC_API_KEY: '',
      GEMINI_API_KEY: '',
    },
  },
});
