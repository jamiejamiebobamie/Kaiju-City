/*
  The Aquarium fight in phases (Jamie, 2026-11-06). At zero, the Mermaid screams "Stop!!!", the glass shatters,
  and the broken tanks pour water across the ground floor, with sea-creature ghosts now and then. Neither hurts her:
  she goes up to the top floor and heals there, and can't be hurt until she is whole again. The water slows people,
  more the longer they wade (up to three steps slower). The ghosts chase softly, overshoot, and turn back.
  The pouring tapers off, the water drains away, and she comes back down.

  The water moves here, a parcel to a tile, and is put on the board as its 'isFlood' status: the lowest of all, so any
  power on a tile washes it away ('isYielding'). The sea creatures are 'isSeaGhost' statuses on the board (Haunt's
  tile logic, kept to the flooded floor): the flood only says when and where one comes out of a broken tank.
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
  ghostEveryMs: 3200, // a sea creature comes out of a broken tank this often while the tanks pour
  healEveryMs: 1400, // up on the top floor, she heals one health this often until she is whole
  // each sea creature in one color of its own, from nature (Jamie)
  ghostIcons: {
    'angler-fish': '#6b5a48', clownfish: '#ff7f27', crab: '#d9442b', dolphin: '#8aa4b8', eel: '#6b7b3a', 'giant-squid': '#c2524a',
    jellyfish: '#e6a8d7', 'kraken-tentacle': '#8e3f5a', 'manta-ray': '#3d4e5c', octopus: '#e0703a', 'sea-serpent': '#2f7a5a',
    'sea-star': '#f28c28', 'sea-turtle': '#5a8f3c', 'sea-urchin': '#4b2a5c', seahorse: '#f2c14e', 'shark-fin': '#7d8a96',
    'shark-jaws': '#9aa7b0', shrimp: '#f4917a', 'sperm-whale': '#5b6770', squid: '#e8b4a0', 'tropical-fish': '#2fa4e7'
  } as Record<string, string>
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

export type SeaGhostSpawn = { source: Tile; icon: string; color: string };

const key = ({ i, j }: Tile) => `${i} ${j}`;

export class AquariumFlood {
  sources: Array<Tile>;
  board: FloodBoard;
  rowPx: number;
  ms = 0;
  water = new Map<string, Parcel>(); // a tile holds one parcel of water
  nextPourMs = 0;
  nextGhostMs: number;
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

  // the water is all gone (the sea creatures run out on their own)
  getIsOver() {
    return !this.getIsPouring() && this.water.size == 0;
  }

  getWaterTiles() {
    return [...this.water.values()].map(({ tile }) => tile);
  }

  getIsWet(tile: Tile | undefined) {
    return !!tile && this.water.has(key(tile));
  }

  // a parcel's time to dry: in the flood, it lasts; after, the water drains away over a while, a little at a time
  private getDryAt(bornMs: number) {
    if (AQUARIUM_FLOOD.flowStyle == 'bounce') return bornMs + AQUARIUM_FLOOD.bounceLifeMs;
    return AQUARIUM_FLOOD.floodMs + this.random() * AQUARIUM_FLOOD.drainMs;
  }

  // the water pours, flows and drains. returns the sea creatures due out of the tanks now.
  step(ms: number): Array<SeaGhostSpawn> {
    this.ms += ms;
    this.pour();
    this.flow();
    if (AQUARIUM_FLOOD.isYielding) [...this.water.entries()].forEach(([tileKey, { tile }]) => { if (this.board.getIsPowerOnTile(tile)) this.water.delete(tileKey); });
    [...this.water.entries()].forEach(([tileKey, { dryAtMs }]) => { if (this.ms >= dryAtMs) this.water.delete(tileKey); });
    return this.spawnGhosts();
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

  private spawnGhosts(): Array<SeaGhostSpawn> {
    if (!this.getIsPouring() || this.ms < this.nextGhostMs || !this.sources.length) return [];
    const share = this.getPourShare();
    if (share <= 0) return [];
    this.nextGhostMs = this.ms + AQUARIUM_FLOOD.ghostEveryMs / Math.max(share, 0.35);
    const source = this.sources[Math.floor(this.random() * this.sources.length)];
    const icons = Object.keys(AQUARIUM_FLOOD.ghostIcons);
    const icon = icons[Math.floor(this.random() * icons.length)];
    return [{ source, icon, color: AQUARIUM_FLOOD.ghostIcons[icon] }];
  }

}

// how much slower water has a piece walking: stacks of one, up to three, each for a second
export const getWaterSlow = (stackEnds: Array<number>, accTime: number) => Math.min(stackEnds.filter(endsAt => endsAt > accTime).length, AQUARIUM_FLOOD.slow.maxStacks) * AQUARIUM_FLOOD.slow.perStack;
