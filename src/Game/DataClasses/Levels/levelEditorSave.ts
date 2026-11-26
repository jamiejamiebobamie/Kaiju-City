import fs from 'node:fs';
import path from 'node:path';
import type { Plugin } from 'vite';

/*
  Lets the level editor save over a level's file while the dev server runs.
  It only exists on the dev server: production builds have no save route.
*/
const LEVEL_ID = /^[a-zA-Z0-9]+$/;

// the class review saves its progress over classOptions.json, and writes each confirmed pick into sciFiClasses.ts,
// whose line for that combo it replaces: the drafts stay in classOptions.json either way
export const classReviewSave = (optionsPath: string, classesPath: string): Plugin => ({
  name: 'class-review-save',
  apply: 'serve',
  handleHotUpdate({ file }) {
    if (path.normalize(file) == path.normalize(optionsPath)) return [];
  },
  configureServer(server) {
    server.middlewares.use('/__classes/save', (request, response) => {
      let body = '';
      request.on('data', chunk => { body += chunk; });
      request.on('end', () => {
        try {
          const options = JSON.parse(body);
          if (!options || typeof options.combos != 'object') throw new Error('not a class options file');
          fs.writeFileSync(optionsPath, `${JSON.stringify(options, null, 2)}
`);
          let classes = fs.readFileSync(classesPath, 'utf8');
          Object.entries(options.combos).forEach(([key, combo]: [string, any]) => {
            if (!combo.confirmed) return;
            // a combo's key is its power names and commas only, so it is safe in the pattern as it is
            const line = new RegExp(`^  '${key}': .*$`, 'm');
            classes = classes.replace(line, `  '${key}': [${JSON.stringify(combo.confirmed.name)}, ${JSON.stringify(combo.confirmed.description)}],`);
          });
          fs.writeFileSync(classesPath, classes);
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

// the apartment mock-up tool (/apartment, Jamie 2026-11-24): its layout saved over mockup.json, and its exports written
// as PNGs into public/apartment-scene/exports (for Jamie to regenerate the room's lighting from)
const EXPORT_NAME = /^[a-zA-Z0-9_-]{1,60}$/;
export const apartmentSave = (layoutPath: string, exportDir: string): Plugin => ({
  name: 'apartment-save',
  apply: 'serve',
  handleHotUpdate({ file }) {
    if (path.normalize(file) == path.normalize(layoutPath)) return [];
  },
  configureServer(server) {
    const readBody = (request, done) => {
      let body = '';
      request.on('data', chunk => { body += chunk; });
      request.on('end', () => done(body));
    };
    server.middlewares.use('/__apartment/save', (request, response) => readBody(request, body => {
      try {
        const layout = JSON.parse(body);
        if (!layout || !Array.isArray(layout.layers)) throw new Error('not a mock-up layout');
        fs.writeFileSync(layoutPath, `${JSON.stringify(layout, null, 1)}\n`);
        response.statusCode = 200;
        response.end('saved');
      } catch (error) {
        response.statusCode = 400;
        response.end(String(error));
      }
    }));
    server.middlewares.use('/__apartment/export', (request, response) => readBody(request, body => {
      try {
        const { name, dataUrl } = JSON.parse(body);
        if (!EXPORT_NAME.test(name || '')) throw new Error('a name of letters, numbers, - and _ only');
        const match = /^data:image\/png;base64,(.+)$/.exec(dataUrl || '');
        if (!match) throw new Error('not a PNG');
        fs.mkdirSync(exportDir, { recursive: true });
        const file = path.join(exportDir, `${name}.png`);
        fs.writeFileSync(file, Buffer.from(match[1], 'base64'));
        response.statusCode = 200;
        response.end(file);
      } catch (error) {
        response.statusCode = 400;
        response.end(String(error));
      }
    }));
  }
});

// the sound review (/sounds, Jamie 2026-11-25) and the music review (/music, 2026-11-26): each verdict and note, saved
// over the review's json
export const soundReviewSave = (reviewPath: string): Plugin => reviewFileSave('sound-review', reviewPath);
export const musicReviewSave = (reviewPath: string): Plugin => reviewFileSave('music-review', reviewPath);
const reviewFileSave = (name: string, reviewPath: string): Plugin => ({
  name: `${name}-save`,
  apply: 'serve',
  handleHotUpdate({ file }) {
    if (path.normalize(file) == path.normalize(reviewPath)) return [];
  },
  configureServer(server) {
    server.middlewares.use(`/__${name}/save`, (request, response) => {
      let body = '';
      request.on('data', chunk => { body += chunk; });
      request.on('end', () => {
        try {
          const review = JSON.parse(body);
          if (!review || typeof review != 'object' || Array.isArray(review)) throw new Error('not the sound review');
          fs.writeFileSync(reviewPath, `${JSON.stringify(review, null, 1)}\n`);
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

// the tab icon tool (/icon, Jamie 2026-11-25): its settings saved over iconTool.json, and its export written as
// public/icon-source/kaiju-icon.png (for scripts/makeIcons.py to make the icon set from)
export const iconToolSave = (settingsPath: string, exportFile: string): Plugin => ({
  name: 'icon-tool-save',
  apply: 'serve',
  handleHotUpdate({ file }) {
    if (path.normalize(file) == path.normalize(settingsPath)) return [];
  },
  configureServer(server) {
    const readBody = (request, done) => {
      let body = '';
      request.on('data', chunk => { body += chunk; });
      request.on('end', () => done(body));
    };
    server.middlewares.use('/__icon-tool/save', (request, response) => readBody(request, body => {
      try {
        const settings = JSON.parse(body);
        if (!settings || !settings.kaiju || !settings.fire || !settings.circle) throw new Error('not the icon tool\'s settings');
        fs.writeFileSync(settingsPath, `${JSON.stringify(settings, null, 1)}\n`);
        response.statusCode = 200;
        response.end('saved');
      } catch (error) {
        response.statusCode = 400;
        response.end(String(error));
      }
    }));
    server.middlewares.use('/__icon-tool/export', (request, response) => readBody(request, body => {
      try {
        const { dataUrl } = JSON.parse(body);
        const match = /^data:image\/png;base64,(.+)$/.exec(dataUrl || '');
        if (!match) throw new Error('not a PNG');
        fs.mkdirSync(path.dirname(exportFile), { recursive: true });
        fs.writeFileSync(exportFile, Buffer.from(match[1], 'base64'));
        response.statusCode = 200;
        response.end(exportFile);
      } catch (error) {
        response.statusCode = 400;
        response.end(String(error));
      }
    }));
  }
});
