import { describe, expect, it } from 'vitest';
import { LEVELS } from './Levels/levels';
import { GameManager } from './GameManager';
import { SettingsManager } from './SettingsManager';
import { saveRecruitChoice } from './Unlocks';
import { storage } from 'Utils/storage';
import { GHOST_BOSS } from './GhostBoss';
import { AQUARIUM_FLOOD, AquariumFlood } from './AquariumFlood';
import { getActiveHotspots } from 'Game/ReactComponents/GameBoard/SceneElements';

// Jamie's sixteenth playtest list (2026-11-06)
const makeGame = (level, options: any = {}) => {
  const settingsManager = new SettingsManager();
  settingsManager.setSortedPlayerChosenAbilityElementsString(['Fire', 'Ice', 'Metal']);
  settingsManager.setIsTeammate(options.isTeammate ?? true);
  const gm: any = new GameManager({ level, settingsManager, ...options });
  gm.initGame();
  return gm;
};

describe('playtest 16', () => {
  it('who is recruited comes from the playthrough, not the saved choices', () => {
    storage.clear();
    saveRecruitChoice('punk', 'recruit');
    expect(makeGame(LEVELS.labIntro, { recruits: [], autoRecruits: [] }).followers.length).toBe(0);
    expect(makeGame(LEVELS.labTrap, { recruits: ['mermaid'] }).followers.map(({ avatar }) => avatar)).toEqual(['mermaid']);
    storage.clear();
  });

  it('the recruits are there from a fight’s opening scene', () => {
    const gm = makeGame(LEVELS.rooftop, { recruits: ['punk'], autoRecruits: ['punk'] });
    expect(gm.cutscene).toBeTruthy();
    expect(gm.getPieces().filter(piece => piece.isRecruit && piece.avatar == 'punk').length).toBe(1);
    for (let k = 0; k < 3000 && gm.cutscene; k++) gm.stepPieces();
    gm.stepPieces();
    expect(gm.getPieces().filter(piece => piece.isRecruit && piece.avatar == 'punk').length).toBe(1); // not twice
  });

  it('with the player and teammate down, the camera stays with a recruit still fighting', () => {
    const gm = makeGame(LEVELS.peninsula, { recruits: ['punk'], autoRecruits: ['punk'] });
    for (let k = 0; k < 3000 && gm.cutscene; k++) gm.stepPieces();
    gm.stepPieces();
    const team = gm.gameBoardPiecesManager.getTeamPieces(gm.gameBoardPiecesManager.getPlayerTeamIndex());
    team.filter(piece => !piece.isRecruit).forEach(piece => piece.setIsDead(true));
    expect(gm.getFocusPiece().avatar).toBe('punk');
  });

  it('the walking Lab’s hotspots are numbered in order, those in view only', () => {
    const level = LEVELS.labIntro;
    const all = getActiveHotspots(level, []);
    expect(all.length).toBeGreaterThanOrEqual(3);
    const talked = getActiveHotspots(level, ['labTalk']);
    expect(talked.length).toBe(all.length - 1); // "What is this?" is gone once asked
    expect(level.coverPanLeftX).toBe(450);
  });

  it('the Rooftop has two rings: 6, then 12 (she is a ghost with the 12)', () => {
    expect(GHOST_BOSS.rings).toEqual([6, 12]);
  });

  it('five sea creatures are gone; the rest each have a pose', () => {
    ['shark-fin', 'shrimp', 'sperm-whale', 'sea-urchin', 'angler-fish'].forEach(name => expect(AQUARIUM_FLOOD.ghostIcons[name]).toBeUndefined());
    Object.keys(AQUARIUM_FLOOD.ghostIcons).forEach(name => expect(AQUARIUM_FLOOD.ghostPoses[name]).toBeDefined());
  });

  it('a gush off the glass runs away from it, and its edges curl back round: right edge counterclockwise (screen)', () => {
    const ROW = 20;
    const board = {
      getSpot: ({ i, j }) => ({ x: i * ROW, y: j * ROW }),
      getNeighbors: ({ i, j }) => [{ i: i + 1, j }, { i: i - 1, j }, { i, j: j + 1 }, { i, j: j - 1 }].filter(t => t.i >= 0 && t.j >= 0 && t.i < 30 && t.j < 30),
      getIsWaterTile: () => true,
      getIsPowerOnTile: () => false,
      getTileAt: ({ x, y }) => ({ i: Math.round(x / ROW), j: Math.round(y / ROW) })
    };
    let seed = 3;
    const flood = new AquariumFlood({ sources: [], board, rowPx: ROW, random: () => (seed = (seed * 16807) % 2147483647) / 2147483647 });
    flood.burst({ i: 15, j: 5 }, { x: 0, y: 1 }); // running down the screen
    const startY = Math.max(...flood.getWaterTiles().map(({ j }) => j));
    for (let t = 0; t < AQUARIUM_FLOOD.wave.outMs; t += 160) flood.step(160);
    // it ran down
    expect(Math.max(...flood.getWaterTiles().map(({ j }) => j))).toBeGreaterThan(startY);
    for (let t = 0; t < 640; t += 160) flood.step(160);
    const curls = [...flood.water.values()].filter(parcel => parcel.swirl);
    expect(curls.length).toBeGreaterThan(0);
    // the right edge: round a point further right, counterclockwise on screen (sense -1); the left edge mirrored
    curls.forEach(({ swirl }) => expect(swirl.sense).toBe(swirl.center.x > 15 * ROW ? -1 : 1));
    expect(new Set(curls.map(({ swirl }) => swirl.sense)).size).toBe(2); // both edges curl
  });
});
