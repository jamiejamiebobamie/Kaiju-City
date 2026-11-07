import { describe, expect, it } from 'vitest';
import { LEVELS } from './Levels/levels';
import { GameManager } from './GameManager';
import { SettingsManager } from './SettingsManager';
import { saveRecruitChoice } from './Unlocks';
import { storage } from 'Utils/storage';
import { AQUARIUM_FLOOD, AquariumFlood } from './AquariumFlood';
import { TRAIN_SCHEDULE } from './TrainSchedule';

// Jamie's fourteenth playtest list (2026-11-06)
const makeGame = (level, { isTeammate = false, elements = ['Fire', 'Ice', 'Metal'], killsToWin = undefined } = {}) => {
  const settingsManager = new SettingsManager();
  settingsManager.setSortedPlayerChosenAbilityElementsString(elements);
  settingsManager.setIsTeammate(isTeammate);
  const gm: any = new GameManager({ level, settingsManager, killsToWin });
  gm.initGame();
  return gm;
};
const key = ({ i, j }) => `${i} ${j}`;
const withRecruits = () => {
  storage.clear();
  saveRecruitChoice('punk', 'recruit');
  saveRecruitChoice('black_female', 'recruit');
};

describe('playtest 14', () => {
  it('a Teleport wormhole is good for one trip: going through shuts it (the bosses’ portals stay)', () => {
    const gm = makeGame(LEVELS.peninsula);
    const board = gm.gameBoardManager;
    const [a, b, c, d] = board.walkableTiles.filter(tile => !board.getLinkedTile(tile)).filter((_, index) => index % 7 == 0);
    board.addWormhole(a, b, gm.accTime, 10000);
    board.addWormhole(c, d, gm.accTime, Infinity);
    board.useWormhole(b, gm.accTime);
    expect(board.getLinkedTile(a)).toBeFalsy();
    expect(board.getLinkedTile(b)).toBeFalsy();
    // still in sight a moment, for the walk through it
    board.updateWormholes(gm.accTime + 100);
    expect(board.getWormholes().some(({ from }) => key(from) == key(a))).toBe(true);
    board.updateWormholes(gm.accTime + 10000);
    expect(board.getWormholes().some(({ from }) => key(from) == key(a))).toBe(false);
    board.useWormhole(c, gm.accTime);
    expect(key(board.getLinkedTile(c))).toBe(key(d));
  });

  it('charmed, the player’s power keys are scrambled: no key gives its own power', () => {
    const gm = makeGame(LEVELS.peninsula);
    const player = gm.getPieces()[0];
    const input = gm.getPlayerInputHandler();
    const used = [];
    input.playerAbilities.slice(0, 3).forEach((ability, index) => { ability.useAbility = () => { used.push(index); }; });
    input.usePlayerAbilityFromIndex(0, gm.accTime);
    expect(used).toEqual([0]);
    player.isCharmed = true;
    player.abilityScramble = [2, 0, 1];
    input.usePlayerAbilityFromIndex(0, gm.accTime + 100000);
    expect(used[1]).toBe(2);
  });

  it('the teammate turned Kaiju casts its powers one at a time, many different ones', () => {
    const gm = makeGame(LEVELS.finalPeninsula, { isTeammate: true, killsToWin: 30 });
    while (gm.cutscene) gm.stepPieces();
    gm.score = 30;
    gm.stepPieces();
    for (let k = 0; k < 600 && gm.finalTurnState != 'fighting'; k += 1) gm.stepPieces();
    const kaiju = gm.teammateKaiju;
    gm.getPieces()[0].isUnhurtable = true;
    const casts = [];
    kaiju.abilities.forEach(ability => {
      const use = ability.useAbility.bind(ability);
      ability.useAbility = params => { casts.push({ ability, at: gm.accTime }); return use(params); };
    });
    for (let k = 0; k < 1500 && casts.length < 6; k++) gm.stepPieces();
    expect(casts.length).toBeGreaterThanOrEqual(4);
    expect(new Set(casts.map(({ ability }) => ability)).size).toBeGreaterThanOrEqual(3);
    // one at a time
    casts.slice(1).forEach(({ at }, index) => expect(at - casts[index].at).toBeGreaterThanOrEqual(LEVELS.finalPeninsula.finalTurn.castEveryMs));
  });

  it('the Lab trap: the player stands in the middle of the row', () => {
    withRecruits();
    const gm = makeGame(LEVELS.labTrap, { isTeammate: true });
    const team = gm.gameBoardPiecesManager.getTeamPieces(gm.gameBoardPiecesManager.getPlayerTeamIndex());
    const xs = team.map(piece => piece.charLocation.x).sort((a, b) => a - b);
    const player = gm.gameBoardPiecesManager.getPlayerPiece();
    expect(team.length).toBeGreaterThanOrEqual(3);
    expect(xs.indexOf(player.charLocation.x)).toBe(Math.floor((team.length - 1) / 2));
    storage.clear();
  });

  it('Sewer 1: the recruits already rest in their places; the player walks in at the door', () => {
    withRecruits();
    const gm = makeGame(LEVELS.sewer1, { isTeammate: true });
    expect(gm.followers.length).toBeGreaterThan(0);
    gm.stepPieces();
    gm.followers.forEach(piece => expect(piece.isVisible).not.toBe(false));
    for (let k = 0; k < 4000 && gm.cutscene; k++) gm.stepPieces();
    const player = gm.getPieces()[0];
    const spot = LEVELS.sewer1.walkIn.playerSpot;
    expect(Math.hypot(player.charLocation.x - spot.x, player.charLocation.y - spot.y)).toBeLessThan(80);
    storage.clear();
  });

  it('Sewer 2: the recruits are already in place; only the player and teammate come in, to the front', () => {
    withRecruits();
    const gm = makeGame(LEVELS.sewer2, { isTeammate: true });
    gm.stepPieces();
    gm.followers.forEach(piece => expect(piece.isVisible).not.toBe(false));
    const arrivals = gm.cutscene.steps.flatMap(step => step.arrivals || []);
    expect(arrivals.every(({ piece }) => !gm.followers.includes(piece))).toBe(true);
    expect(arrivals.filter(({ startTile }) => !!startTile).length).toBe(2);
    storage.clear();
  });

  it('the Aquarium: with the Mermaid up top and the player down in the water, the camera leaves her be', () => {
    const gm = makeGame(LEVELS.aquarium);
    const board = gm.gameBoardManager;
    const player = gm.getPieces()[0];
    const rival = gm.rivalPiece;
    gm.isShattered = true;
    const top = board.walkableTiles.find(tile => gm.getIsTopFloor(tile));
    const ground = board.walkableTiles.find(tile => !gm.getIsTopFloor(tile) && gm.getIsFloodTile(tile));
    rival.setTileIndex(top);
    player.setTileIndex(ground);
    expect(gm.getIsCameraKeptOff(player, rival)).toBe(true);
    player.setTileIndex(board.walkableTiles.filter(tile => gm.getIsTopFloor(tile))[3]);
    expect(gm.getIsCameraKeptOff(player, rival)).toBe(false);
  });

  it('the flood comes in waves, each with a sea creature, and drains away fast at the bottom', () => {
    const ROW = 20;
    const SIZE = 12;
    const board = {
      getSpot: ({ i, j }) => ({ x: i * ROW, y: j * ROW }),
      getNeighbors: ({ i, j }) => [{ i: i + 1, j }, { i: i - 1, j }, { i, j: j + 1 }, { i, j: j - 1 }].filter(t => t.i >= 0 && t.j >= 0 && t.i < SIZE && t.j < SIZE),
      getIsWaterTile: () => true,
      getIsPowerOnTile: () => false,
      getTileAt: ({ x, y }) => ({ i: Math.round(x / ROW), j: Math.round(y / ROW) })
    };
    let seed = 5;
    const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const flood = new AquariumFlood({ sources: [{ i: 6, j: 0 }], board, rowPx: ROW, random, bottomY: (SIZE - 1) * ROW });
    const { everyMs, surgeMs } = AQUARIUM_FLOOD.waves;
    const sizes = [];
    let spawns = 0;
    for (let t = 0; t < everyMs * 3; t += 100) {
      spawns += flood.step(100).length;
      sizes.push({ t: flood.ms, isSurging: flood.getIsSurging(), size: flood.water.size });
    }
    expect(sizes.some(({ isSurging }) => isSurging)).toBe(true);
    expect(sizes.some(({ isSurging }) => !isSurging)).toBe(true);
    expect(spawns).toBeGreaterThanOrEqual(3);
    // nothing sits at the bottom for long
    flood.water.forEach(parcel => {
      if (parcel.tile.j >= SIZE - 2) expect(parcel.dryAtMs - flood.ms).toBeLessThanOrEqual(AQUARIUM_FLOOD.bottomDrain.ms);
    });
    expect(surgeMs).toBeLessThan(everyMs);
  });

  it('the Subway trains come less often again', () => {
    expect(TRAIN_SCHEDULE.idleMs.min).toBeGreaterThanOrEqual(6000);
  });
});
