import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { lumdaConfig } from '@lumda/build';

export default defineConfig(lumdaConfig(fileURLToPath(new URL('.', import.meta.url)), 'l04/'));
