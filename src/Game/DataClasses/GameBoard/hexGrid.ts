export type HexGrid = {
  columns: number;
  rows: number;
  scale: number; // world pixels per grid unit
  colStep: number; // grid units between columns
  rowStep: number; // grid units between rows
  originX: number; // location of tile { i: 0, j: 0 }, in grid units
  originY: number;
  centerX: number; // from a tile's location to its center, in grid units
  centerY: number;
  charOffsetX: number; // from a tile's location to where a piece stands, in grid units
  charOffsetY: number;
};

type TileIndex = { i: number; j: number };

export const getTileXAndY = (grid: HexGrid, { i, j }: TileIndex) => ({
  x: (grid.originX + i * grid.colStep) * grid.scale,
  y: (grid.originY + (i % 2 ? j * grid.rowStep + grid.rowStep / 2 : j * grid.rowStep)) * grid.scale
});

export const getTileCenter = (grid: HexGrid, tileIndex: TileIndex) => {
  const { x, y } = getTileXAndY(grid, tileIndex);
  return { x: x + grid.centerX * grid.scale, y: y + grid.centerY * grid.scale };
};

// the neighbor across each edge of a tile. edge n runs from corner n to corner n + 1, clockwise from the right-hand corner.
const getEdgeNeighbors = ({ i, j }: TileIndex) => {
  const lower = i % 2 ? j + 1 : j;
  const upper = lower - 1;
  return [
    { i: i + 1, j: lower },
    { i, j: j + 1 },
    { i: i - 1, j: lower },
    { i: i - 1, j: upper },
    { i, j: j - 1 },
    { i: i + 1, j: upper }
  ];
};

// every edge with a walkable tile on one side only
export const getPerimeterEdges = (tiles: Array<TileIndex>) => {
  const getKey = ({ i, j }: TileIndex) => `${i} ${j}`;
  const keys = new Set(tiles.map(getKey));
  return tiles.flatMap(tile => getEdgeNeighbors(tile)
    .map((neighbor, edge) => ({ tile, edge, isOpen: !keys.has(getKey(neighbor)) }))
    .filter(({ isOpen }) => isOpen)
    .map(({ tile, edge }) => ({ tile, edge })));
};

export const getCharXAndY = (grid: HexGrid, tileIndex: TileIndex) => {
  const { x, y } = getTileXAndY(grid, tileIndex);
  return { x: x + grid.charOffsetX * grid.scale, y: y + grid.charOffsetY * grid.scale };
};

// flat-topped hexagons fit their columns when a hexagon is 4/3 of a column wide
export const getHexRadius = (grid: HexGrid) => (grid.colStep * grid.scale * 2) / 3;

// the tile whose center is closest to a location in the world
export const getTileIndexAtLocation = (grid: HexGrid, { x, y }: { x: number; y: number }) => {
  const approxI = Math.round((x / grid.scale - grid.originX - grid.centerX) / grid.colStep);
  const approxJ = Math.round((y / grid.scale - grid.originY - grid.centerY) / grid.rowStep);
  let closest: TileIndex | undefined;
  let closestDistance = Number.MAX_SAFE_INTEGER;
  for (let i = approxI - 1; i <= approxI + 1; i++) {
    for (let j = approxJ - 1; j <= approxJ + 1; j++) {
      if (i < 0 || j < 0 || i >= grid.columns || j >= grid.rows) continue;
      const center = getTileCenter(grid, { i, j });
      const distance = (center.x - x) ** 2 + (center.y - y) ** 2;
      if (distance < closestDistance) {
        closestDistance = distance;
        closest = { i, j };
      }
    }
  }
  return closest;
};
