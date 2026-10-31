import { getDistanceToFrom } from 'Game/utils';

type TileIndex = { i: number; j: number };
type Point = { x: number; y: number };

type FindPathProps = {
  start: TileIndex;
  goal: TileIndex;
  getAdjacentTiles: (tile: TileIndex) => Array<TileIndex>;
  getLocation: (tile: TileIndex) => Point;
  getIsBlocked?: (tile: TileIndex) => boolean;
  getExtraCost?: (tile: TileIndex) => number; // extra cost of entering a tile, in tiles
};

const getKey = ({ i, j }: TileIndex) => `${i} ${j}`;

/*
    A* over the hexagon tiles.
    Returns the path from 'start' to 'goal', without 'start'. Empty if 'goal' cannot be reached.
*/
export const findPath = ({
  start,
  goal,
  getAdjacentTiles,
  getLocation,
  getIsBlocked = () => false,
  getExtraCost = () => 0
}: FindPathProps): Array<TileIndex> => {
  const startKey = getKey(start);
  const goalKey = getKey(goal);
  if (startKey === goalKey) return [];

  const goalLocation = getLocation(goal);
  const startLocation = getLocation(start);
  const firstNeighbor = getAdjacentTiles(start)[0];
  if (!firstNeighbor) return [];

  // scales the straight-line distance to tiles, so the heuristic never overestimates by much
  const tileWidth = getDistanceToFrom(getLocation(firstNeighbor), startLocation) || 1;
  const getHeuristic = (tile: TileIndex) => getDistanceToFrom(getLocation(tile), goalLocation) / tileWidth;

  const openTiles = new Map<string, TileIndex>([[startKey, start]]);
  const costSoFar = new Map<string, number>([[startKey, 0]]);
  const estimatedCost = new Map<string, number>([[startKey, getHeuristic(start)]]);
  const cameFrom = new Map<string, TileIndex>();

  while (openTiles.size) {
    let currKey = '';
    let currTile: TileIndex | undefined;
    let lowestCost = Number.MAX_SAFE_INTEGER;
    openTiles.forEach((tile, key) => {
      const cost = estimatedCost.get(key) as number;
      if (cost < lowestCost) {
        lowestCost = cost;
        currKey = key;
        currTile = tile;
      }
    });
    if (!currTile) break;

    if (currKey === goalKey) {
      const path: Array<TileIndex> = [];
      let step: TileIndex | undefined = currTile;
      while (step && getKey(step) !== startKey) {
        path.push(step);
        step = cameFrom.get(getKey(step));
      }
      return path.reverse();
    }

    openTiles.delete(currKey);
    const currCost = costSoFar.get(currKey) as number;

    getAdjacentTiles(currTile).forEach(tile => {
      const key = getKey(tile);
      if (key !== goalKey && getIsBlocked(tile)) return;
      const cost = currCost + 1 + getExtraCost(tile);
      if (cost < (costSoFar.get(key) ?? Number.MAX_SAFE_INTEGER)) {
        cameFrom.set(key, currTile as TileIndex);
        costSoFar.set(key, cost);
        estimatedCost.set(key, cost + getHeuristic(tile));
        openTiles.set(key, tile);
      }
    });
  }
  return [];
};
