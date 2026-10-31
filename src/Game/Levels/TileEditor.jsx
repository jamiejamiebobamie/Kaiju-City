import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import styled from "styled-components";
import { LEVEL_FILES } from "./levels";
import { drawTileSet, LINKS_MODE, useLevelEditing, withFittedGrid } from "./useLevelEditing";

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
  gap: 0.5cqw;
`;

const Status = styled.span`
  max-width: 22cqw;
  font-family: sans-serif;
  font-size: 0.9cqw;
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

export const TileEditor = ({ levelId, playWindow, onSaved, onCancel, onMovePanel }) => {
  const editing = useLevelEditing(() => withFittedGrid(LEVEL_FILES[levelId]));
  const { level, tileSetName, linkStart } = editing;
  const canvasRef = useRef(null);
  const [world, setWorld] = useState(null);
  const canvasWidth = level.sceneWidth * CANVAS_PIXEL_RATIO;
  const canvasHeight = level.sceneHeight * CANVAS_PIXEL_RATIO;

  useEffect(() => setWorld(document.querySelector("[data-game-world]")), []);

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
      {world && createPortal(
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
          {Object.keys(level.tileSets).map(name => <option key={name}>{name}</option>)}
          <option>{LINKS_MODE}</option>
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
      <button onClick={onMovePanel}>Move this panel</button>
    </>
  );
};
