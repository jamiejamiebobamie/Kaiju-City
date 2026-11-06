/*
  The Aquarium fight in phases (Jamie, 2026-11-06). At zero, the Mermaid screams "Stop!!!", the glass shatters,
  and the broken tanks pour water across the ground floor, with sea-creature ghosts now and then. Neither hurts her:
  she goes up to the top floor and heals there, and can't be hurt until she is whole again. The water slows people,
  more the longer they wade (up to three steps slower). The ghosts chase softly, overshoot, and turn back.
  The pouring tapers off, the water drains away, and she comes back down.

  The water is kept here, by tile, not as a power on the board: any power on a tile washes it (and a ghost over it)
  away, so it is always the lowest thing on the tiles ('isYielding').
*/

export const AQUARIUM_FLOOD = {
  floodMs: 45000, // how long the tanks pour (tune it)
  taperFromShare: 0.55, // from this share of the flood on, the pouring slows until it stops
  pourEveryMs: 320, // at first, each broken tank lets out water this often
  drainMs: 9000, // once the pouring stops, the water left drains away over this long
  flowStyle: 'flow' as 'flow' | 'bounce', // 'flow': runs downhill, spreads sideways and pools. 'bounce': runs straight and bounces off the edges, like Wildfire
  bounceLifeMs: 7000, // a bouncing parcel of water lasts this long
  isYielding: true, // any power on a tile washes the water and the sea ghosts there away
  slow: { perStack: 1, maxStacks: 3, stackMs: 1000, everyMs: 250 }, // wading: each touch of water (every 'everyMs' in it) slows by one, up to three, each for a second
  ghostEveryMs: 3200, // a sea ghost comes out of a broken tank this often while the tanks pour
  ghostSpeedRows: 4.2, // in rows a second
  ghostTurnPerSecond: 1.5, // a soft lock: it turns after its target slowly, so it overshoots and comes about
  ghostLifeMs: 11000,
  ghostHitRows: 0.7,
  healEveryMs: 1400, // up on the top floor, she heals one health this often until she is whole
  ghostIcons: ['angler-fish', 'clownfish', 'crab', 'dolphin', 'eel', 'giant-squid', 'jellyfish', 'kraken-tentacle', 'manta-ray', 'octopus',
    'sea-serpent', 'sea-star', 'sea-turtle', 'sea-urchin', 'seahorse', 'shark-fin', 'shark-jaws', 'shrimp', 'sperm-whale', 'squid', 'tropical-fish']
};

type Tile = { i: number; j: number };
type Spot = { x: number; y: number };

export type FloodBoard = {
  getSpot: (tile: Tile) => Spot; // where a piece stands on a tile
  getNeighbors: (tile: Tile) => Array<Tile>; // walkable neighbors
  getIsWaterTile: (tile: Tile) => boolean; // part of the floor the water covers
  getIsPowerOnTile: (tile: Tile) => boolean; // a power on it, which washes water away
  getTileAt: (spot: Spot) => Tile | undefined;
};

type Parcel = { tile: Tile; dir: number; bornMs: number; dryAtMs: number };

export type SeaGhost = { id: number; icon: string; x: number; y: number; vx: number; vy: number; bornMs: number; isGone: boolean };

const key = ({ i, j }: Tile) => `${i} ${j}`;

export class AquariumFlood {
  sources: Array<Tile>;
  board: FloodBoard;
  rowPx: number;
  ms = 0;
  water = new Map<string, Parcel>(); // a tile holds one parcel of water
  ghosts: Array<SeaGhost> = [];
  nextPourMs = 0;
  nextGhostMs: number;
  nextGhostId = 0;
  random: () => number;

  constructor({ sources, board, rowPx, random = Math.random }: { sources: Array<Tile>; board: FloodBoard; rowPx: number; random?: () => number }) {
    this.sources = sources;
    this.board = board;
    this.rowPx = rowPx;
    this.random = random;
    this.nextGhostMs = AQUARIUM_FLOOD.ghostEveryMs * 0.5;
  }

  getIsPouring() {
    return this.ms < AQUARIUM_FLOOD.floodMs;
  }

  // 1 while the tanks pour freely, down to 0 as they run dry
  getPourShare() {
    const { floodMs, taperFromShare } = AQUARIUM_FLOOD;
    const taperFrom = floodMs * taperFromShare;
    if (this.ms <= taperFrom) return 1;
    return Math.max(1 - (this.ms - taperFrom) / (floodMs - taperFrom), 0);
  }

  // the water and the ghosts are all gone
  getIsOver() {
    return !this.getIsPouring() && this.water.size == 0 && this.ghosts.every(({ isGone }) => isGone);
  }

  getWaterTiles() {
    return [...this.water.values()].map(({ tile }) => tile);
  }

  getIsWet(tile: Tile | undefined) {
    return !!tile && this.water.has(key(tile));
  }

  getLiveGhosts() {
    return this.ghosts.filter(({ isGone }) => !isGone);
  }

  // a parcel's time to dry: in the flood, it lasts; after, the water drains away over a while, a little at a time
  private getDryAt(bornMs: number) {
    if (AQUARIUM_FLOOD.flowStyle == 'bounce') return bornMs + AQUARIUM_FLOOD.bounceLifeMs;
    return AQUARIUM_FLOOD.floodMs + this.random() * AQUARIUM_FLOOD.drainMs;
  }

  // the water moves on a tile step; the ghosts move every tick. 'targets' are the team, for the ghosts.
  step(ms: number, targets: Array<{ key: number; spot: Spot }>) {
    this.ms += ms;
    const hits: Array<{ key: number }> = [];
    this.pour();
    this.flow();
    if (AQUARIUM_FLOOD.isYielding) [...this.water.entries()].forEach(([tileKey, { tile }]) => { if (this.board.getIsPowerOnTile(tile)) this.water.delete(tileKey); });
    [...this.water.entries()].forEach(([tileKey, { dryAtMs }]) => { if (this.ms >= dryAtMs) this.water.delete(tileKey); });
    this.spawnGhosts();
    hits.push(...this.moveGhosts(ms, targets));
    return hits;
  }

  private pour() {
    if (!this.getIsPouring() || this.ms < this.nextPourMs) return;
    const share = this.getPourShare();
    if (share <= 0) return;
    this.nextPourMs = this.ms + AQUARIUM_FLOOD.pourEveryMs / share;
    this.sources.forEach(source => {
      if (this.water.has(key(source))) {
        // the tank's own tile is full: the water pushes out onto a free neighbor
        const free = this.board.getNeighbors(source).filter(tile => this.board.getIsWaterTile(tile) && !this.water.has(key(tile)));
        if (!free.length) return;
        const tile = free[Math.floor(this.random() * free.length)];
        this.water.set(key(tile), { tile, dir: Math.floor(this.random() * 6), bornMs: this.ms, dryAtMs: this.getDryAt(this.ms) });
        return;
      }
      this.water.set(key(source), { tile: source, dir: Math.floor(this.random() * 6), bornMs: this.ms, dryAtMs: this.getDryAt(this.ms) });
    });
  }

  // 'flow': each parcel runs down the floor (toward the bottom of the screen), or sideways when it can't, and pools.
  // 'bounce': each parcel runs on the way it is going, and turns back off whatever stops it.
  private flow() {
    const parcels = [...this.water.values()].sort((a, b) => this.board.getSpot(b.tile).y - this.board.getSpot(a.tile).y); // the lowest first, so the ones above can follow
    parcels.forEach(parcel => {
      const here = this.board.getSpot(parcel.tile);
      const free = this.board.getNeighbors(parcel.tile).filter(tile => this.board.getIsWaterTile(tile) && !this.water.has(key(tile)));
      if (!free.length) return;
      let next: Tile | undefined;
      if (AQUARIUM_FLOOD.flowStyle == 'bounce') {
        const ahead = free.filter(tile => this.getDir(parcel.tile, tile) == parcel.dir);
        if (ahead.length) next = ahead[0];
        else {
          parcel.dir = (parcel.dir + 3) % 6; // about
          const back = free.find(tile => this.getDir(parcel.tile, tile) == parcel.dir);
          next = back || free[Math.floor(this.random() * free.length)];
          parcel.dir = this.getDir(parcel.tile, next);
        }
      } else {
        const lower = free.filter(tile => this.board.getSpot(tile).y > here.y + 1);
        const level = free.filter(tile => Math.abs(this.board.getSpot(tile).y - here.y) <= this.rowPx * 0.6);
        const options = lower.length ? lower : level;
        if (!options.length) return;
        next = options[Math.floor(this.random() * options.length)];
      }
      this.water.delete(key(parcel.tile));
      parcel.tile = next;
      this.water.set(key(next), parcel);
    });
  }

  // which of six ways a step goes, from the angle between the two tiles
  private getDir(from: Tile, to: Tile) {
    const a = this.board.getSpot(from);
    const b = this.board.getSpot(to);
    const angle = Math.atan2(b.y - a.y, b.x - a.x);
    return ((Math.round(angle / (Math.PI / 3)) % 6) + 6) % 6;
  }

  private spawnGhosts() {
    if (!this.getIsPouring() || this.ms < this.nextGhostMs || !this.sources.length) return;
    const share = this.getPourShare();
    if (share <= 0) return;
    this.nextGhostMs = this.ms + AQUARIUM_FLOOD.ghostEveryMs / Math.max(share, 0.35);
    const source = this.sources[Math.floor(this.random() * this.sources.length)];
    const { x, y } = this.board.getSpot(source);
    const icons = AQUARIUM_FLOOD.ghostIcons;
    const speed = (AQUARIUM_FLOOD.ghostSpeedRows * this.rowPx) / 1000;
    const angle = -Math.PI / 2 + (this.random() - 0.5) * Math.PI; // out of the tank, upward-ish
    this.ghosts.push({ id: this.nextGhostId++, icon: icons[Math.floor(this.random() * icons.length)], x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, bornMs: this.ms, isGone: false });
  }

  private moveGhosts(ms: number, targets: Array<{ key: number; spot: Spot }>) {
    const hits: Array<{ key: number }> = [];
    const speed = (AQUARIUM_FLOOD.ghostSpeedRows * this.rowPx) / 1000;
    const hitPx = AQUARIUM_FLOOD.ghostHitRows * this.rowPx;
    this.getLiveGhosts().forEach(ghost => {
      const target = targets.reduce<{ key: number; spot: Spot } | undefined>((closest, next) =>
        !closest || Math.hypot(next.spot.x - ghost.x, next.spot.y - ghost.y) < Math.hypot(closest.spot.x - ghost.x, closest.spot.y - ghost.y) ? next : closest, undefined);
      if (target) {
        const heading = Math.atan2(ghost.vy, ghost.vx);
        const wanted = Math.atan2(target.spot.y - ghost.y, target.spot.x - ghost.x);
        const off = Math.atan2(Math.sin(wanted - heading), Math.cos(wanted - heading));
        const maxTurn = (AQUARIUM_FLOOD.ghostTurnPerSecond * ms) / 1000;
        const next = heading + Math.max(Math.min(off, maxTurn), -maxTurn);
        ghost.vx = Math.cos(next) * speed;
        ghost.vy = Math.sin(next) * speed;
      }
      ghost.x += ghost.vx * ms;
      ghost.y += ghost.vy * ms;
      const tile = this.board.getTileAt(ghost);
      if (this.ms - ghost.bornMs > AQUARIUM_FLOOD.ghostLifeMs || (AQUARIUM_FLOOD.isYielding && !!tile && this.board.getIsPowerOnTile(tile))) {
        ghost.isGone = true;
        return;
      }
      const hit = targets.find(({ spot }) => Math.hypot(spot.x - ghost.x, spot.y - ghost.y) <= hitPx);
      if (hit) {
        ghost.isGone = true;
        hits.push({ key: hit.key });
      }
    });
    return hits;
  }
}

// how much slower water has a piece walking: stacks of one, up to three, each for a second
export const getWaterSlow = (stackEnds: Array<number>, accTime: number) => Math.min(stackEnds.filter(endsAt => endsAt > accTime).length, AQUARIUM_FLOOD.slow.maxStacks) * AQUARIUM_FLOOD.slow.perStack;
