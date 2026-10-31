import { getTileCenter, getTileIndexAtLocation } from 'Game/DataClasses/GameBoard/hexGrid';

type TileIndex = { i: number; j: number };

const getKey = ({ i, j }: TileIndex) => `${i} ${j}`;
const roundTo2 = (value: number) => Math.round(value * 100) / 100;

/*
  Resizes a level's tiles and keeps the area they cover: the new tiles are the ones
  sitting on the old tiles. Spawn, goal, Kaiju entry and linked tiles move to the closest walkable tile.
*/
export const rescaleLevelTiles = (level, factor: number) => {
  const oldGrid = level.grid;
  const colStep = roundTo2(oldGrid.colStep * factor);
  const rowStep = roundTo2(oldGrid.rowStep * factor);
  const grid = {
    ...oldGrid,
    colStep,
    rowStep,
    columns: Math.ceil((level.sceneWidth - oldGrid.originX) / colStep) + 1,
    rows: Math.ceil((level.sceneHeight - oldGrid.originY) / rowStep) + 1
  };

  const allTiles: Array<TileIndex> = [];
  for (let i = 0; i < grid.columns; i++) {
    for (let j = 0; j < grid.rows; j++) allTiles.push({ i, j });
  }

  const { spawn = [], goal = [], kaijuEntry, ...walkableSets } = level.tileSets;
  const tileSets = Object.fromEntries(Object.entries(walkableSets).map(([name, tiles]: [string, Array<TileIndex>]) => {
    const oldKeys = new Set(tiles.map(getKey));
    return [name, allTiles.filter(tile => {
      const oldTile = getTileIndexAtLocation(oldGrid, getTileCenter(grid, tile));
      return !!oldTile && oldKeys.has(getKey(oldTile));
    })];
  }));

  const mainTiles = Object.values(tileSets)[0] as Array<TileIndex>;
  const snap = (tile: TileIndex) => {
    const { x, y } = getTileCenter(oldGrid, tile);
    const getDistance = (other: TileIndex) => {
      const center = getTileCenter(grid, other);
      return (center.x - x) ** 2 + (center.y - y) ** 2;
    };
    return mainTiles.reduce((closest, other) => getDistance(other) < getDistance(closest) ? other : closest);
  };
  const snapAll = (tiles: Array<TileIndex>) => [...new Map(tiles.map(snap).map(tile => [getKey(tile), tile])).values()];

  return {
    ...level,
    grid,
    tileSets: { ...tileSets, ...(kaijuEntry ? { kaijuEntry: snapAll(kaijuEntry) } : {}), spawn: snapAll(spawn), goal: snapAll(goal) },
    tileLinks: (level.tileLinks || []).map(([a, b]) => [snap(a), snap(b)])
  };
};
