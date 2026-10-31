import { useRef, useState } from "react";
import { getHexRadius, getTileCenter, getTileIndexAtLocation } from "Game/DataClasses/GameBoard/hexGrid";
import { rescaleLevelTiles } from "./levelScale";

/*
  Painting a level's tiles, for both level editors: /level-editor and 'Edit tiles' in the game.
  Click or drag to add tiles. Starting on a selected tile removes tiles instead.
  In 'links', click two tiles to link them. Click a linked tile to remove its link.
  Each tile set is the walkable tiles of one phase of a level, eg. 'train' and 'noTrain'.
*/
export const LINKS_MODE = "links";
const EDITOR_COLOR = "#57E931";
const LINK_COLOR = "#c9a6ff";
const MARKER_SETS = ["spawn", "goal", "kaijuEntry", LINKS_MODE]; // these are placed on top of the walkable tiles

export const getKey = ({ i, j }) => `${i} ${j}`;

// the grid always covers the whole scene
export const withFittedGrid = level => {
  const { sceneWidth, sceneHeight, grid } = level;
  return {
    ...level,
    grid: {
      ...grid,
      columns: Math.ceil((sceneWidth - grid.originX) / grid.colStep) + 1,
      rows: Math.ceil((sceneHeight - grid.originY) / grid.rowStep) + 1
    }
  };
};

const traceHexagon = (ctx, { x, y }, radius) => {
  ctx.beginPath();
  for (let corner = 0; corner < 6; corner++) {
    const angle = (Math.PI / 3) * corner;
    ctx.lineTo(x + radius * Math.cos(angle), y + radius * Math.sin(angle));
  }
  ctx.closePath();
};

export const drawTileSet = (ctx, level, tileSetName, linkStart) => {
  const { grid, tileSets, tileLinks = [] } = level;
  const radius = getHexRadius(grid);
  const walkable = new Set((tileSets[tileSetName] || []).map(getKey));
  const underMarkers = new Set(MARKER_SETS.includes(tileSetName) ? Object.values(tileSets)[0].map(getKey) : []);

  for (let i = 0; i < grid.columns; i++) {
    for (let j = 0; j < grid.rows; j++) {
      const isWalkable = walkable.has(getKey({ i, j }));
      const isUnderMarker = !isWalkable && underMarkers.has(getKey({ i, j }));
      traceHexagon(ctx, getTileCenter(grid, { i, j }), radius);
      ctx.fillStyle = isUnderMarker ? "white" : EDITOR_COLOR;
      ctx.strokeStyle = isWalkable ? EDITOR_COLOR : "white";
      ctx.globalAlpha = isWalkable ? 0.35 : isUnderMarker ? 0.15 : 0;
      ctx.fill();
      ctx.globalAlpha = isWalkable ? 0.9 : 0.15;
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;

  // each pair of linked tiles, joined by a line
  ctx.strokeStyle = LINK_COLOR;
  ctx.fillStyle = LINK_COLOR;
  ctx.lineWidth = 3;
  const fillTile = tile => {
    traceHexagon(ctx, getTileCenter(grid, tile), radius);
    ctx.fill();
  };
  tileLinks.forEach(([a, b]) => {
    fillTile(a);
    fillTile(b);
    const start = getTileCenter(grid, a);
    const end = getTileCenter(grid, b);
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();
  });
  if (linkStart) fillTile(linkStart);
};

export const useLevelEditing = getStartingLevel => {
  const [level, setLevel] = useState(getStartingLevel);
  const [tileSetName, setTileSetName] = useState(Object.keys(level.tileSets)[0]);
  const [saveMessage, setSaveMessage] = useState("");
  const [tileScale, setTileScale] = useState(100);
  const [linkStart, setLinkStart] = useState(undefined);
  const scaleBase = useRef(undefined); // the level as it was before the slider moved
  const isPainting = useRef(false);
  const isRemoving = useRef(false);
  const lastTileKey = useRef(undefined);

  const { grid, sceneWidth, sceneHeight } = level;
  const tiles = level.tileSets[tileSetName] || [];
  const isLinksMode = tileSetName == LINKS_MODE;
  const tileLinks = level.tileLinks || [];

  const keepTileScale = () => {
    scaleBase.current = undefined;
    setTileScale(100);
  };

  const changeTileScale = percent => {
    scaleBase.current = scaleBase.current || level;
    setTileScale(percent);
    setLevel(rescaleLevelTiles(scaleBase.current, percent / 100));
  };

  const openLevel = nextLevel => {
    keepTileScale();
    setLevel(nextLevel);
    setTileSetName(Object.keys(nextLevel.tileSets)[0]);
    setLinkStart(undefined);
    setSaveMessage("");
  };

  // says whether it worked
  const saveToGame = async () => {
    keepTileScale();
    const response = await fetch("/__level-editor/save", { method: "POST", body: JSON.stringify(level) });
    setSaveMessage(response.ok ? "Saved to the game." : "Could not save: is this a game level?");
    return response.ok;
  };

  const getTileFromEvent = (e, canvas) => {
    const rect = canvas.getBoundingClientRect();
    return getTileIndexAtLocation(grid, {
      x: ((e.clientX - rect.left) * sceneWidth) / rect.width,
      y: ((e.clientY - rect.top) * sceneHeight) / rect.height
    });
  };

  const setTile = tile => {
    keepTileScale();
    lastTileKey.current = getKey(tile);
    setLevel(l => {
      const others = (l.tileSets[tileSetName] || []).filter(t => getKey(t) != getKey(tile));
      const next = isRemoving.current ? others : [...others, tile];
      return { ...l, tileSets: { ...l.tileSets, [tileSetName]: next } };
    });
  };

  const updateLinks = tile => {
    keepTileScale();
    const hasTile = link => link.some(t => getKey(t) == getKey(tile));
    if (tileLinks.some(hasTile)) {
      setLevel(l => ({ ...l, tileLinks: l.tileLinks.filter(link => !hasTile(link)) }));
    } else if (!linkStart) {
      setLinkStart(tile);
    } else if (getKey(linkStart) == getKey(tile)) {
      setLinkStart(undefined);
    } else {
      setLevel(l => ({ ...l, tileLinks: [...(l.tileLinks || []), [linkStart, tile]] }));
      setLinkStart(undefined);
    }
  };

  const startPainting = e => {
    const tile = getTileFromEvent(e, e.currentTarget);
    if (!tile) return;
    if (isLinksMode) {
      updateLinks(tile);
      return;
    }
    isPainting.current = true;
    isRemoving.current = tiles.some(t => getKey(t) == getKey(tile));
    setTile(tile);
  };

  const continuePainting = e => {
    if (!isPainting.current) return;
    const tile = getTileFromEvent(e, e.currentTarget);
    if (tile && getKey(tile) != lastTileKey.current) setTile(tile);
  };

  const stopPainting = () => {
    isPainting.current = false;
  };

  const addTileSet = () => {
    const name = window.prompt("Name of the new tile set:");
    if (!name) return;
    setLevel(l => ({ ...l, tileSets: { ...l.tileSets, [name]: [...tiles] } }));
    setTileSetName(name);
  };

  const statusText = isLinksMode
    ? `${tileLinks.length} links. ${linkStart ? "Now click the tile to link it to." : "Click a tile, then its partner. Click a linked tile to unlink it."}`
    : `${grid.columns} x ${grid.rows} grid. ${tiles.length} tiles. Click or drag to add. Start on a tile to remove.`;

  return {
    level,
    setLevel,
    tileSetName,
    setTileSetName,
    linkStart,
    saveMessage,
    tileScale,
    changeTileScale,
    openLevel,
    saveToGame,
    addTileSet,
    startPainting,
    continuePainting,
    stopPainting,
    statusText
  };
};
