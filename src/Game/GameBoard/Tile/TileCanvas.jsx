import React, { useEffect, useRef } from "react";
import styled from "styled-components";
import { getHexRadius, getPerimeterEdges, getTileCenter } from "Game/DataClasses/GameBoard/hexGrid";

/*
  Draws every tile on one canvas: a React component per tile cannot keep up with larger levels.
  Look-and-feel numbers for the tiles are all here.
*/
const TILE_LOOK = {
  // the grid: one thin line, the same width on screen at every tile size. the level's tone sets its colors.
  lineWidth: 1.2, // in screen pixels
  casingWidth: 3, // in screen pixels. the second line beside it, so tiles read on any floor.
  // the grid fades with distance from the player. colored tiles never do.
  fadeStartTiles: 5,
  fadeEndTiles: 13,
  fadeMinOpacity: 0.12, // the grid never quite vanishes, so the walkable floor can still be found
  fadeMaskScale: 0.25, // the fade is soft, so it can be worked out on a much smaller canvas
  hoverFadeStartTiles: 3, // the grid also shows around the tile under the mouse
  hoverFadeEndTiles: 7,
  // a hard line along the edge of the walkable tiles, which comes into view as the player gets close
  perimeterColor: "255, 255, 255", // r, g, b: the same on every level
  perimeterWidth: 4, // in screen pixels
  perimeterFullTiles: 2,
  perimeterHiddenTiles: 7,
  statusTintOpacity: 0.62,
  statusRimOpacity: 0.95,
  statusBackingOpacity: 0.35, // darkens the floor under status tiles, so they stand out on any floor
  highlightColor: "#bfe6f0",
  highlightTintOpacity: 0.34,
  pieceTintOpacity: 0.3,
  softRimOpacity: 0.6,
  // tiles linked to another tile
  linkColor: "#9b7bff",
  linkTintOpacity: 0.5,
  // goal tiles: a glowing light shines upward from the tile
  goalColor: "#ffd24a",
  goalPulseSeconds: 1.4,
  goalMinOpacity: 0.55,
  goalBeamHeight: 7, // as a multiple of the hexagon's radius
  goalBeamTopWidth: 0.55, // as a fraction of the beam's width at the tile
  iconOutlineColor: "black",
  iconOutlineWidth: 2.5,
  iconSizeRatio: 0.55, // icon height, as a fraction of the hexagon's radius * 2
  iconGlow: 2,
  baseHexRadius: 12.6, // line widths are set for hexagons of this size, and scale with them
  maxPixelRatio: 1.5,
  fadeSeconds: 2
};

const StyledCanvas = styled.canvas`
  position: absolute;
  left: 0;
  top: 0;
  z-index: 1;
  pointer-events: none;
  transition: opacity ${TILE_LOOK.fadeSeconds}s;
`;

// from the grid's own spacing, so neighboring tiles share their edges exactly at any scale
const getTileShape = grid => ({
  halfWidth: (grid.colStep * grid.scale * 2) / 3,
  halfHeight: (grid.rowStep * grid.scale) / 2
});

// clockwise from the right-hand corner
const getTileCorners = ({ x, y }, { halfWidth, halfHeight }) => [
  { x: x + halfWidth, y },
  { x: x + halfWidth / 2, y: y + halfHeight },
  { x: x - halfWidth / 2, y: y + halfHeight },
  { x: x - halfWidth, y },
  { x: x - halfWidth / 2, y: y - halfHeight },
  { x: x + halfWidth / 2, y: y - halfHeight }
];

const traceTile = (ctx, center, shape) => {
  getTileCorners(center, shape).forEach(({ x, y }, corner) => corner ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
  ctx.closePath();
};

// one colored tile, kept on its own canvas: tiles of the same look share it
const makeTileSprite = ({ shape, pixelRatio, zoom, tint, tintOpacity, rimOpacity, backingOpacity = 0 }) => {
  const sprite = document.createElement("canvas");
  sprite.width = sprite.height = Math.ceil((shape.halfWidth * 2 + TILE_LOOK.casingWidth / zoom) * pixelRatio);
  const ctx = sprite.getContext("2d");
  ctx.scale(pixelRatio, pixelRatio);
  const size = sprite.width / pixelRatio;
  const middle = { x: size / 2, y: size / 2 };

  const fillTile = (fillStyle, opacity) => {
    ctx.beginPath();
    traceTile(ctx, middle, shape);
    ctx.fillStyle = fillStyle;
    ctx.globalAlpha = opacity;
    ctx.fill();
  };

  if (backingOpacity) fillTile("black", backingOpacity);
  fillTile(tint, tintOpacity);

  ctx.beginPath();
  traceTile(ctx, middle, shape);
  ctx.strokeStyle = tint;
  ctx.globalAlpha = rimOpacity;
  ctx.lineWidth = TILE_LOOK.lineWidth / zoom;
  ctx.stroke();
  return { sprite, size };
};

// font awesome keeps each icon's character in its css, eg. '.fa-tint' -> '\f043'
const iconGlyphs = {};
const getIconGlyph = iconClass => {
  if (iconGlyphs[iconClass] === undefined) {
    const element = document.createElement("i");
    element.className = `fa ${iconClass}`;
    element.style.position = "absolute";
    element.style.visibility = "hidden";
    document.body.appendChild(element);
    iconGlyphs[iconClass] = getComputedStyle(element, "::before").content.replace(/["']/g, "");
    document.body.removeChild(element);
  }
  return iconGlyphs[iconClass];
};

// on whole device pixels, so every tile's lines come out the same
const drawSprite = (ctx, { sprite, size }, { x, y }, pixelRatio) => {
  const snap = value => Math.round(value * pixelRatio) / pixelRatio;
  ctx.drawImage(sprite, snap(x - size / 2), snap(y - size / 2), size, size);
};

const drawGoalBeam = (ctx, { x, y }, radius) => {
  const height = radius * TILE_LOOK.goalBeamHeight;
  const topHalfWidth = radius * TILE_LOOK.goalBeamTopWidth;
  const light = ctx.createLinearGradient(0, y, 0, y - height);
  light.addColorStop(0, TILE_LOOK.goalColor);
  light.addColorStop(1, "rgba(255, 210, 74, 0)");
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.fillStyle = light;
  ctx.beginPath();
  ctx.moveTo(x - radius, y);
  ctx.lineTo(x - topHalfWidth, y - height);
  ctx.lineTo(x + topHalfWidth, y - height);
  ctx.lineTo(x + radius, y);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
};

const drawIcon = (ctx, tile, center, radius, color, lineScale) => {
  const iconClass = tile.getActiveIcon();
  if (!iconClass) return;
  ctx.save();
  ctx.translate(center.x, center.y);
  ctx.rotate((tile.getRotation() * Math.PI) / 180);
  ctx.font = `${radius * 2 * TILE_LOOK.iconSizeRatio}px FontAwesome`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.strokeStyle = TILE_LOOK.iconOutlineColor;
  ctx.lineWidth = TILE_LOOK.iconOutlineWidth * lineScale;
  ctx.lineJoin = "round";
  ctx.strokeText(getIconGlyph(iconClass), 0, 0);
  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = TILE_LOOK.iconGlow * lineScale;
  ctx.fillText(getIconGlyph(iconClass), 0, 0);
  ctx.restore();
};

const getLineScale = grid => getHexRadius(grid) / TILE_LOOK.baseHexRadius;

export const TileCanvas = ({ gameManager, level, tone, isVisible, zoom }) => {
  const canvasRef = useRef(null);
  const { grid, world, contentOffset } = level;
  const width = world.width - contentOffset.x;
  const height = world.height - contentOffset.y;

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const pixelRatio = Math.min((window.devicePixelRatio || 1) * zoom, TILE_LOOK.maxPixelRatio);
    canvas.width = width * pixelRatio;
    canvas.height = height * pixelRatio;
    ctx.scale(pixelRatio, pixelRatio);

    const radius = getHexRadius(grid);
    const lineScale = getLineScale(grid);
    const shape = getTileShape(grid);

    // colored tiles are made once per color
    const sprites = {};
    const getSprite = (key, look) => {
      sprites[key] = sprites[key] || makeTileSprite({ shape, pixelRatio, zoom, ...look });
      return sprites[key];
    };
    const getStatusSprite = color => getSprite(`status ${color}`, {
      tint: color,
      tintOpacity: TILE_LOOK.statusTintOpacity,
      rimOpacity: TILE_LOOK.statusRimOpacity,
      backingOpacity: TILE_LOOK.statusBackingOpacity
    });
    const getSoftSprite = (color, tintOpacity) => getSprite(`soft ${color}`, {
      tint: color,
      tintOpacity,
      rimOpacity: TILE_LOOK.softRimOpacity
    });

    // empty tiles never change, so they are drawn once and copied onto each frame
    const emptyTiles = document.createElement("canvas");
    emptyTiles.width = canvas.width;
    emptyTiles.height = canvas.height;
    const emptyTilesCtx = emptyTiles.getContext("2d");
    emptyTilesCtx.scale(pixelRatio, pixelRatio);
    let drawnWalkableRevision = gameManager.getWalkableRevision();
    let perimeter = new Path2D();
    const strokeGrid = (color, opacity, lineWidth) => {
      emptyTilesCtx.strokeStyle = color;
      emptyTilesCtx.globalAlpha = opacity;
      emptyTilesCtx.lineWidth = lineWidth / zoom;
      emptyTilesCtx.stroke();
    };
    const drawEmptyTiles = () => {
      emptyTilesCtx.clearRect(0, 0, width, height);
      // one path for the whole grid: an edge shared by two tiles is only drawn once
      emptyTilesCtx.beginPath();
      gameManager.getTiles().filter(tile => tile.getIsVisible()).forEach(tile => {
        traceTile(emptyTilesCtx, getTileCenter(grid, tile.tileIndex), shape);
      });
      emptyTilesCtx.lineJoin = "round";
      emptyTilesCtx.fillStyle = tone.line;
      emptyTilesCtx.globalAlpha = tone.fillOpacity;
      emptyTilesCtx.fill();
      strokeGrid(tone.casing, tone.casingOpacity, TILE_LOOK.casingWidth);
      strokeGrid(tone.line, tone.lineOpacity, TILE_LOOK.lineWidth);
      emptyTilesCtx.globalAlpha = 1;

      // one path, so the line stays one even color where its pieces meet
      perimeter = new Path2D();
      getPerimeterEdges(gameManager.getTiles().filter(tile => tile.getIsVisible()).map(tile => tile.tileIndex)).forEach(({ tile, edge }) => {
        const corners = getTileCorners(getTileCenter(grid, tile), shape);
        const from = corners[edge];
        const to = corners[(edge + 1) % 6];
        perimeter.moveTo(from.x, from.y);
        perimeter.lineTo(to.x, to.y);
      });
    };

    const tileSize = grid.rowStep * grid.scale;
    const getPlayerCenter = () => {
      const { x, y } = gameManager.getPieces()[0].charLocation;
      return { x: x - grid.charOffsetX * grid.scale, y: y - grid.charOffsetY * grid.scale };
    };

    // how much of the grid shows at each spot: lights add up, so the grid shows around the player and the mouse at once
    const fadeMask = document.createElement("canvas");
    fadeMask.width = Math.ceil(width * TILE_LOOK.fadeMaskScale);
    fadeMask.height = Math.ceil(height * TILE_LOOK.fadeMaskScale);
    const fadeMaskCtx = fadeMask.getContext("2d");
    fadeMaskCtx.scale(TILE_LOOK.fadeMaskScale, TILE_LOOK.fadeMaskScale);
    const addLight = ({ x, y }, startTiles, endTiles) => {
      const light = fadeMaskCtx.createRadialGradient(x, y, startTiles * tileSize, x, y, endTiles * tileSize);
      light.addColorStop(0, "rgba(0, 0, 0, 1)");
      light.addColorStop(1, "rgba(0, 0, 0, 0)");
      fadeMaskCtx.fillStyle = light;
      fadeMaskCtx.beginPath();
      fadeMaskCtx.arc(x, y, endTiles * tileSize, 0, Math.PI * 2);
      fadeMaskCtx.fill();
    };

    const fadeGrid = playerCenter => {
      fadeMaskCtx.globalCompositeOperation = "source-over";
      fadeMaskCtx.clearRect(0, 0, width, height);
      fadeMaskCtx.fillStyle = `rgba(0, 0, 0, ${TILE_LOOK.fadeMinOpacity})`;
      fadeMaskCtx.fillRect(0, 0, width, height);
      fadeMaskCtx.globalCompositeOperation = "lighter";
      addLight(playerCenter, TILE_LOOK.fadeStartTiles, TILE_LOOK.fadeEndTiles);
      const hoveredTile = gameManager.getHoveredTileIndex();
      if (hoveredTile) addLight(getTileCenter(grid, hoveredTile), TILE_LOOK.hoverFadeStartTiles, TILE_LOOK.hoverFadeEndTiles);

      ctx.globalCompositeOperation = "destination-in";
      ctx.drawImage(fadeMask, 0, 0, width, height);
      ctx.globalCompositeOperation = "source-over";
    };

    const drawPerimeter = ({ x, y }) => {
      const { perimeterColor, perimeterFullTiles, perimeterHiddenTiles } = TILE_LOOK;
      const fade = ctx.createRadialGradient(x, y, perimeterFullTiles * tileSize, x, y, perimeterHiddenTiles * tileSize);
      fade.addColorStop(0, `rgba(${perimeterColor}, 1)`);
      fade.addColorStop(1, `rgba(${perimeterColor}, 0)`);
      ctx.strokeStyle = fade;
      ctx.lineWidth = TILE_LOOK.perimeterWidth / zoom;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.stroke(perimeter);
    };

    drawEmptyTiles();

    const draw = () => {
      if (drawnWalkableRevision != gameManager.getWalkableRevision()) {
        drawnWalkableRevision = gameManager.getWalkableRevision();
        drawEmptyTiles();
      }
      ctx.clearRect(0, 0, width, height);
      ctx.globalAlpha = 1;
      ctx.drawImage(emptyTiles, 0, 0, width, height);
      const playerCenter = getPlayerCenter();
      fadeGrid(playerCenter);
      drawPerimeter(playerCenter);
      level.tileLinks.flat().forEach(tileIndex => {
        drawSprite(ctx, getSoftSprite(TILE_LOOK.linkColor, TILE_LOOK.linkTintOpacity), getTileCenter(grid, tileIndex), pixelRatio);
      });
      const colorLookup = gameManager.getPieceColorsLookup();

      const pulse = (Math.sin((performance.now() / 1000 / TILE_LOOK.goalPulseSeconds) * Math.PI * 2) + 1) / 2;
      ctx.globalAlpha = TILE_LOOK.goalMinOpacity + (1 - TILE_LOOK.goalMinOpacity) * pulse;
      level.goalTiles.forEach(tileIndex => {
        const center = getTileCenter(grid, tileIndex);
        drawGoalBeam(ctx, center, radius);
        drawSprite(ctx, getSoftSprite(TILE_LOOK.goalColor, TILE_LOOK.statusTintOpacity), center, pixelRatio);
      });
      ctx.globalAlpha = 1;

      gameManager.getActiveTiles().forEach(tile => {
        const color = tile.getColor();
        const pieceColor = colorLookup[`${tile.tileIndex.i} ${tile.tileIndex.j}`];
        const isHighlighted = tile.getIsHighlighted();
        if (!color && !isHighlighted && !pieceColor) return;

        const center = getTileCenter(grid, tile.tileIndex);
        if (isHighlighted) drawSprite(ctx, getSoftSprite(TILE_LOOK.highlightColor, TILE_LOOK.highlightTintOpacity), center, pixelRatio);
        else if (pieceColor && !color) drawSprite(ctx, getSoftSprite(pieceColor, TILE_LOOK.pieceTintOpacity), center, pixelRatio);
        if (color) {
          if (!isHighlighted) drawSprite(ctx, getStatusSprite(pieceColor || color), center, pixelRatio);
          drawIcon(ctx, tile, center, radius, color, lineScale);
        }
      });
    };

    draw();
    let isCancelled = false;
    document.fonts.load("20px FontAwesome").then(() => !isCancelled && draw());
    const unsubscribe = gameManager.subscribeToBoard(draw);
    return () => {
      isCancelled = true;
      unsubscribe();
    };
  }, [gameManager, level, tone, grid, width, height, zoom]);

  return (
    <StyledCanvas
      ref={canvasRef}
      style={{ width: `${width}px`, height: `${height}px`, opacity: isVisible ? 1 : 0 }}
    />
  );
};
