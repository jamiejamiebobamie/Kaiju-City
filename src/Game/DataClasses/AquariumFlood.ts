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
  pourEveryMs: 320, // at first, each broken tank lets out water this often (between the waves: see 'waves')
  // the tanks pour in waves (Jamie): a surge of water every 'everyMs', for 'surgeMs', each tank letting out water every
  // 'surgePourEveryMs'; between surges, a trickle every 'tricklePourEveryMs'. each surge sends out a sea creature too.
  waves: { everyMs: 5000, surgeMs: 1800, surgePourEveryMs: 110, tricklePourEveryMs: 900 },
  // water that reaches the bottom of the floor (within this many rows of its lowest tiles) drains away this soon (Jamie)
  bottomDrain: { rows: 2.5, ms: 1100 },
  // a panel breaking (Jamie): a gush of water out of it, which swirls round in front of the tank (out, and back in on
  // itself) for 'swirlMs', then runs off with the rest. 'count' parcels, within 'rows' of the tank's pour tile.
  burst: { count: 14, rows: 3, swirlMs: 3500 },
  // the gush runs away from the glass for 'outMs'; then its edges curl back and in, like water (Jamie): looking the way
  // it runs, the right edge turns back round a point out to its right (counterclockwise, for a gush running down the
  // screen), the left edge the other way. the middle runs on. 'curlRows': how wide the curls are. 'middleRows': the middle.
  wave: { outMs: 900, curlRows: 1.6, middleRows: 0.8 },
  drainMs: 9000, // once the pouring stops, the water left drains away over this long
  flowStyle: 'flow' as 'flow' | 'bounce', // 'flow': runs downhill, spreads sideways and pools. 'bounce': runs straight and bounces off the edges, like Wildfire
  bounceLifeMs: 7000, // a bouncing parcel of water lasts this long
  isYielding: true, // any power on a tile washes the water and the sea ghosts there away
  slow: { perStack: 1, maxStacks: 3, stackMs: 1000, everyMs: 250 }, // wading: each touch of water (every 'everyMs' in it) slows by one, up to three, each for a second
  ghostEveryMs: 1800, // a sea creature comes out of a broken tank this often while the tanks pour (and one with each wave)
  healEveryMs: 1400, // up on the top floor, she heals one health this often until she is whole
  // each sea creature in one color of its own, from nature (Jamie)
  // (angler fish, sea urchin, shark fin, shrimp and sperm whale are out: Jamie, 2026-11-06)
  ghostIcons: {
    clownfish: '#ff7f27', crab: '#d9442b', dolphin: '#8aa4b8', eel: '#6b7b3a', 'giant-squid': '#c2524a',
    jellyfish: '#e6a8d7', 'kraken-tentacle': '#8e3f5a', 'manta-ray': '#3d4e5c', octopus: '#e0703a', 'sea-serpent': '#2f7a5a',
    'sea-star': '#f28c28', 'sea-turtle': '#5a8f3c', seahorse: '#f2c14e', 'shark-jaws': '#9aa7b0', squid: '#e8b4a0', 'tropical-fish': '#2fa4e7'
  } as Record<string, string>,
  // which way each one's head points in its picture, in screen degrees (0 right, 90 down), and how it turns as it swims:
  // 'side': seen from the side; turned so the head leads, and mirrored when going left, so it is never upside down.
  // 'free': seen from above; turned any way. 'mirror': only mirrored when going left. 'none': not turned.
  ghostPoses: {
    clownfish: { turn: 'side', head: -30 }, dolphin: { turn: 'side', head: -50 }, eel: { turn: 'side', head: 0 },
    'sea-serpent': { turn: 'side', head: 0 }, 'sea-turtle': { turn: 'side', head: 0 }, 'tropical-fish': { turn: 'side', head: 0 },
    'giant-squid': { turn: 'free', head: -90 }, jellyfish: { turn: 'free', head: -90 }, 'manta-ray': { turn: 'free', head: -45 },
    octopus: { turn: 'free', head: -90 }, squid: { turn: 'free', head: -135 },
    seahorse: { turn: 'mirror', head: 0 },
    crab: { turn: 'none', head: 0 }, 'sea-star': { turn: 'none', head: 0 }, 'kraken-tentacle': { turn: 'none', head: 0 }, 'shark-jaws': { turn: 'none', head: 0 }
  } as Record<string, { turn: string; head: number }>
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

// 'step': its last move, in pixels (the way its water runs, for the icon). 'swirl': circling a broken tank for a while.
type Wave = { away: Spot; axis: Spot; curlAtMs: number; untilMs: number };
type Parcel = { tile: Tile; dir: number; bornMs: number; dryAtMs: number; step?: Spot; swirl?: { center: Spot; untilMs: number; sense: number }; wave?: Wave };

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
  bottomY: number | undefined; // the floor's lowest tiles, where the water drains away (no draining without it)
  lastWave = -1;

  constructor({ sources, board, rowPx, random = Math.random, bottomY }: { sources: Array<Tile>; board: FloodBoard; rowPx: number; random?: () => number; bottomY?: number }) {
    this.sources = sources;
    this.board = board;
    this.rowPx = rowPx;
    this.random = random;
    this.bottomY = bottomY;
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

  // each wet tile, and the way its water last ran (undefined if it hasn't moved)
  getWaterFlows() {
    return [...this.water.values()].map(({ tile, step }) => ({ tile, step }));
  }

  // a panel breaks: a gush of water around its pour tile. 'away': the way it runs off the glass (unit). without it, it only
  // swirls round in front of the tank.
  burst(source: Tile, away?: Spot) {
    const { count, rows, swirlMs } = AQUARIUM_FLOOD.burst;
    const center = this.board.getSpot(source);
    const reach = rows * this.rowPx;
    const seen = new Set([key(source)]);
    const queue = [source];
    let added = 0;
    const sense = this.random() < 0.5 ? 1 : -1;
    for (let k = 0; k < queue.length && added < count; k += 1) {
      const tile = queue[k];
      if (!this.water.has(key(tile)) && this.board.getIsWaterTile(tile)) {
        const motion = away
          ? { wave: { away, axis: center, curlAtMs: this.ms + AQUARIUM_FLOOD.wave.outMs, untilMs: this.ms + swirlMs } }
          : { swirl: { center, untilMs: this.ms + swirlMs, sense } };
        this.water.set(key(tile), { tile, dir: Math.floor(this.random() * 6), bornMs: this.ms, dryAtMs: this.getDryAt(this.ms), ...motion });
        added += 1;
      }
      this.board.getNeighbors(tile).forEach(next => {
        const spot = this.board.getSpot(next);
        if (seen.has(key(next)) || Math.hypot(spot.x - center.x, spot.y - center.y) > reach) return;
        seen.add(key(next));
        queue.push(next);
      });
    }
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
    this.drainAtBottom();
    if (AQUARIUM_FLOOD.isYielding) [...this.water.entries()].forEach(([tileKey, { tile }]) => { if (this.board.getIsPowerOnTile(tile)) this.water.delete(tileKey); });
    [...this.water.entries()].forEach(([tileKey, { dryAtMs }]) => { if (this.ms >= dryAtMs) this.water.delete(tileKey); });
    return this.spawnGhosts();
  }

  private pour() {
    if (!this.getIsPouring() || this.ms < this.nextPourMs) return;
    const share = this.getPourShare();
    if (share <= 0) return;
    this.nextPourMs = this.ms + this.getPourEveryMs() / share;
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

  // in a wave's surge, the tanks gush; between, they trickle
  getIsSurging() {
    const { everyMs, surgeMs } = AQUARIUM_FLOOD.waves;
    return this.ms % everyMs < surgeMs;
  }

  private getPourEveryMs() {
    const { surgePourEveryMs, tricklePourEveryMs } = AQUARIUM_FLOOD.waves;
    return this.getIsSurging() ? surgePourEveryMs : tricklePourEveryMs;
  }

  // water at the bottom of the floor drains away soon (it would otherwise pool there for the whole flood)
  private drainAtBottom() {
    if (this.bottomY === undefined) return;
    const { rows, ms } = AQUARIUM_FLOOD.bottomDrain;
    this.water.forEach(parcel => {
      if (this.board.getSpot(parcel.tile).y >= this.bottomY! - rows * this.rowPx) parcel.dryAtMs = Math.min(parcel.dryAtMs, this.ms + ms);
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
      // a gush off the glass: it runs away from it; then its edges curl back and in (each its own way round), the middle on
      if (parcel.wave && this.ms < parcel.wave.untilMs && !parcel.swirl) {
        const { away, axis, curlAtMs, untilMs } = parcel.wave;
        const right = { x: away.y, y: -away.x }; // its right edge as seen on screen: running down the screen, the screen's right
        const side = (here.x - axis.x) * right.x + (here.y - axis.y) * right.y;
        const { curlRows, middleRows } = AQUARIUM_FLOOD.wave;
        if (this.ms >= curlAtMs && Math.abs(side) > middleRows * this.rowPx) {
          const out = Math.sign(side);
          // the curl's middle is out beyond the edge; seen on screen, the right edge goes round counterclockwise
          parcel.swirl = { center: { x: here.x + right.x * out * curlRows * this.rowPx, y: here.y + right.y * out * curlRows * this.rowPx }, untilMs, sense: out > 0 ? -1 : 1 };
        } else {
          const along = (tile: Tile) => { const spot = this.board.getSpot(tile); const dx = spot.x - here.x; const dy = spot.y - here.y; const d = Math.hypot(dx, dy) || 1; return (dx * away.x + dy * away.y) / d; };
          next = free.reduce((best, tile) => along(tile) > along(best) ? tile : best);
          if (along(next) <= 0) return;
        }
      }
      if (next) {
        // on its way off the glass
      } else if (parcel.swirl && this.ms < parcel.swirl.untilMs) {
        // round the broken tank: the way across its radius, kept about as far out (a little in if it has drifted out)
        const { center, sense } = parcel.swirl;
        const out = { x: here.x - center.x, y: here.y - center.y };
        const length = Math.hypot(out.x, out.y) || 1;
        const around = { x: (-out.y / length) * sense, y: (out.x / length) * sense };
        const inward = length > AQUARIUM_FLOOD.burst.rows * this.rowPx * 0.7 ? 0.5 : 0;
        const want = { x: around.x - (out.x / length) * inward, y: around.y - (out.y / length) * inward };
        const score = (tile: Tile) => { const spot = this.board.getSpot(tile); const dx = spot.x - here.x; const dy = spot.y - here.y; const d = Math.hypot(dx, dy) || 1; return (dx * want.x + dy * want.y) / d; };
        next = free.reduce((best, tile) => score(tile) > score(best) ? tile : best);
        if (score(next) < 0) return; // nowhere round from here: it waits a moment
      } else if (AQUARIUM_FLOOD.flowStyle == 'bounce') {
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
      const to = this.board.getSpot(next);
      parcel.step = { x: to.x - here.x, y: to.y - here.y };
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
    if (!this.getIsPouring() || !this.sources.length) return [];
    const share = this.getPourShare();
    if (share <= 0) return [];
    const spawns: Array<SeaGhostSpawn> = [];
    // each wave sends one out as it surges
    const wave = Math.floor(this.ms / AQUARIUM_FLOOD.waves.everyMs);
    if (wave != this.lastWave && this.getIsSurging()) {
      this.lastWave = wave;
      spawns.push(this.getGhostSpawn());
    }
    if (this.ms >= this.nextGhostMs) {
      this.nextGhostMs = this.ms + AQUARIUM_FLOOD.ghostEveryMs / Math.max(share, 0.35);
      spawns.push(this.getGhostSpawn());
    }
    return spawns;
  }

  private getGhostSpawn(): SeaGhostSpawn {
    const source = this.sources[Math.floor(this.random() * this.sources.length)];
    const icons = Object.keys(AQUARIUM_FLOOD.ghostIcons);
    const icon = icons[Math.floor(this.random() * icons.length)];
    return { source, icon, color: AQUARIUM_FLOOD.ghostIcons[icon] };
  }

}

// how much slower water has a piece walking: stacks of one, up to three, each for a second
export const getWaterSlow = (stackEnds: Array<number>, accTime: number) => Math.min(stackEnds.filter(endsAt => endsAt > accTime).length, AQUARIUM_FLOOD.slow.maxStacks) * AQUARIUM_FLOOD.slow.perStack;
