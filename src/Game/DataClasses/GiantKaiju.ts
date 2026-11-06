/*
  The final battle (Jamie, 2026-11-06): the teammate, turned into a giant Kaiju, marches up the Peninsula for the city.
  Its power is drained by hitting its weak spot: one body part at a time (head, then chest, then tail), outlined and pulsing.
  Each hit staggers its march. As it drains, waves of Kaiju come to protect their leader. When it is drained, the player's
  ray gun pulls out the last of its power and it is the teammate again. If it reaches the city, the fight is lost.

  It stomps (a shadow first, then a ring of damage), breathes Kaiju Fire at whoever is in front, and sweeps its tail at
  anyone behind. Spots are in the level's pixels, where pieces stand; sizes in tile rows.
*/

export const GIANT_KAIJU = {
  isFinalBattle: false, // true: the campaign ends with the giant. false: the Peninsula's usual fight, 30 Kaiju (and the teammate doesn't transform)
  mapScale: 3, // the final battle's Peninsula, this many times the usual (tune with the march speed)
  sizeRows: { width: 6, height: 8 }, // the giant, in tile rows
  marchRowsPerSecond: 0.5, // its walk up the Peninsula
  drainHits: 24, // hits on the weak spot to drain it
  hitsPerPart: 4, // then the weak spot moves on to the next part
  hitEveryMs: 400, // a part can be hit this often
  staggerMs: 700, // a hit stops its march for a moment
  staggerBackRows: 0.35, // and pushes it back this far
  attackEveryMs: 3000,
  stomp: { warnMs: 1100, radiusRows: 2.2, reachRows: 7 },
  breath: { reachRows: 11 }, // Kaiju Fire, cast from its head at whoever is in front
  tail: { warnMs: 900, radiusRows: 4.5, behindRows: 0.5 }, // anyone behind it, within reach
  // the Kaiju that come to protect it: each wave once, as its power drains past the share
  waves: [{ atShare: 0.75, count: 5 }, { atShare: 0.5, count: 7 }, { atShare: 0.25, count: 10 }],
  // the weak parts, from its feet, as shares of its size: x across (0 the middle), y up (1 the top of its head)
  parts: [
    { id: 'head', x: 0, y: 0.84, width: 0.34, height: 0.2 },
    { id: 'chest', x: 0, y: 0.55, width: 0.42, height: 0.24 },
    { id: 'tail', x: 0.18, y: 0.16, width: 0.4, height: 0.2 }
  ]
};

type Spot = { x: number; y: number };

export type GiantEvent =
  | { type: 'stompWarn'; spot: Spot; endsAtMs: number }
  | { type: 'stomp'; spot: Spot; radiusPx: number }
  | { type: 'breath'; target: Spot }
  | { type: 'tailWarn'; spot: Spot; endsAtMs: number }
  | { type: 'tail'; spot: Spot; radiusPx: number };

export class GiantKaiju {
  route: Array<Spot>; // from the foot of the Peninsula to the city
  rowPx: number;
  distancePx = 0; // how far along the route
  ms = 0;
  staggerUntilMs = 0;
  nextAttackMs: number;
  partIndex = 0;
  partHits = 0;
  pendingAttack: { type: 'stomp' | 'tail'; spot: Spot; atMs: number } | undefined = undefined;
  wavesSent = 0;

  constructor({ route, rowPx }: { route: Array<Spot>; rowPx: number }) {
    this.route = route;
    this.rowPx = rowPx;
    this.nextAttackMs = GIANT_KAIJU.attackEveryMs;
  }

  getRouteLength() {
    return this.route.slice(1).reduce((total, spot, k) => total + Math.hypot(spot.x - this.route[k].x, spot.y - this.route[k].y), 0);
  }

  // 0 at the foot of the Peninsula, 1 at the city
  getProgress() {
    return Math.min(this.distancePx / this.getRouteLength(), 1);
  }

  getIsAtCity() {
    return this.getProgress() >= 1;
  }

  // where its feet are
  getFeet(): Spot {
    let left = this.distancePx;
    for (let k = 1; k < this.route.length; k += 1) {
      const from = this.route[k - 1];
      const to = this.route[k];
      const length = Math.hypot(to.x - from.x, to.y - from.y);
      if (left <= length) return { x: from.x + ((to.x - from.x) * left) / length, y: from.y + ((to.y - from.y) * left) / length };
      left -= length;
    }
    return { ...this.route[this.route.length - 1] };
  }

  getSizePx() {
    return { width: GIANT_KAIJU.sizeRows.width * this.rowPx, height: GIANT_KAIJU.sizeRows.height * this.rowPx };
  }

  getPart() {
    return GIANT_KAIJU.parts[this.partIndex % GIANT_KAIJU.parts.length];
  }

  // a part's box, in level pixels
  getPartBox(part = this.getPart()) {
    const feet = this.getFeet();
    const size = this.getSizePx();
    const width = part.width * size.width;
    const height = part.height * size.height;
    const center = { x: feet.x + part.x * size.width, y: feet.y - part.y * size.height };
    return { left: center.x - width / 2, top: center.y - height / 2, width, height, center };
  }

  getHead() {
    return this.getPartBox(GIANT_KAIJU.parts[0]).center;
  }

  // the weak spot was hit: it staggers, and after enough hits the weak spot moves to the next part
  hit() {
    this.staggerUntilMs = this.ms + GIANT_KAIJU.staggerMs;
    this.distancePx = Math.max(this.distancePx - GIANT_KAIJU.staggerBackRows * this.rowPx, 0);
    this.partHits += 1;
    if (this.partHits >= GIANT_KAIJU.hitsPerPart) {
      this.partHits = 0;
      this.partIndex += 1;
    }
  }

  // the waves due now that its power is down to 'share' (1 full, 0 drained)
  takeWaves(share: number) {
    const due = GIANT_KAIJU.waves.filter(({ atShare }) => share <= atShare).length;
    const waves = GIANT_KAIJU.waves.slice(this.wavesSent, due);
    this.wavesSent = Math.max(this.wavesSent, due);
    return waves;
  }

  // marches, and attacks whoever is near. 'targets' are where the team stands.
  step(ms: number, targets: Array<Spot>): Array<GiantEvent> {
    this.ms += ms;
    const events: Array<GiantEvent> = [];
    if (this.ms >= this.staggerUntilMs && !this.pendingAttack) this.distancePx += (GIANT_KAIJU.marchRowsPerSecond * this.rowPx * ms) / 1000;

    // a stomp or a sweep lands when its warning is over
    if (this.pendingAttack && this.ms >= this.pendingAttack.atMs) {
      const { type, spot } = this.pendingAttack;
      events.push(type == 'stomp'
        ? { type: 'stomp', spot, radiusPx: GIANT_KAIJU.stomp.radiusRows * this.rowPx }
        : { type: 'tail', spot, radiusPx: GIANT_KAIJU.tail.radiusRows * this.rowPx });
      this.pendingAttack = undefined;
    }

    if (this.ms >= this.nextAttackMs && !this.pendingAttack && targets.length) {
      this.nextAttackMs = this.ms + GIANT_KAIJU.attackEveryMs;
      const feet = this.getFeet();
      const head = this.getHead();
      const getDistance = (a: Spot, b: Spot) => Math.hypot(a.x - b.x, a.y - b.y) / this.rowPx;
      const closest = targets.reduce((best, spot) => getDistance(spot, feet) < getDistance(best, feet) ? spot : best);
      // behind it: it marches up the screen, so behind is below its feet
      const behind = targets.find(spot => spot.y > feet.y + GIANT_KAIJU.tail.behindRows * this.rowPx && getDistance(spot, feet) <= GIANT_KAIJU.tail.radiusRows);
      if (behind) {
        const spot = { x: feet.x + GIANT_KAIJU.parts[2].x * this.getSizePx().width, y: feet.y + this.rowPx };
        this.pendingAttack = { type: 'tail', spot, atMs: this.ms + GIANT_KAIJU.tail.warnMs };
        events.push({ type: 'tailWarn', spot, endsAtMs: this.pendingAttack.atMs });
      } else if (getDistance(closest, feet) <= GIANT_KAIJU.stomp.reachRows) {
        const spot = { ...closest };
        this.pendingAttack = { type: 'stomp', spot, atMs: this.ms + GIANT_KAIJU.stomp.warnMs };
        events.push({ type: 'stompWarn', spot, endsAtMs: this.pendingAttack.atMs });
      } else if (getDistance(closest, head) <= GIANT_KAIJU.breath.reachRows) {
        events.push({ type: 'breath', target: { ...closest } });
      }
    }
    return events;
  }
}
