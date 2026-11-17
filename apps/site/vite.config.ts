import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import { lumdaConfig } from '@lumda/build';

const root = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig(
  lumdaConfig(root, '', {
    build: {
      rollupOptions: {
        input: {
          home: resolve(root, 'index.html'),
          staff: resolve(root, 'staff/index.html'),
        },
      },
    },
  }),
);
