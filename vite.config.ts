import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { classReviewSave, dialogueSave, levelEditorSave, playWindowSave } from './src/Game/DataClasses/Levels/levelEditorSave';

const src = fileURLToPath(new URL('./src', import.meta.url));

export default defineConfig({
  plugins: [react(), levelEditorSave(`${src}/Game/DataClasses/Levels/data`), playWindowSave(`${src}/Game/DataClasses/playWindow.json`), dialogueSave(`${src}/Game/DataClasses/Dialogue/dialogue.json`), classReviewSave(`${src}/Game/DataClasses/classOptions.json`, `${src}/Game/DataClasses/sciFiClasses.ts`)],
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
