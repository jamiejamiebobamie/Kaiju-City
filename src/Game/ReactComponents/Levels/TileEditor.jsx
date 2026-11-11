import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import styled from "styled-components";
import { LEVEL_FILES } from "../../DataClasses/Levels/levels";
import { drawTileSet, getKey, LINKS_MODE, useLevelEditing, withFittedGrid } from "./useLevelEditing";
import { getHexRadius, getTileCenter } from "Game/DataClasses/GameBoard/hexGrid";
import { getRadarPlacement, RadarMap } from "../RadarMap";

/*
  Dev-only 'Edit tiles' in the game: the same painting as /level-editor, on top of the live scene.
  The game holds still and shows the whole level. Saving restarts the level on the new tiles.
*/
const CANVAS_PIXEL_RATIO = 2; // the scene gets enlarged, so the grid stays sharp
const VIEW_GUIDE_COLOR = "#ffd24a";
const VIEW_GUIDE_WIDTH = 3;

const PaintCanvas = styled.canvas`
  position: absolute;
  left: 0;
  top: 0;
  z-index: 2147483000;
  cursor: crosshair;
  touch-action: none;
`;

const Control = styled.label`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 6px;
`;

const Status = styled.span`
  font-family: sans-serif;
  font-size: 11px;
  line-height: 1.3;
`;

// the box the player sees at this camera zoom, in the middle of the scene
const drawViewGuide = (ctx, { sceneWidth, sceneHeight, cameraZoom = 1 }, playWindow, frame) => {
  const fitZoom = Math.min(frame.width / sceneWidth, frame.height / sceneHeight);
  const width = (frame.width * (playWindow.right - playWindow.left)) / (fitZoom * cameraZoom);
  const height = (frame.height * (playWindow.bottom - playWindow.top)) / (fitZoom * cameraZoom);
  ctx.strokeStyle = VIEW_GUIDE_COLOR;
  ctx.lineWidth = VIEW_GUIDE_WIDTH;
  ctx.setLineDash([12, 8]);
  ctx.strokeRect((sceneWidth - width) / 2, (sceneHeight - height) / 2, width, height);
  ctx.setLineDash([]);
};

/*
  The radar's land beyond the map (Jamie, G13): the Peninsula only. Painted in the radar's own view, the grid carried on
  past the map's edges, the map under it and the radar over it at half strength, its outline drawn from what's painted.
*/
export const RADAR_MODE = "radar";
const NO_TILES = [];
const RADAR_EDIT = { radarOpacity: 0.5, mapOpacity: 0.55, color: "#57E931" };

const RadarLayer = styled.div`
  position: absolute;
  inset: 0;
  z-index: 2147483000;
  background: #020805;
  overflow: hidden;
`;
const RadarScene = styled.img`
  position: absolute;
  pointer-events: none;
  opacity: ${RADAR_EDIT.mapOpacity};
`;
const HalfRadar = styled(RadarMap)`
  opacity: ${RADAR_EDIT.radarOpacity};
  z-index: 1;
  pointer-events: none;
`;
const RadarPaint = styled.canvas`
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  z-index: 2;
  cursor: crosshair;
  touch-action: none;
`;

// the tile nearest a point, anywhere: past the map's edges too (i and j can go below 0)
const getAnyTileAt = (grid, { x, y }) => {
  const approxI = Math.round((x / grid.scale - grid.originX - grid.centerX) / grid.colStep);
  const approxJ = Math.round((y / grid.scale - grid.originY - grid.centerY) / grid.rowStep);
  let closest;
  let best = Infinity;
  for (let i = approxI - 1; i <= approxI + 1; i++) {
    for (let j = approxJ - 1; j <= approxJ + 1; j++) {
      const center = getTileCenter(grid, { i, j });
      const distance = (center.x - x) ** 2 + (center.y - y) ** 2;
      if (distance < best) {
        best = distance;
        closest = { i, j };
      }
    }
  }
  return closest;
};

const RadarEditor = ({ level, editing }) => {
  const canvasRef = useRef(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const radarTiles = level.tileSets[RADAR_MODE] || NO_TILES;
  const mapKeys = new Set((Object.values(level.tileSets)[0] || []).map(getKey));

  useEffect(() => {
    const canvas = canvasRef.current;
    const measure = () => setSize({ width: canvas.clientWidth, height: canvas.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);

  const { scale, left, top } = getRadarPlacement(size.width || 1, size.height || 1);
  const toMap = e => {
    const rect = canvasRef.current.getBoundingClientRect();
    return getAnyTileAt(level.grid, { x: (e.clientX - rect.left - left) / scale, y: (e.clientY - rect.top - top) / scale });
  };

  // the grid over the whole screen, the map's own tiles faint, the painted ones filled
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !size.width) return;
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.round(size.width * ratio);
    canvas.height = Math.round(size.height * ratio);
    const ctx = canvas.getContext("2d");
    ctx.setTransform(ratio * scale, 0, 0, ratio * scale, ratio * left, ratio * top);
    const { grid } = level;
    const radius = getHexRadius(grid);
    const painted = new Set(radarTiles.map(getKey));
    const corner = tile => getAnyTileAt(grid, tile);
    const from = corner({ x: -left / scale, y: -top / scale });
    const to = corner({ x: (size.width - left) / scale, y: (size.height - top) / scale });
    ctx.lineWidth = 1 / scale;
    for (let i = from.i - 1; i <= to.i + 1; i++) {
      for (let j = from.j - 1; j <= to.j + 1; j++) {
        const key = getKey({ i, j });
        const { x, y } = getTileCenter(grid, { i, j });
        ctx.beginPath();
        for (let k = 0; k < 6; k++) ctx.lineTo(x + radius * Math.cos((Math.PI / 3) * k), y + radius * Math.sin((Math.PI / 3) * k));
        ctx.closePath();
        if (painted.has(key)) {
          ctx.globalAlpha = 0.4;
          ctx.fillStyle = RADAR_EDIT.color;
          ctx.fill();
        }
        ctx.globalAlpha = painted.has(key) ? 0.9 : mapKeys.has(key) ? 0.35 : 0.12;
        ctx.strokeStyle = painted.has(key) ? RADAR_EDIT.color : "white";
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  }, [size, radarTiles, level]);

  return (
    <RadarLayer>
      <RadarScene src={level.sceneSrc} style={{ left, top, width: level.sceneWidth * scale, height: level.sceneHeight * scale }} />
      <HalfRadar radarTiles={radarTiles} />
      <RadarPaint
        ref={canvasRef}
        onPointerDown={e => editing.startPaintingAt(toMap(e))}
        onPointerMove={e => editing.continuePaintingAt(toMap(e))}
        onPointerUp={editing.stopPainting}
        onPointerLeave={editing.stopPainting}
      />
    </RadarLayer>
  );
};

export const TileEditor = ({ levelId, playWindow, onSaved, onCancel }) => {
  const editing = useLevelEditing(() => withFittedGrid(LEVEL_FILES[levelId]));
  const { level, tileSetName, linkStart } = editing;
  const canvasRef = useRef(null);
  const [world, setWorld] = useState(null);
  const canvasWidth = level.sceneWidth * CANVAS_PIXEL_RATIO;
  const canvasHeight = level.sceneHeight * CANVAS_PIXEL_RATIO;

  const isRadar = tileSetName == RADAR_MODE;
  const [screen, setScreen] = useState(null);
  useEffect(() => setWorld(document.querySelector("[data-game-world]")), []);
  useEffect(() => setScreen(document.querySelector("[data-play-screen]") || document.querySelector("[data-game-frame]")), []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.setTransform(CANVAS_PIXEL_RATIO, 0, 0, CANVAS_PIXEL_RATIO, 0, 0);
    ctx.clearRect(0, 0, level.sceneWidth, level.sceneHeight);
    drawTileSet(ctx, level, tileSetName, linkStart);
    drawViewGuide(ctx, level, playWindow, canvas.closest("[data-game-frame]").getBoundingClientRect());
  }, [level, tileSetName, linkStart, world, playWindow]);

  const saveAndPlay = async () => {
    if (await editing.saveToGame()) onSaved(level);
  };

  return (
    <>
      {isRadar && screen && createPortal(<RadarEditor level={level} editing={editing} />, screen)}
      {world && !isRadar && createPortal(
        <PaintCanvas
          ref={canvasRef}
          width={canvasWidth}
          height={canvasHeight}
          style={{ width: `${level.sceneWidth}px`, height: `${level.sceneHeight}px` }}
          onPointerDown={editing.startPainting}
          onPointerMove={editing.continuePainting}
          onPointerUp={editing.stopPainting}
          onPointerLeave={editing.stopPainting}
        />,
        world
      )}
      <Control>Tile set
        <select value={tileSetName} onChange={e => editing.setTileSetName(e.target.value)}>
          {Object.keys(level.tileSets).filter(name => name != RADAR_MODE).map(name => <option key={name}>{name}</option>)}
          <option>{LINKS_MODE}</option>
          {levelId == "peninsula" && <option value={RADAR_MODE}>radar (land beyond the map)</option>}
        </select>
      </Control>
      <button onClick={editing.addTileSet}>Copy to new tile set</button>
      <Control>Tile scale {editing.tileScale}%
        <input type="range" min="50" max="300" step="5" value={editing.tileScale} onChange={e => editing.changeTileScale(Number(e.target.value))} />
      </Control>
      <Control>Camera zoom {(level.cameraZoom || 1).toFixed(2)}x
        <input
          type="range"
          aria-label="Camera zoom"
          min="1"
          max="3"
          step="0.01"
          value={level.cameraZoom || 1}
          onChange={e => editing.setLevel(l => ({ ...l, cameraZoom: Number(e.target.value) }))}
        />
      </Control>
      <Status>{editing.statusText} The dashed box is what the player sees.</Status>
      {editing.saveMessage && <Status>{editing.saveMessage}</Status>}
      <button onClick={saveAndPlay}>Save and play</button>
      <button onClick={onCancel}>Cancel</button>
    </>
  );
};
