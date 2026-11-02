import fs from 'node:fs';
import { describe, it } from 'vitest';
import { TILE_STATUSES_AND_ABILITY_DATA } from 'Utils/gameState';
import { getTeamKits, playKaiju, playVersus, POWERS } from './simulate';

/*
  Not part of the normal tests. To run:
    KAIJU_BALANCE=out.json BALANCE_MATCHES=400 BALANCE_SEED=1 [BALANCE_EDITS=edits.json] [BALANCE_MODE=versus|kaiju|snapshot] npx vitest run src/Game/DataClasses/balance
*/
const { KAIJU_BALANCE, BALANCE_MATCHES = '200', BALANCE_SEED = '1', BALANCE_EDITS, BALANCE_MODE = 'all' } = process.env;

const add = (table, power, field, value) => {
  table[power] = table[power] || { matches: 0, total: 0 };
  table[power].matches += field == 'matches' ? value : 0;
  table[power].total += field == 'total' ? value : 0;
};

const getPowers = kits => [...new Set(kits.flat())];

const getAverages = table => Object.fromEntries(POWERS.map(power => [power, table[power] ? +(table[power].total / table[power].matches).toFixed(3) : null]));

describe.skipIf(!KAIJU_BALANCE)('balance run', () => {
  it('plays', () => {
    if (BALANCE_MODE == 'snapshot') {
      fs.writeFileSync(KAIJU_BALANCE, JSON.stringify(TILE_STATUSES_AND_ABILITY_DATA, null, 2));
      return;
    }
    const matches = Number(BALANCE_MATCHES);
    const seed = Number(BALANCE_SEED) * 1000000;
    const edits = BALANCE_EDITS ? JSON.parse(fs.readFileSync(BALANCE_EDITS, 'utf8')) : {};
    const out = { matches, edits, versus: undefined, kaiju: undefined, seconds: 0 };
    const startMs = Date.now();

    if (BALANCE_MODE != 'kaiju') {
      const wins = {};
      let timeouts = 0;
      for (let n = 0; n < matches; n++) {
        Math.random = (() => { let s = seed + n; return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; })();
        const teamKits = getTeamKits();
        const otherKits = getTeamKits();
        // both ways around, so neither end of the map counts
        const scores = [
          playVersus({ teamKits, otherKits, seed: seed + n, edits }),
          playVersus({ teamKits: otherKits, otherKits: teamKits, seed: seed + n, edits })
        ];
        timeouts += scores.filter(({ score }) => score == 0.5).length;
        const score = (scores[0].score + 1 - scores[1].score) / 2;
        [[teamKits, score], [otherKits, 1 - score]].forEach(([kits, value]: any) => getPowers(kits).forEach(power => {
          add(wins, power, 'matches', 1);
          add(wins, power, 'total', value);
        }));
      }
      out.versus = { winRate: getAverages(wins), timeouts };
    }

    if (BALANCE_MODE != 'versus') {
      const kills = {};
      const clears = {};
      let overallKills = 0;
      let overallWins = 0;
      for (let n = 0; n < matches; n++) {
        Math.random = (() => { let s = seed + n + 500000; return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; })();
        const teamKits = getTeamKits();
        const { isWin, kills: killCount } = playKaiju({ teamKits, seed: seed + n, edits });
        overallKills += killCount;
        overallWins += isWin ? 1 : 0;
        getPowers(teamKits).forEach(power => {
          add(kills, power, 'matches', 1);
          add(kills, power, 'total', killCount);
          add(clears, power, 'matches', 1);
          add(clears, power, 'total', isWin ? 1 : 0);
        });
      }
      out.kaiju = { kills: getAverages(kills), winRate: getAverages(clears), overallKills: overallKills / matches, overallWinRate: overallWins / matches };
    }

    out.seconds = Math.round((Date.now() - startMs) / 1000);
    fs.writeFileSync(KAIJU_BALANCE, JSON.stringify(out, null, 2));
  }, 0);
});
