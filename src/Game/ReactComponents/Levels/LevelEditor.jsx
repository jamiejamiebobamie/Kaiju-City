import React, { useEffect, useRef, useState } from "react";
import styled from "styled-components";
import { LEVEL_FILES as GAME_LEVELS } from "../../DataClasses/Levels/levels";
import { drawTileSet, LINKS_MODE, useLevelEditing, withFittedGrid } from "./useLevelEditing";

/*
  Dev-only tool at /level-editor, for starting a new level: load a scene, then line up the grid.
  To change a level's tiles, 'Edit tiles' in the game does it over the live scene.
*/
const STORAGE_KEY = "kaiju-level-editor";

const DEFAULT_LEVEL = {
  id: "newLevel",
  sceneWidth: 1380,
  sceneHeight: 752,
  grid: {
    columns: 40,
    rows: 19,
    scale: 1,
    colStep: 34.5,
    rowStep: 40,
    originX: 0,
    originY: 0,
    centerX: 0,
    centerY: 0,
    charOffsetX: 0,
    charOffsetY: 0
  },
  tileSets: { base: [] },
  tileLinks: []
};

const GRID_FIELDS = ["colStep", "rowStep", "originX", "originY"];

const Page = styled.div`
  display: flex;
  gap: 16px;
  padding: 16px;
  color: #db974f;
  font-family: sans-serif;
  font-size: 14px;
  align-items: flex-start;
`;

const Panel = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 220px;
  flex-shrink: 0;
`;

const Field = styled.label`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
`;

const Input = styled.input`
  width: 90px;
`;

const Scene = styled.div`
  position: relative;
  overflow: auto;
  max-width: calc(100vw - 280px);
  max-height: calc(100vh - 32px);
`;

const loadSavedLevel = () => {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    return withFittedGrid(saved ? JSON.parse(saved) : DEFAULT_LEVEL);
  } catch {
    return withFittedGrid(DEFAULT_LEVEL);
  }
};

export const LevelEditor = () => {
  const {
    level, setLevel, tileSetName, setTileSetName, linkStart, saveMessage, tileScale, changeTileScale,
    openLevel, saveToGame, addTileSet, startPainting, continuePainting, stopPainting, statusText
  } = useLevelEditing(loadSavedLevel);
  const [sceneImage, setSceneImage] = useState(null);
  const canvasRef = useRef(null);
  const { grid, sceneWidth, sceneHeight } = level;

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(level));
    } catch { /* (not remembered) */ }
  }, [level]);

  useEffect(() => {
    const ctx = canvasRef.current.getContext("2d");
    ctx.clearRect(0, 0, sceneWidth, sceneHeight);
    if (sceneImage) ctx.drawImage(sceneImage, 0, 0, sceneWidth, sceneHeight);
    drawTileSet(ctx, level, tileSetName, linkStart);
  }, [level, tileSetName, sceneImage, linkStart]);

  const openGameLevel = id => {
    const file = GAME_LEVELS[id];
    if (!file) return;
    openLevel(withFittedGrid(file));
    const image = new Image();
    image.onload = () => setSceneImage(image);
    image.src = file.sceneSrc || `/levels/${id}.png`;
  };

  const updateGrid = (field, value) => setLevel(l => withFittedGrid({ ...l, grid: { ...l.grid, [field]: value } }));

  const loadScene = file => {
    if (!file) return;
    const image = new Image();
    image.onload = () => {
      setSceneImage(image);
      setLevel(l => withFittedGrid({ ...l, sceneWidth: image.naturalWidth, sceneHeight: image.naturalHeight }));
    };
    image.src = URL.createObjectURL(file);
  };

  const exportLevel = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(level, null, 2)], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${level.id}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const importLevel = async file => {
    if (!file) return;
    openLevel(withFittedGrid(JSON.parse(await file.text())));
  };

  const resetLevel = () => {
    if (window.confirm("Clear this level's grid and tiles?")) {
      setLevel(l => withFittedGrid({ ...DEFAULT_LEVEL, sceneWidth: l.sceneWidth, sceneHeight: l.sceneHeight }));
      setTileSetName("base");
    }
  };

  return (
    <Page>
      <Panel>
        <strong>Level editor</strong>
        <Field>Open level
          <select value={GAME_LEVELS[level.id] ? level.id : ""} onChange={e => openGameLevel(e.target.value)}>
            <option value="">New level</option>
            {Object.keys(GAME_LEVELS).map(id => <option key={id} value={id}>{id}</option>)}
          </select>
        </Field>
        <Field>Level id
          <Input value={level.id} onChange={e => setLevel(l => ({ ...l, id: e.target.value }))} />
        </Field>
        <Field>Scene
          <Input type="file" accept="image/*" onChange={e => loadScene(e.target.files[0])} />
        </Field>
        {GRID_FIELDS.map(field => (
          <Field key={field}>{field}
            <Input
              type="number"
              step="0.5"
              value={grid[field]}
              onChange={e => updateGrid(field, Number(e.target.value))}
            />
          </Field>
        ))}
        <Field>Tile scale {tileScale}%
          <Input type="range" min="50" max="300" step="5" value={tileScale} onChange={e => changeTileScale(Number(e.target.value))} />
        </Field>
        <Field>Tile set
          <select value={tileSetName} onChange={e => setTileSetName(e.target.value)}>
            {Object.keys(level.tileSets).map(name => <option key={name}>{name}</option>)}
            <option>{LINKS_MODE}</option>
          </select>
        </Field>
        <button onClick={addTileSet}>Copy to new tile set</button>
        <span>{statusText}</span>
        <button disabled={!GAME_LEVELS[level.id]} onClick={saveToGame}>Save to game</button>
        {saveMessage && <span>{saveMessage}</span>}
        <button onClick={exportLevel}>Export JSON</button>
        <Field>Import
          <Input type="file" accept="application/json" onChange={e => importLevel(e.target.files[0])} />
        </Field>
        <button onClick={resetLevel}>Clear</button>
      </Panel>
      <Scene>
        <canvas
          ref={canvasRef}
          width={sceneWidth}
          height={sceneHeight}
          onPointerDown={startPainting}
          onPointerMove={continuePainting}
          onPointerUp={stopPainting}
          onPointerLeave={stopPainting}
        />
      </Scene>
    </Page>
  );
};
