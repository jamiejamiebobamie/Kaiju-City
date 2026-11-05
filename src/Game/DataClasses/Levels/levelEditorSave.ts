import fs from 'node:fs';
import path from 'node:path';
import type { Plugin } from 'vite';

/*
  Lets the level editor save over a level's file while the dev server runs.
  It only exists on the dev server: production builds have no save route.
*/
const LEVEL_ID = /^[a-zA-Z0-9]+$/;

// the dialogue viewer saves the story's words over Dialogue/dialogue.json. the viewer keeps its own copy,
// so the file changing doesn't reload it; the game picks the new words up on its next load
export const dialogueSave = (filePath: string): Plugin => ({
  name: 'dialogue-save',
  apply: 'serve',
  handleHotUpdate({ file }) {
    if (path.normalize(file) == path.normalize(filePath)) return [];
  },
  configureServer(server) {
    server.middlewares.use('/__dialogue/save', (request, response) => {
      let body = '';
      request.on('data', chunk => { body += chunk; });
      request.on('end', () => {
        try {
          const dialogue = JSON.parse(body);
          if (!dialogue || typeof dialogue.scenes != 'object') throw new Error('not a dialogue file');
          fs.writeFileSync(filePath, `${JSON.stringify(dialogue, null, 2)}
`);
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

// Adjust window's shape, saved over the repo's own file the same way: it is the game's window from then on
export const playWindowSave = (filePath: string): Plugin => ({
  name: 'play-window-save',
  apply: 'serve',
  handleHotUpdate({ file }) {
    if (path.normalize(file) == path.normalize(filePath)) return [];
  },
  configureServer(server) {
    server.middlewares.use('/__play-window/save', (request, response) => {
      let body = '';
      request.on('data', chunk => { body += chunk; });
      request.on('end', () => {
        try {
          const { left, top, right, bottom } = JSON.parse(body);
          if (![left, top, right, bottom].every(value => typeof value == 'number' && value >= 0 && value <= 1)) throw new Error('bad window');
          fs.writeFileSync(filePath, `${JSON.stringify({ left, top, right, bottom }, null, 2)}\n`);
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
