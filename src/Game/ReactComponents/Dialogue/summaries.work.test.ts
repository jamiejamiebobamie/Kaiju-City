import { it } from 'vitest';
import fs from 'node:fs';
import DIALOGUE from 'Game/DataClasses/Dialogue/dialogue.json';
import SUMMARIES from './summaries.json';
import { getCardStatus, getSummaryCards } from './summaryCards';

/*
  The summaries' work, run by hand in a Claude Code session (the normal test run skips these):
    SUMMARIES=export SUMMARIES_FILE=<file> npx vitest run src/Game/ReactComponents/Dialogue/summaries.work.test.ts
      writes the cards that are missing or out of date, in story order, with what each builds on
    SUMMARIES=save SUMMARIES_FILE=<file> npx vitest run ...
      reads { "<card id>": "<words>" } from the file and saves them into summaries.json, as of the dialogue now
*/
const mode = process.env.SUMMARIES;
const file = process.env.SUMMARIES_FILE;
const summariesPath = 'src/Game/ReactComponents/Dialogue/summaries.json';

it.runIf(mode == 'export')('lists the summaries to write', () => {
  const stored = (SUMMARIES as any).cards;
  const cards = getSummaryCards((DIALOGUE as any).scenes);
  const todo = cards.filter(card => getCardStatus(card, stored) != 'ok').map(card => ({
    id: card.id,
    section: card.label,
    status: getCardStatus(card, stored),
    // the cards this one builds on, on one of its paths (the earliest)
    buildsOn: cards.filter(other => other.sectionIndex < card.sectionIndex && other.paths.some(path => JSON.stringify(path) == JSON.stringify(card.paths[0]))).map(({ id }) => id),
    choices: card.paths.length == 8 ? 'any' : card.paths.map(({ choices }) => Object.entries(choices).map(([who, choice]) => `${who}:${choice}`).join(' ')),
    content: card.content
  }));
  fs.writeFileSync(file as string, JSON.stringify({ count: todo.length, of: cards.length, todo }, null, 1));
});

it.runIf(mode == 'save')('saves written summaries', () => {
  const written = JSON.parse(fs.readFileSync(file as string, 'utf8'));
  const cards = getSummaryCards((DIALOGUE as any).scenes);
  const stored = { ...(SUMMARIES as any).cards };
  Object.entries(written).forEach(([id, text]) => {
    const card = cards.find(other => other.id == id);
    if (!card) throw new Error(`no card ${id}`);
    stored[id] = { section: card.label, text, ancestorHashes: card.ancestorHashes };
  });
  // cards the story no longer has (their section's words changed) go
  const ids = new Set(cards.map(({ id }) => id));
  Object.keys(stored).forEach(id => { if (!ids.has(id)) delete stored[id]; });
  fs.writeFileSync(summariesPath, `${JSON.stringify({ cards: stored }, null, 2)}\n`);
});
