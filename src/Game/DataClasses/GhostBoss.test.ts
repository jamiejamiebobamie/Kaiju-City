import { describe, expect, it } from 'vitest';
import { GHOST_BOSS, GhostRing } from './GhostBoss';

const ROW = 20;
const CENTER = { x: 500, y: 400 };
const makeRing = (count = 5) => new GhostRing({ center: CENTER, count, rowPx: ROW });
const stepFor = (ring, ms, targets, isDispelled = undefined) => {
  const hits = [];
  for (let t = 0; t < ms; t += 50) hits.push(...ring.step(50, targets, isDispelled));
  return hits;
};

describe('the ghost ring', () => {
  it('spaces its ghosts evenly around the ring, and spins them', () => {
    const ring = makeRing(5);
    const spots = ring.ghosts.map(ghost => ring.getCirclingSpot(ghost));
    spots.forEach(({ x, y }) => {
      const dx = x - CENTER.x;
      const dy = (y - CENTER.y) / GHOST_BOSS.ringSquash;
      expect(Math.hypot(dx, dy)).toBeCloseTo(GHOST_BOSS.ringRadiusRows * ROW, 5);
    });
    const before = { ...ring.ghosts[0] };
    ring.stepForming(100);
    expect(ring.ghosts[0].x).not.toBeCloseTo(before.x, 3);
  });

  it('launches nothing while it forms, then one ghost about every second, each shaking first', () => {
    const ring = makeRing(5);
    const center = [{ key: 0, spot: CENTER }];
    stepFor(ring, GHOST_BOSS.fadeInMs - 100, center);
    expect(ring.getIsFormed()).toBe(false);
    stepFor(ring, 200, center);
    expect(ring.getIsFormed()).toBe(true);
    expect(ring.ghosts.some(({ state }) => state == 'launched')).toBe(false);
    // the shake starts before the launch, while the ghost is still circling
    stepFor(ring, GHOST_BOSS.firstLaunchMs - GHOST_BOSS.shakeMs + 100, center);
    const shaking = ring.getShakingGhost();
    expect(shaking).toBeDefined();
    expect(shaking.state).toBe('circling');
    stepFor(ring, GHOST_BOSS.shakeMs, center);
    expect(ring.ghosts[shaking.id].state).not.toBe('circling');
  });

  it('a launched ghost goes for the players and costs a health point when it hits; then it is gone', () => {
    const ring = makeRing(5);
    const player = { key: 7, spot: { x: CENTER.x + 10, y: CENTER.y } };
    const hits = stepFor(ring, GHOST_BOSS.fadeInMs + GHOST_BOSS.firstLaunchMs + 4000, [player]);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].key).toBe(7);
    expect(ring.ghosts.filter(({ state }) => state == 'gone').length).toBe(hits.length);
  });

  it('a player walking out through the ring is hit by a circling ghost', () => {
    const ring = makeRing(9);
    stepFor(ring, GHOST_BOSS.fadeInMs + 50, []);
    // standing on the ring itself, for half a turn
    const onRing = { key: 1, spot: { x: CENTER.x + GHOST_BOSS.ringRadiusRows * ROW, y: CENTER.y } };
    const hits = stepFor(ring, (GHOST_BOSS.spinSeconds * 1000) / 2, [onRing]);
    expect(hits.length).toBeGreaterThan(0);
  });

  it('Dispel destroys launched ghosts, but not circling ones', () => {
    const ring = makeRing(5);
    const far = [{ key: 0, spot: { x: CENTER.x + 1000, y: CENTER.y } }];
    stepFor(ring, GHOST_BOSS.fadeInMs + GHOST_BOSS.firstLaunchMs + 100, far, () => true);
    expect(ring.ghosts.filter(({ state }) => state == 'gone').length).toBe(1);
    expect(ring.ghosts.filter(({ state }) => state == 'circling').length).toBe(4);
  });

  it('is spent once every ghost has launched or hit someone', () => {
    const ring = makeRing(5);
    const player = [{ key: 0, spot: CENTER }];
    stepFor(ring, GHOST_BOSS.fadeInMs + GHOST_BOSS.firstLaunchMs + GHOST_BOSS.launchEveryMs * 5 + GHOST_BOSS.launchedMaxMs, player);
    expect(ring.getIsSpent()).toBe(true);
  });

  it('can be made bigger or smaller', () => {
    const small = new GhostRing({ center: CENTER, count: 5, rowPx: ROW, radiusRows: 2 });
    expect(small.radiusPx).toBe(2 * ROW);
    expect(small.getIsWellInside({ x: CENTER.x + 2 * ROW, y: CENTER.y })).toBe(false);
    expect(small.getIsWellInside(CENTER)).toBe(true);
  });
});
