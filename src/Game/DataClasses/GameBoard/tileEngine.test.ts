import baseline from './__fixtures__/masterTileBaseline.json';
import { TILE_DIRS, TILE_STATUS_RANKS } from 'Utils/gameState';
import { MASTER_PENINSULA_TILES as PENINSULA_TILE_LOOKUP_VALS } from '../masterPeninsula';
import { CENTER_TILE, getLitTiles, makeGame, placePiece, putStatusOnTile } from '../testHelpers';

const runUntilClear = (gm, maxTicks) => {
  const series = [getLitTiles(gm).length];
  for (let tick = 1; tick <= maxTicks; tick++) {
    gm.gameBoardManager.updateTileState(tick);
    const lit = getLitTiles(gm).length;
    series.push(lit);
    if (!lit) break;
  }
  return series;
};

describe('tile statuses match master', () => {
  const { origin, playerTile, kaijuTile, dirs, maxTicks, statuses } = baseline;

  /*
    Master settled each tile with two opposing passes, which trimmed a little off a status at random,
    and picked a random count for each vine of 'isWooded'. Those shapes are matched closely, not exactly.
    'isWet' keeps the reversing wave added in the refactor.
  */
  const CLEAR_TOLERANCE = { isWet: 3, isElectrified: 2, isCold: 2, isOnFire: 2, isOnKaijuFire: 2, isBubble: 1, isGhosted: 1, isHealing: 1 };
  // the peninsula now has more tiles at the bottom than master's, so walls can run wider there
  const PEAK_TOLERANCE = { isElectrified: 1.4, isWooded: 1.8, isOnFire: 1.6, isOnKaijuFire: 1.6 };
  const OPENING_TICKS = { isOnFire: 6, isOnKaijuFire: 6, isCold: 5, isShielded: 5, isGhosted: 8, isHealing: 8 };

  Object.entries(statuses).forEach(([status, { clearsAfterTicks, peakTiles, dirs: castDirs, example }]: [string, any]) => {
    it(`${status} lasts as long and spreads as far as on master`, () => {
      const { gm } = makeGame({ playerTile, kaijuTile });
      putStatusOnTile(gm, status, origin, { dirs: [...(castDirs ?? dirs)] });
      const series = runUntilClear(gm, maxTicks);

      if (status == 'isWooded') {
        // overgrowth fades on purpose: master's vines stayed forever
      } else if (clearsAfterTicks === null) {
        expect(series[series.length - 1]).toBeGreaterThan(0); // persistent statuses stay
      } else {
        expect(Math.abs(series.length - 1 - clearsAfterTicks)).toBeLessThanOrEqual(CLEAR_TOLERANCE[status] ?? 0);
      }
      expect(Math.max(...series)).toBeLessThanOrEqual(Math.ceil(peakTiles * (PEAK_TOLERANCE[status] ?? 1.25)) + 2);
      const openingTicks = OPENING_TICKS[status] ?? 0;
      expect(series.slice(0, openingTicks)).toEqual(example.slice(0, openingTicks));
    });
  });
});

describe('walls of fire', () => {
  const getWallDirs = i => [TILE_DIRS[i], TILE_DIRS[(i + 5) % 6], TILE_DIRS[(i + 1) % 6]];

  TILE_DIRS.forEach((dir, i) => {
    it(`stays one wall, with no duplicates, travelling "${dir}"`, () => {
      const { gm } = makeGame({ playerTile: PENINSULA_TILE_LOOKUP_VALS[0] });
      putStatusOnTile(gm, 'isOnFire', CENTER_TILE, { dirs: getWallDirs(i), count: 8 });
      expect(runUntilClear(gm, 3)).toEqual([1, 4, 7, 10]);
    });
  });

  it('is two half-rows deep and widens a column each side, as on master', () => {
    const { gm, board } = makeGame({ playerTile: PENINSULA_TILE_LOOKUP_VALS[0] });
    putStatusOnTile(gm, 'isOnFire', CENTER_TILE, { dirs: getWallDirs(3), count: 8 });
    runUntilClear(gm, 3);
    const front = getLitTiles(gm).filter(t => t.getCurrCount() > 0);
    const halfRows = new Set(front.map(({ tileIndex: { i, j } }) => j * 2 + (i % 2)));
    const columns = new Set(front.map(({ tileIndex: { i } }) => i));
    expect(halfRows.size).toBe(2);
    expect(columns.size).toBe(7);
    expect(board.getTilesInFlatArray().length).toBeGreaterThan(0);
  });

  it('holds together when it is wider, with the range passive', () => {
    const { gm } = makeGame({ playerTile: PENINSULA_TILE_LOOKUP_VALS[0] });
    putStatusOnTile(gm, 'isOnFire', CENTER_TILE, { dirs: getWallDirs(3), count: 9 });
    runUntilClear(gm, 2);
    const { i, j } = CENTER_TILE;
    const wall = getLitTiles(gm).filter(t => t.getCurrCount() > 0).map(t => t.tileIndex);
    expect(wall).toContainEqual({ i, j: j + 1 }); // no gap in the middle: the wall has no prongs
  });
});

describe('water', () => {
  const dirs = ['down', 'down left', 'down right'];
  const start = { i: 10, j: 12 };
  const startRow = start.j * 2;
  // (tiles that have bounced off the coast are no longer part of the wall)
  const getFrontRows = gm => getLitTiles(gm).filter(t => t.getCurrCount() > 0 && t.wall !== false).map(({ tileIndex: { i, j } }) => j * 2 + (i % 2));
  const average = values => values.reduce((a, b) => a + b, 0) / values.length;

  it('recedes, then pours forward past where it started, always as a wall', () => {
    const { gm, board } = makeGame({ playerTile: PENINSULA_TILE_LOOKUP_VALS[0] });
    putStatusOnTile(gm, 'isWet', start, { dirs: [...dirs] });
    const rows = [];
    for (let tick = 1; tick <= 14; tick++) {
      board.updateTileState(tick);
      rows.push(average(getFrontRows(gm)));
      expect(new Set(getFrontRows(gm)).size).toBeLessThanOrEqual(2);
    }
    expect(rows[4]).toBeLessThan(startRow);
    expect(rows[4]).toBeLessThan(rows[0]);
    expect(rows[13]).toBeGreaterThan(rows[5]);
    expect(rows[13]).toBeGreaterThan(startRow);
  });
});

describe('overgrowth', () => {
  const start = { i: 10, j: 12 };

  it('has one vine that goes on hunting, and short side branches', () => {
    const { gm, board } = makeGame({ playerTile: PENINSULA_TILE_LOOKUP_VALS[0], kaijuTile: { i: 14, j: 26 } });
    putStatusOnTile(gm, 'isWooded', start, { dirs: [...TILE_DIRS] });
    for (let tick = 1; tick <= 12; tick++) board.updateTileState(tick);
    expect(getLitTiles(gm).filter(t => t.getCurrCount() > 0).length).toBe(1);
  });

  it('aims its main vine at the target', () => {
    const { board } = makeGame();
    const { i, j } = CENTER_TILE;
    const [, dirs]: Array<any> = board.getNumAdjacentTilesInDirectionFromTileToTile({ fromTileIndex: CENTER_TILE, toTileIndex: { i, j: j + 4 }, numTiles: 6 });
    expect(dirs[0]).toBe('down');
    expect(dirs.length).toBe(6);
  });

  it('fades', () => {
    const { gm, board } = makeGame({ playerTile: PENINSULA_TILE_LOOKUP_VALS[0] });
    putStatusOnTile(gm, 'isWooded', start, { dirs: [...TILE_DIRS] });
    let tick = 1;
    for (; tick <= 80 && (tick < 3 || getLitTiles(gm).length); tick++) board.updateTileState(tick);
    expect(getLitTiles(gm).length).toBe(0);
    expect(tick).toBeGreaterThan(25);
  });

  it('carries on straight with nothing to chase', () => {
    const { gm, board, kaiju } = makeGame({ playerTile: PENINSULA_TILE_LOOKUP_VALS[0] });
    kaiju.isDead = true;
    putStatusOnTile(gm, 'isWooded', start, { dirs: ['down'] });
    for (let tick = 1; tick <= 6; tick++) board.updateTileState(tick);
    const moving = getLitTiles(gm).filter(t => t.getCurrCount() > 0);
    expect(moving[0].tileIndex).toEqual({ i: start.i, j: start.j + 6 });
  });
});

describe('statuses at the edge of the map', () => {
  it('always clear after bouncing, wherever they leave the board', () => {
    const { board } = makeGame();
    const tileKeys = new Set(PENINSULA_TILE_LOOKUP_VALS.map(({ i, j }) => `${i} ${j}`));
    let launches = 0;
    PENINSULA_TILE_LOOKUP_VALS.forEach(tile => {
      TILE_DIRS.forEach(dir => {
        const offset = board.getTileOffsetFromDir(dir, tile);
        if (tileKeys.has(`${tile.i + offset.i} ${tile.j + offset.j}`)) return;
        launches++;
        const { gm } = makeGame();
        putStatusOnTile(gm, 'isOnFire', tile, { dirs: [dir], count: 12 });
        const series = runUntilClear(gm, 60);
        expect(series[series.length - 1]).toBe(0);
      });
    });
    expect(launches).toBeGreaterThan(100);
  });

  it('reflects onto a neighboring tile, not back onto its own tile', () => {
    const { board, gm, settingsManager } = makeGame();
    const { isOnFire } = settingsManager.getAbilityAndTileStatusData();
    const tileKeys = new Set(PENINSULA_TILE_LOOKUP_VALS.map(({ i, j }) => `${i} ${j}`));
    const getIsOnBoard = (tile, dir) => {
      const offset = board.getTileOffsetFromDir(dir, tile);
      return tileKeys.has(`${tile.i + offset.i} ${tile.j + offset.j}`);
    };
    const edge = PENINSULA_TILE_LOOKUP_VALS.slice(40).flatMap(tile => TILE_DIRS.map(dir => ({ tile, dir })))
      .find(({ tile, dir }) => !getIsOnBoard(tile, dir) && getIsOnBoard(tile, isOnFire.reflectDir(dir)[0]));
    putStatusOnTile(gm, 'isOnFire', edge.tile, { dirs: [edge.dir], count: 12 });
    board.updateTileState(1);
    const movedAway = getLitTiles(gm).some(t => t.tileIndex.i != edge.tile.i || t.tileIndex.j != edge.tile.j);
    expect(movedAway).toBe(true);
  });
});

describe('tile hierarchy', () => {
  it('keeps master\'s order', () => {
    const order = ['isTeleportTile', 'isHealing', 'isBubble', 'isGhosted', 'isElectrified', 'isCold', 'isShielded', 'isOnFire', 'isWet', 'isWooded'];
    order.slice(1).forEach((status, i) => expect(TILE_STATUS_RANKS[status]).toBeGreaterThan(TILE_STATUS_RANKS[order[i]]));
    expect(TILE_STATUS_RANKS.isOnFire).toBe(TILE_STATUS_RANKS.isOnKaijuFire);
  });

  it('settles a tile with the higher-ranked status: fire beats water', () => {
    const { gm, board } = makeGame();
    const { i, j } = CENTER_TILE;
    // fire and water arrive on the same tile
    putStatusOnTile(gm, 'isOnFire', { i, j: j - 1 }, { dirs: ['down'], count: 1 });
    putStatusOnTile(gm, 'isWet', { i, j: j + 1 }, { dirs: ['up'], count: 1 });
    board.updateTileState(1);
    expect(board.tiles[i][j].getAppliedStatus()).toBe('isOnFire');
  });

  it('a weaker ability cannot overwrite a stronger status', () => {
    const { gm, board, settingsManager } = makeGame();
    const { i, j } = CENTER_TILE;
    putStatusOnTile(gm, 'isShielded', { i, j }, { dirs: [], count: 0 });
    expect(board.tiles[i][j].getCanApplyStatus(settingsManager.getAbilityAndTileStatusData().isOnFire)).toBe(false);
    expect(board.tiles[i][j].getCanApplyStatus(settingsManager.getAbilityAndTileStatusData().isCold)).toBe(true);
  });

  it('bubble destroys a ghost on contact, the skyscraper boss counter', () => {
    const { gm, board } = makeGame();
    const { i, j } = CENTER_TILE;
    putStatusOnTile(gm, 'isGhosted', { i, j: j - 1 }, { dirs: ['down'], count: 5 });
    putStatusOnTile(gm, 'isBubble', { i, j: j + 1 }, { dirs: ['up'], count: 5 });
    board.updateTileState(1);
    expect(board.tiles[i][j].getAppliedStatus()).toBe('isBubble');
  });
});

describe('pieces cannot slip past statuses', () => {
  // a wall of fire across the Kaiju's path, tested at every timing offset between the two tick speeds
  it('a Kaiju walking through fire is always hit', () => {
    for (let offsetMs = 0; offsetMs < 160; offsetMs += 10) {
      const { i, j } = CENTER_TILE;
      const { gm, kaiju } = makeGame({ playerTile: PENINSULA_TILE_LOOKUP_VALS[0], kaijuTile: { i, j: j - 3 } });
      // this Kaiju only follows the path below
      kaiju.moveWithEnemy = () => { };
      kaiju.followLeader = () => { };
      kaiju.useAbilities = () => { };
      kaiju.moveToTiles = [{ i, j: j - 2 }, { i, j: j - 1 }, { i, j }, { i, j: j + 1 }, { i, j: j + 2 }];
      kaiju.isThere = true;
      const lives = kaiju.lives;
      // the fire lasts only as long as the Kaiju takes to cross it
      putStatusOnTile(gm, 'isOnFire', { i, j }, { dirs: ['up', 'up left', 'up right'], count: 3 });

      let elapsedMs = offsetMs;
      for (let ms = 0; ms < 3000; ms += 10) {
        elapsedMs += 10;
        if (ms % 110 == 0) { gm.accTime += 110; kaiju.movePiece({ accTime: gm.accTime }); }
        if (elapsedMs % 160 == 0) gm.stepTiles();
      }
      expect(kaiju.lives).toBeLessThan(lives);
    }
  });

  it('a piece and a status trading tiles still collide', () => {
    const { i, j } = CENTER_TILE;
    const { gm, kaiju } = makeGame({ playerTile: PENINSULA_TILE_LOOKUP_VALS[0], kaijuTile: { i, j } });
    const lives = kaiju.lives;
    putStatusOnTile(gm, 'isOnFire', { i, j: j + 1 }, { dirs: ['up'], count: 3 });

    // the Kaiju steps to where the fire was, and the fire steps to where the Kaiju was
    kaiju.setTileIndex({ i, j: j + 1 });
    gm.accTime = 1000;
    gm.stepTiles();
    expect(kaiju.lives).toBe(lives - 1);
  });
});

describe('tile highlights', () => {
  it('shows the path to the hovered tile', () => {
    const { i, j } = CENTER_TILE;
    const { gm, board } = makeGame();
    board.setHoveredTileIndex({ i, j: j + 3 });
    board.updateTileState(1);
    expect(gm.getTiles().filter(t => t.getIsHighlighted()).length).toBe(3);
  });

  it('a player on a tile clears a persistent status from it', () => {
    const { i, j } = CENTER_TILE;
    const { gm, board, player } = makeGame();
    putStatusOnTile(gm, 'isWooded', { i, j: j + 1 }, { dirs: [], count: 0 });
    board.updateTileState(1);
    expect(board.tiles[i][j + 1].getAppliedStatus()).toBe('isWooded');
    placePiece(gm, player, { i, j: j + 1 });
    board.updateTileState(2);
    expect(board.tiles[i][j + 1].getAppliedStatus()).toBe('');
  });
});
