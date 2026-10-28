import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    environment: 'node',
    globalSetup: './tests/global-setup.ts',
    fileParallelism: false,
    env: {
      DATABASE_URL: 'postgres://style:style@localhost:5433/style_test',
      PHOTO_DIR: './data/test-photos',
      ANTHROPIC_API_KEY: '',
      GEMINI_API_KEY: '',
    },
  },
});
