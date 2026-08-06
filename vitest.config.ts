import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'unit',
          include: ['src/**/*.unit.test.ts'],
        },
      },
      {
        test: {
          name: 'integration',
          include: ['src/**/*.integration.test.ts'],
          setupFiles: ['src/common/test/integration-setup.ts'],
          // Integration files share one real Mongo/Redis and each does its own
          // afterEach collection cleanup — running files concurrently lets one file's
          // cleanup wipe data another file's test is mid-way through using.
          fileParallelism: false,
        },
      },
    ],
  },
});
