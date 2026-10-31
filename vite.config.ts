import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { levelEditorSave } from './src/Game/Levels/levelEditorSave';

const src = fileURLToPath(new URL('./src', import.meta.url));

export default defineConfig({
  plugins: [react(), levelEditorSave(`${src}/Game/Levels/data`)],
  resolve: {
    // the project's absolute imports (eg. 'Game/utils'), also listed in tsconfig.json
    alias: [
      { find: /^(Components|Game|Settings|Tutorial|Utils)\//, replacement: `${src}/$1/` },
      { find: /^Home$/, replacement: `${src}/Home.jsx` },
      { find: /^App\.css$/, replacement: `${src}/App.css` },
    ],
  },
  build: { outDir: 'build' },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
