import fs from 'node:fs';
import path from 'node:path';
import type { Plugin } from 'vite';

/*
  Lets the level editor save over a level's file while the dev server runs.
  It only exists on the dev server: production builds have no save route.
*/
const LEVEL_ID = /^[a-zA-Z0-9]+$/;

export const levelEditorSave = (dataDirectory: string): Plugin => ({
  name: 'level-editor-save',
  apply: 'serve',
  // the editors put a saved level to use themselves. a reload would throw away the match.
  handleHotUpdate({ file }) {
    if (path.normalize(file).startsWith(path.normalize(dataDirectory))) return [];
  },
  configureServer(server) {
    server.middlewares.use('/__level-editor/save', (request, response) => {
      let body = '';
      request.on('data', chunk => { body += chunk; });
      request.on('end', () => {
        try {
          const level = JSON.parse(body);
          const filePath = path.join(dataDirectory, `${level.id}.json`);
          if (!LEVEL_ID.test(level.id) || !fs.existsSync(filePath)) throw new Error('unknown level');
          fs.writeFileSync(filePath, `${JSON.stringify(level, null, 2)}\n`);
          response.statusCode = 200;
          response.end('saved');
        } catch (error) {
          response.statusCode = 400;
          response.end(String(error));
        }
      });
    });
  }
});
