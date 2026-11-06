/*
  The ghost boss: the Rooftop fight in phases (Jamie, 2026-11-05).
  Each time Punk Girl is brought to zero she screams, the team is pulled onto the graveyard roof, and a ring of ghosts
  circles them. One at a time, a ghost shakes (still circling) and launches itself at them. A ghost that touches someone,
  circling or launched, costs them a health point and is gone. Dispel destroys launched ghosts only.
  The ring is spent once every ghost has launched or hit someone.

  Distances are in the level's tile rows, and spots are where pieces stand (their 'charLocation').
*/

export const GHOST_BOSS = {
  rings: [6, 12, 12], // ghosts in each phase's ring: six, then one more between each (Jamie). the third phase leaves her a ghost.
  ringRadiusRows: 17, // the ring's size: round the whole graveyard roof, out over the sea and down the building's face (Jamie's mockup)
  ringSquash: 1, // a circle, as in the mockup
  spinSeconds: 6, // one turn of the ring: it sweeps the walkway to the other roof, so crossing it means dodging
  fadeInMs: 1500, // the ghosts fade in as the ring forms
  firstLaunchMs: 1400, // after the ring has formed, the first launch
  launchEveryMs: 1000, // then one launch about every second
  shakeMs: 700, // the ghost about to launch shakes this long first, still circling
  launchSpeedRows: 8, // a launched ghost's speed, in rows a second
  turnPerSecond: 2.2, // how hard a launched ghost turns after its target, in radians a second
  launchedMaxMs: 3200, // a launched ghost that misses fades away after this long
  hitRows: 0.6, // how close a ghost's path comes to someone to hit them (it can move several tiles a tick)
  ghostLives: 1, // her health as a ghost, in the last phase
  teammateMarginRows: 1.1 // the teammate keeps this far inside the ring
};

type Spot = { x: number; y: number };

export type Ghost = {
  id: number;
  slot: number; // its place around the ring, in radians
  state: 'circling' | 'launched' | 'gone';
  x: number;
  y: number;
  vx: number; // when launched, in pixels a millisecond
  vy: number;
  launchedAtMs: number;
  lastX: number; // where it was a step ago: a hit is anywhere along the way
  lastY: number;
};

export type GhostTarget = { key: number; spot: Spot };

export type GhostHit = { key: number; dirs: Array<string> };

const TURN = Math.PI * 2;

// how close a spot comes to the line from one spot to another
const getDistanceToPath = (spot: Spot, from: Spot, to: Spot) => {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = dx * dx + dy * dy;
  const share = length ? Math.max(0, Math.min(1, ((spot.x - from.x) * dx + (spot.y - from.y) * dy) / length)) : 0;
  return Math.hypot(spot.x - (from.x + dx * share), spot.y - (from.y + dy * share));
};

// the way a ghost is travelling, as a board direction, for how a body is thrown when the hit kills
const getDirs = (vx: number, vy: number) => {
  if (Math.abs(vx) > Math.abs(vy)) return [vx > 0 ? 'right' : 'left'];
  return [vy > 0 ? 'down' : 'up'];
};

export class GhostRing {
  center: Spot;
  rowPx: number;
  radiusPx: number;
  ghosts: Array<Ghost>;
  ms = 0; // the ring's own clock: it spins while it forms, in a cutscene, before the game's time starts again
  formedAtMs: number | undefined = undefined;
  nextLaunchAtMs = 0;
  nextGhostId: number | undefined = undefined; // the ghost that shakes, then launches next

  constructor({ center, count, rowPx, radiusRows = GHOST_BOSS.ringRadiusRows }: { center: Spot; count: number; rowPx: number; radiusRows?: number }) {
    this.center = { ...center };
    this.rowPx = rowPx;
    this.radiusPx = radiusRows * rowPx;
    this.ghosts = Array.from({ length: count }, (_, id) => ({ id, slot: (id / count) * TURN, state: 'circling', x: 0, y: 0, vx: 0, vy: 0, launchedAtMs: 0, lastX: 0, lastY: 0 }));
    this.placeCircling();
    this.ghosts.forEach(ghost => { ghost.lastX = ghost.x; ghost.lastY = ghost.y; });
  }

  getAngle(ms = this.ms) {
    return (ms / (GHOST_BOSS.spinSeconds * 1000)) * TURN;
  }

  // where a circling ghost is at a moment of the ring's clock
  getCirclingSpot(ghost: Ghost, ms = this.ms) {
    const angle = this.getAngle(ms) + ghost.slot;
    return { x: this.center.x + Math.cos(angle) * this.radiusPx, y: this.center.y + Math.sin(angle) * this.radiusPx * GHOST_BOSS.ringSquash };
  }

  private placeCircling() {
    this.ghosts.filter(({ state }) => state == 'circling').forEach(ghost => Object.assign(ghost, this.getCirclingSpot(ghost)));
  }

  // 0 to 1 as the ring fades in
  getFade(ms = this.ms) {
    return Math.min(ms / GHOST_BOSS.fadeInMs, 1);
  }

  getIsFormed() {
    return this.formedAtMs !== undefined;
  }

  getIsSpent() {
    return this.ghosts.every(({ state }) => state == 'gone');
  }

  // the ghost shaking before its launch, if any
  getShakingGhost() {
    if (this.nextGhostId === undefined || !this.getIsFormed()) return undefined;
    const ghost = this.ghosts[this.nextGhostId];
    return ghost.state == 'circling' && this.ms >= this.nextLaunchAtMs - GHOST_BOSS.shakeMs ? ghost : undefined;
  }

  getLiveGhosts() {
    return this.ghosts.filter(({ state }) => state != 'gone');
  }

  // in a cutscene: the ring spins and fades in, and nothing launches or hits yet
  stepForming(ms: number) {
    this.ms += ms;
    this.placeCircling();
  }

  // in play: spins, launches, flies, and hits. 'targets' are the team's pieces still standing; 'isDispelled' says whether
  // a launched ghost is over the team's Dispel. returns who was hit.
  step(ms: number, targets: Array<GhostTarget>, isDispelled: (spot: Spot) => boolean = () => false): Array<GhostHit> {
    this.ms += ms;
    this.ghosts.forEach(ghost => { ghost.lastX = ghost.x; ghost.lastY = ghost.y; });
    if (!this.getIsFormed()) {
      if (this.getFade() < 1) {
        this.placeCircling();
        return [];
      }
      this.formedAtMs = this.ms;
      this.nextLaunchAtMs = this.ms + GHOST_BOSS.firstLaunchMs;
      this.pickNextGhost();
    }
    this.placeCircling();

    if (this.nextGhostId !== undefined && this.ms >= this.nextLaunchAtMs) {
      this.launch(this.ghosts[this.nextGhostId], targets);
      this.nextLaunchAtMs = this.ms + GHOST_BOSS.launchEveryMs;
      this.pickNextGhost();
    }

    const speed = (GHOST_BOSS.launchSpeedRows * this.rowPx) / 1000;
    this.ghosts.filter(({ state }) => state == 'launched').forEach(ghost => {
      const target = this.getClosest(ghost, targets);
      if (target) {
        // it turns after its target, a little at a time
        const heading = Math.atan2(ghost.vy, ghost.vx);
        const wanted = Math.atan2(target.spot.y - ghost.y, target.spot.x - ghost.x);
        const off = Math.atan2(Math.sin(wanted - heading), Math.cos(wanted - heading));
        const maxTurn = (GHOST_BOSS.turnPerSecond * ms) / 1000;
        const next = heading + Math.max(Math.min(off, maxTurn), -maxTurn);
        ghost.vx = Math.cos(next) * speed;
        ghost.vy = Math.sin(next) * speed;
      }
      ghost.x += ghost.vx * ms;
      ghost.y += ghost.vy * ms;
      if (this.ms - ghost.launchedAtMs > GHOST_BOSS.launchedMaxMs || isDispelled(ghost)) ghost.state = 'gone';
    });

    // anyone a ghost touches loses a health point, and the ghost is spent
    const hits: Array<GhostHit> = [];
    const hitPx = GHOST_BOSS.hitRows * this.rowPx;
    this.getLiveGhosts().forEach(ghost => {
      const hit = targets.find(({ spot }) => getDistanceToPath(spot, { x: ghost.lastX, y: ghost.lastY }, ghost) <= hitPx);
      if (!hit) return;
      ghost.state = 'gone';
      const vx = ghost.vx || ghost.x - this.center.x;
      const vy = ghost.vy || ghost.y - this.center.y;
      hits.push({ key: hit.key, dirs: getDirs(vx, vy) });
    });
    if (this.nextGhostId !== undefined && this.ghosts[this.nextGhostId].state != 'circling') this.pickNextGhost();
    return hits;
  }

  private getClosest(ghost: Ghost, targets: Array<GhostTarget>) {
    return targets.reduce<GhostTarget | undefined>((closest, target) =>
      !closest || Math.hypot(target.spot.x - ghost.x, target.spot.y - ghost.y) < Math.hypot(closest.spot.x - ghost.x, closest.spot.y - ghost.y) ? target : closest, undefined);
  }

  private launch(ghost: Ghost, targets: Array<GhostTarget>) {
    if (ghost.state != 'circling') return;
    const target = this.getClosest(ghost, targets);
    const to = target ? target.spot : this.center;
    const length = Math.hypot(to.x - ghost.x, to.y - ghost.y) || 1;
    const speed = (GHOST_BOSS.launchSpeedRows * this.rowPx) / 1000;
    ghost.state = 'launched';
    ghost.vx = ((to.x - ghost.x) / length) * speed;
    ghost.vy = ((to.y - ghost.y) / length) * speed;
    ghost.launchedAtMs = this.ms;
  }

  // the next to launch is a circling ghost picked at random, so the players watch the whole ring
  private pickNextGhost() {
    const circling = this.ghosts.filter(({ state }) => state == 'circling');
    this.nextGhostId = circling.length ? circling[Math.floor(Math.random() * circling.length)].id : undefined;
  }

  // the threats a teammate steps away from: the shaking ghost where it is, and launched ghosts a moment ahead
  getThreats(aheadMs = 350): Array<Spot> {
    const shaking = this.getShakingGhost();
    return [
      ...(shaking ? [{ x: shaking.x, y: shaking.y }] : []),
      ...this.ghosts.filter(({ state }) => state == 'launched').map(({ x, y, vx, vy }) => ({ x: x + vx * aheadMs, y: y + vy * aheadMs }))
    ];
  }

  // whether a spot is far enough inside the ring for the teammate to stand on
  getIsWellInside(spot: Spot) {
    const dx = spot.x - this.center.x;
    const dy = (spot.y - this.center.y) / GHOST_BOSS.ringSquash;
    return Math.hypot(dx, dy) <= this.radiusPx - GHOST_BOSS.teammateMarginRows * this.rowPx;
  }
}
