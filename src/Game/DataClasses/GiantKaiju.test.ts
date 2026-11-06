import { describe, expect, it } from 'vitest';
import { GIANT_KAIJU, GiantKaiju } from './GiantKaiju';

const ROW = 20;
const ROUTE = [{ x: 500, y: 2000 }, { x: 500, y: 1000 }, { x: 600, y: 400 }];
const make = () => new GiantKaiju({ route: ROUTE, rowPx: ROW });
const run = (giant, ms, targets = []) => {
  const events = [];
  for (let t = 0; t < ms; t += 100) events.push(...giant.step(100, targets));
  return events;
};

describe('the giant Kaiju', () => {
  it('marches up the route to the city', () => {
    const giant = make();
    expect(giant.getFeet()).toEqual(ROUTE[0]);
    run(giant, 10000);
    expect(giant.getFeet().y).toBeCloseTo(2000 - GIANT_KAIJU.marchRowsPerSecond * ROW * 10, 0);
    run(giant, 1000000);
    expect(giant.getIsAtCity()).toBe(true);
    expect(giant.getFeet()).toEqual(ROUTE[2]);
  });

  it('a hit staggers it: it stops, and is pushed back', () => {
    const giant = make();
    run(giant, 4000);
    const before = giant.distancePx;
    giant.hit();
    expect(giant.distancePx).toBeLessThan(before);
    const pushed = giant.distancePx;
    run(giant, GIANT_KAIJU.staggerMs - 100);
    expect(giant.distancePx).toBe(pushed);
  });

  it('the weak spot moves from the head to the chest to the tail', () => {
    const giant = make();
    expect(giant.getPart().id).toBe('head');
    for (let k = 0; k < GIANT_KAIJU.hitsPerPart; k += 1) giant.hit();
    expect(giant.getPart().id).toBe('chest');
    for (let k = 0; k < GIANT_KAIJU.hitsPerPart; k += 1) giant.hit();
    expect(giant.getPart().id).toBe('tail');
    // the head is above the chest, above the tail
    const [head, chest, tail] = GIANT_KAIJU.parts.map(part => giant.getPartBox(part).center.y);
    expect(head).toBeLessThan(chest);
    expect(chest).toBeLessThan(tail);
  });

  it('stomps near players after a warning, sweeps its tail at those behind it, and breathes fire further off', () => {
    const near = make();
    const feet = near.getFeet();
    const events = run(near, GIANT_KAIJU.attackEveryMs + GIANT_KAIJU.stomp.warnMs + 200, [{ x: feet.x + 3 * ROW, y: feet.y - 3 * ROW }]);
    expect(events.map(({ type }) => type)).toEqual(expect.arrayContaining(['stompWarn', 'stomp']));
    const behind = make();
    const tailEvents = run(behind, GIANT_KAIJU.attackEveryMs + GIANT_KAIJU.tail.warnMs + 200, [{ x: feet.x, y: feet.y + 2 * ROW }]);
    expect(tailEvents.map(({ type }) => type)).toEqual(expect.arrayContaining(['tailWarn', 'tail']));
    const far = make();
    const head = far.getHead();
    const breathEvents = run(far, GIANT_KAIJU.attackEveryMs + 50, [{ x: head.x, y: head.y - 9 * ROW }]);
    expect(breathEvents.map(({ type }) => type)).toContain('breath');
  });

  it('sends each wave of Kaiju once, as its power drains', () => {
    const giant = make();
    expect(giant.takeWaves(0.9)).toEqual([]);
    expect(giant.takeWaves(0.7).map(({ count }) => count)).toEqual([5]);
    expect(giant.takeWaves(0.7)).toEqual([]);
    expect(giant.takeWaves(0.2).map(({ count }) => count)).toEqual([7, 10]);
  });
});
