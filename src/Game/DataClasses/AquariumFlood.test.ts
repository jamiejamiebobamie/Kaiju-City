import { afterEach, describe, expect, it } from 'vitest';
import { AQUARIUM_FLOOD, AquariumFlood, getWaterSlow } from './AquariumFlood';

const ROW = 20;
const SIZE = 12;
// a square floor, with powers on the tiles listed in 'powered'
const makeBoard = (powered = new Set<string>()) => ({
  getSpot: ({ i, j }) => ({ x: i * ROW, y: j * ROW }),
  getNeighbors: ({ i, j }) => [{ i: i + 1, j }, { i: i - 1, j }, { i, j: j + 1 }, { i, j: j - 1 }].filter(t => t.i >= 0 && t.j >= 0 && t.i < SIZE && t.j < SIZE),
  getIsWaterTile: () => true,
  getIsPowerOnTile: ({ i, j }) => powered.has(`${i} ${j}`),
  getTileAt: ({ x, y }) => ({ i: Math.round(x / ROW), j: Math.round(y / ROW) })
});
const seeded = (seed = 1) => () => {
  seed = (seed * 16807) % 2147483647;
  return seed / 2147483647;
};
const run = (flood, ms, targets = []) => {
  const hits = [];
  for (let t = 0; t < ms; t += 160) hits.push(...flood.step(160, targets));
  return hits;
};
const saved = { ...AQUARIUM_FLOOD };
afterEach(() => Object.assign(AQUARIUM_FLOOD, saved));

describe('the Aquarium flood', () => {
  it('pours from the tanks and runs down the floor, where it pools', () => {
    const flood = new AquariumFlood({ sources: [{ i: 6, j: 0 }], board: makeBoard(), rowPx: ROW, random: seeded() });
    run(flood, 8000);
    const rows = flood.getWaterTiles().map(({ j }) => j);
    expect(rows.length).toBeGreaterThan(10);
    // the bottom row fills first
    expect(rows.filter(j => j == SIZE - 1).length).toBeGreaterThan(rows.filter(j => j == 1).length);
  });

  it('tapers off, then drains away: then it is over', () => {
    const flood = new AquariumFlood({ sources: [{ i: 6, j: 0 }], board: makeBoard(), rowPx: ROW, random: seeded() });
    run(flood, AQUARIUM_FLOOD.floodMs * 0.5);
    expect(flood.getPourShare()).toBe(1);
    run(flood, AQUARIUM_FLOOD.floodMs * 0.3);
    expect(flood.getPourShare()).toBeLessThan(1);
    run(flood, AQUARIUM_FLOOD.floodMs * 0.2 + AQUARIUM_FLOOD.drainMs + AQUARIUM_FLOOD.ghostLifeMs);
    expect(flood.getIsOver()).toBe(true);
    expect(flood.water.size).toBe(0);
  });

  it('can bounce like Wildfire instead', () => {
    AQUARIUM_FLOOD.flowStyle = 'bounce';
    const flood = new AquariumFlood({ sources: [{ i: 6, j: 6 }], board: makeBoard(), rowPx: ROW, random: seeded(3) });
    run(flood, 3000);
    expect(flood.water.size).toBeGreaterThan(3);
    run(flood, AQUARIUM_FLOOD.floodMs + AQUARIUM_FLOOD.bounceLifeMs + AQUARIUM_FLOOD.ghostLifeMs);
    expect(flood.getIsOver()).toBe(true);
  });

  it('any power on a tile washes the water there away', () => {
    const powered = new Set(['6 11', '5 11', '7 11']);
    const flood = new AquariumFlood({ sources: [{ i: 6, j: 0 }], board: makeBoard(powered), rowPx: ROW, random: seeded() });
    run(flood, 8000);
    powered.forEach(tile => expect(flood.water.has(tile)).toBe(false));
  });

  it('sends out sea ghosts that chase the team, and hurt on a hit', () => {
    const flood = new AquariumFlood({ sources: [{ i: 6, j: 0 }], board: makeBoard(), rowPx: ROW, random: seeded() });
    const player = { key: 4, spot: { x: 6 * ROW, y: 6 * ROW } };
    const hits = run(flood, 12000, [player]);
    expect(flood.ghosts.length).toBeGreaterThan(1);
    expect(hits.some(({ key }) => key == 4)).toBe(true);
    expect(AQUARIUM_FLOOD.ghostIcons).toContain(flood.ghosts[0].icon);
  });

  it('a ghost that misses overshoots, then comes about', () => {
    const flood = new AquariumFlood({ sources: [{ i: 6, j: 0 }], board: makeBoard(), rowPx: ROW, random: seeded() });
    const ghost = { id: 0, icon: 'crab', x: 0, y: 100, vx: (AQUARIUM_FLOOD.ghostSpeedRows * ROW) / 1000, vy: 0, bornMs: 0, isGone: false };
    flood.ghosts.push(ghost);
    flood.nextGhostMs = Infinity;
    const target = [{ key: 1, spot: { x: 20, y: 150 } }]; // inside its turning circle: it can't turn in time
    let passed = false;
    let cameBack = false;
    for (let t = 0; t < 6000 && !ghost.isGone; t += 50) {
      flood.step(50, target);
      if (ghost.x > 20) passed = true;
      if (passed && ghost.vx < 0) cameBack = true;
    }
    expect(passed).toBe(true);
    expect(cameBack).toBe(true);
  });

  it('wading slows by one a touch, up to three, each for a second', () => {
    expect(getWaterSlow([], 0)).toBe(0);
    expect(getWaterSlow([500, 900], 100)).toBe(2);
    expect(getWaterSlow([500, 900, 1000, 1100, 1200], 100)).toBe(3);
    expect(getWaterSlow([500, 900], 950)).toBe(0);
  });
});
