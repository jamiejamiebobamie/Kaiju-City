import { describe, expect, it } from 'vitest';
import { LEVELS } from './Levels/levels';
import { GameManager, GameResult } from './GameManager';
import { SettingsManager } from './SettingsManager';
import { saveRecruitChoice } from './Unlocks';
import { storage } from 'Utils/storage';
import { GHOST_BOSS } from './GhostBoss';
import { AquariumFlood } from './AquariumFlood';
import { getDialogueLine } from './Dialogue/dialogue';

// Jamie's fifteenth playtest list (2026-11-06)
const makeGame = (level, { isTeammate = true, autoRecruits = [] as Array<string>, isRetry = false } = {}) => {
  const settingsManager = new SettingsManager();
  settingsManager.setSortedPlayerChosenAbilityElementsString(['Fire', 'Ice', 'Metal']);
  settingsManager.setIsTeammate(isTeammate);
  const gm: any = new GameManager({ level, settingsManager, autoRecruits, isRetry });
  gm.initGame();
  return gm;
};
const key = ({ i, j }) => `${i} ${j}`;

describe('playtest 15', () => {
  it('the Street: the Hazmat worker can be found before the Agent has said a word', () => {
    expect(LEVELS.street.unlock.afterMs).toBeUndefined();
  });

  it('the Rooftop: once the ghosts are gone, Ghost Girl roams the whole roof again', () => {
    const gm = makeGame(LEVELS.rooftop);
    for (let k = 0; k < 3000 && gm.cutscene; k++) gm.stepPieces();
    const rival = gm.rivalPiece;
    rival.allowedTile = gm.getIsRivalGround;
    gm.ghostRing = { ghosts: [] };
    gm.endGhostRing();
    expect(rival.allowedTile).toBeUndefined();
  });

  it('the Rooftop: a line of her own for each phase', () => {
    const lines = [0, 1, 2].map(k => getDialogueLine(LEVELS.rooftop.ghostBoss.screamScene, k).text);
    expect(lines[0]).toBe('Protect me, ancestors!');
    expect(new Set(lines).size).toBe(3);
  });

  it('launched ghosts turn gently enough to be dodged', () => {
    expect(GHOST_BOSS.turnPerSecond).toBeLessThanOrEqual(1);
  });

  it('a broken panel lets out a gush that swirls round in front of it, each drop pointing the way it runs', () => {
    const ROW = 20;
    const board = {
      getSpot: ({ i, j }) => ({ x: i * ROW, y: j * ROW }),
      getNeighbors: ({ i, j }) => [{ i: i + 1, j }, { i: i - 1, j }, { i, j: j + 1 }, { i, j: j - 1 }].filter(t => t.i >= 0 && t.j >= 0 && t.i < 20 && t.j < 20),
      getIsWaterTile: () => true,
      getIsPowerOnTile: () => false,
      getTileAt: ({ x, y }) => ({ i: Math.round(x / ROW), j: Math.round(y / ROW) })
    };
    let seed = 7;
    const flood = new AquariumFlood({ sources: [], board, rowPx: ROW, random: () => (seed = (seed * 16807) % 2147483647) / 2147483647 });
    flood.burst({ i: 10, j: 10 });
    expect(flood.water.size).toBeGreaterThanOrEqual(10);
    for (let k = 0; k < 6; k++) flood.step(160);
    const flows = flood.getWaterFlows().filter(({ step }) => !!step);
    expect(flows.length).toBeGreaterThan(5);
    // round, not away: they stay near the tank
    flood.getWaterTiles().forEach(tile => expect(Math.hypot(tile.i - 10, tile.j - 10)).toBeLessThan(6));
  });

  it('every recruit comes in when the fight starts, each on a tile of their own, but not the one it is against', () => {
    const gm = makeGame(LEVELS.rooftop, { autoRecruits: ['punk', 'black_female', 'mermaid'] });
    for (let k = 0; k < 3000 && gm.cutscene; k++) gm.stepPieces();
    gm.stepPieces();
    const recruits = gm.getPieces().filter(piece => piece.isRecruit && !piece.isDead);
    expect(recruits.map(({ avatar }) => avatar).sort()).toEqual(['mermaid', 'punk']);
    expect(new Set(recruits.map(piece => key(piece.getTileIndex()))).size).toBe(2);
  });

  it('the recruits walk with the team in the scenes the teammate is in', () => {
    storage.clear();
    saveRecruitChoice('punk', 'recruit');
    const gm = makeGame(LEVELS.labIntro, { autoRecruits: ['punk'] });
    expect(gm.followers.map(({ avatar }) => avatar)).toEqual(['punk']);
    const off = makeGame(LEVELS.labIntro);
    expect(off.followers.length).toBe(0);
    // and on the map walks
    const map = makeGame(LEVELS.mapSubway, { autoRecruits: ['punk'] });
    expect(map.followers.map(({ avatar }) => avatar)).toEqual(['punk']);
    for (let k = 0; k < 300; k++) map.stepPieces();
    expect(map.followers[0].isDead).toBeFalsy();
    storage.clear();
  });

  it('the Lab: the Reaper’s portal is back against the floor’s back wall, two rows out', () => {
    const gm = makeGame(LEVELS.lab);
    const stand = gm.extras[0].getTileIndex();
    const tile = gm.getLabPortalFloorTile(stand);
    const floorRows = gm.gameBoardManager.walkableTiles.filter(({ i, j }) => i == stand.i && j > LEVELS.lab.agentDrops.catwalkLastRow).map(({ j }) => j);
    expect(tile.j).toBe(Math.min(...floorRows) + 2);
    expect(tile.j).toBeLessThan(stand.j);
  });

  it('the teammate’s fight on its own: their Kaiju from the start, no Kaiju waves, no words; beating it wins', () => {
    const gm = makeGame(LEVELS.finalTurnFight, { isRetry: true });
    expect(gm.cutscene).toBeFalsy();
    expect(gm.finalTurnState).toBe('fighting');
    const kaiju = gm.teammateKaiju;
    expect(kaiju.isTeammateKaiju).toBe(true);
    gm.getPieces()[0].isUnhurtable = true; // the Kaiju sometimes downs the player in this time: not what this is about
    for (let k = 0; k < 50; k++) gm.stepPieces();
    expect(gm.getPieces().filter(piece => piece.avatar == 'kaiju' && !piece.isTeammateKaiju).length).toBe(0);
    expect(gm.getGameResult()).toBe(null);
    gm.accTime += 5000;
    kaiju.decrementHealth(gm.accTime, kaiju.maxLives);
    expect(gm.getGameResult()).toBe(GameResult.PlayerWon);
  });

  it('the ghost boss down in her ghost form leaves a ghost’s body', () => {
    const gm = makeGame(LEVELS.rooftop);
    const rival = gm.rivalPiece;
    rival.isGhostForm = true;
    gm.gameBoardPiecesManager.spawnDeathPieceAtLocation(rival.charLocation, rival.avatar, rival.getTileIndex(), rival.color, rival.pieceIndex, { x: 1, y: 0 }, rival.spriteSheetSrc);
    expect(gm.getDeathPieces().slice(-1)[0].isGhostForm).toBe(true);
  });
});
