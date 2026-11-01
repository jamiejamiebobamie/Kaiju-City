import { LEVELS } from 'Game/DataClasses/Levels/levels';
import type { LevelConfig } from 'Game/DataClasses/Levels/levels';
import master from './__fixtures__/masterPeninsulaTiles.json';

/*
  For tests: Peninsula exactly as it was on master, in master's own numbers.
  The real level is in DataClasses/Levels/data/peninsula.json, and can be edited without changing these tests.
*/
export const MASTER_PENINSULA_TILES = master.tiles;

export const MASTER_PENINSULA: LevelConfig = {
  ...LEVELS.peninsula,
  world: { width: 450, height: 720 },
  contentOffset: { x: -5, y: -30 },
  pieceScale: 1,
  moveSpeedScale: 1,
  grid: {
    columns: 24,
    rows: 36,
    scale: 0.27,
    colStep: 70,
    rowStep: 80,
    originX: -25,
    originY: 0,
    centerX: 80.4,
    centerY: 70.4,
    charOffsetX: 52.5,
    charOffsetY: 42.5
  },
  walkableTiles: [...master.tiles, ...master.bottomTiles],
  tileSets: undefined,
  kaijuEntry: {
    perimeterTiles: master.perimeterTiles,
    bounds: { minX: 0, minY: 30, maxX: 490, maxY: 800 }
  }
};
