import { it } from 'vitest';
import fs from 'node:fs';
import OPTIONS from 'Game/DataClasses/classOptions.json';
import { TILE_STATUSES_AND_ABILITY_DATA } from 'Utils/gameState';

/*
  The class review's options, written in a Claude Code session in batches (the normal test run skips these):
    CLASSES=export CLASSES_FILE=<file> CLASSES_COUNT=42 npx vitest run src/Game/ReactComponents/ClassReview/classes.work.test.ts
      lists the next combos still needing options, with their powers and their draft
    CLASSES=save CLASSES_FILE=<file> npx vitest run ...
      reads { "<combo>": [{ name, descriptions: [3] }, x2 new] } plus the draft name's two new descriptions as
      { "<combo>": { draftDescriptions: [2], names: [...] } }, checks every name and description is unique, and saves
*/
const mode = process.env.CLASSES;
const file = process.env.CLASSES_FILE;
const optionsPath = 'src/Game/DataClasses/classOptions.json';

const LOOKS = Object.fromEntries(TILE_STATUSES_AND_ABILITY_DATA.filter(({ element }) => element).map(look => [look.element[0].toUpperCase() + look.element.slice(1), look]));
const getIsReady = combo => combo.names.length >= 3 && combo.names.every(({ descriptions }) => descriptions.length >= 3);

it.runIf(mode == 'export')('lists the combos to write', () => {
  const combos = (OPTIONS as any).combos;
  const todo = Object.entries(combos).filter(([, combo]: [string, any]) => !getIsReady(combo)).slice(0, Number(process.env.CLASSES_COUNT || 42))
    .map(([key, combo]: [string, any]) => ({
      key,
      powers: key.split(',').map(power => `${power}: ${(LOOKS[power] || {}).activeName} (${(LOOKS[power] || {}).activeDesc}); passive ${(LOOKS[power] || {}).passiveName}`),
      draft: combo.original
    }));
  const taken = Object.values(combos).flatMap((combo: any) => combo.names.flatMap(({ name, descriptions }) => [name, ...descriptions]));
  fs.writeFileSync(file as string, JSON.stringify({ count: todo.length, left: Object.values(combos).filter(combo => !getIsReady(combo)).length, todo, taken }, null, 1));
});

it.runIf(mode == 'save')('saves written options', () => {
  const written = JSON.parse(fs.readFileSync(file as string, 'utf8'));
  const options = structuredClone(OPTIONS as any);
  Object.entries(written).forEach(([key, { draftDescriptions, names }]: [string, any]) => {
    const combo = options.combos[key];
    if (!combo) throw new Error(`no combo ${key}`);
    if (draftDescriptions.length != 2 || names.length != 2 || names.some(({ descriptions }) => descriptions.length != 3)) throw new Error(`${key}: needs 2 draft descriptions and 2 names with 3 descriptions each`);
    // the draft stays first, with its own tagline first
    combo.names = [{ name: combo.original.name, descriptions: [combo.original.description, ...draftDescriptions] }, ...names];
  });
  // every name and every description, once in all the combos
  const seen = new Map();
  const repeats = [];
  Object.entries(options.combos).forEach(([key, combo]: [string, any]) => combo.names.forEach(({ name, descriptions }) => [name, ...descriptions].forEach(text => {
    const folded = text.toLowerCase().trim();
    if (seen.has(folded) && seen.get(folded) != key) repeats.push(`"${text}" (${seen.get(folded)} and ${key})`);
    else seen.set(folded, key);
  })));
  if (repeats.length) throw new Error(`repeated:\n${repeats.join('\n')}`);
  fs.writeFileSync(optionsPath, `${JSON.stringify(options, null, 2)}\n`);
});
