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
  hoverFadeStartTiles: 0.5, // the grid also shows around the tile under the mouse: that tile fully, then falling away
  hoverFadeEndTiles: 3,
  siteFadeStartTiles: 2, // the tiles around a site on the map always show
  siteFadeEndTiles: 4,
  // a hard line along the edge of the walkable tiles, which comes into view as the player gets close
  perimeterColor: "255, 255, 255", // r, g, b: the same on every level
  perimeterOpacity: 0.8, // at its strongest, right beside the player
  perimeterWidth: 4, // in screen pixels
  perimeterFullTiles: 2,
  perimeterHiddenTiles: 7,
  statusTintOpacity: 0.62,
  statusRimOpacity: 0.95,
  statusBackingOpacity: 0.35, // darkens the floor under status tiles, so they stand out on any floor
  highlightGrey: 0.55, // how far the player's color is washed out, for their path
  highlightLight: 0.3,
  highlightTintOpacity: 0.34,
  pieceTintOpacity: 0.3,
  softRimOpacity: 0.6,
  // tiles linked to another tile
  linkColor: "#9b7bff",
  linkTintOpacity: 0.5,
  // a Teleport's wormhole: Teleport's color, pulsing, and fading out as it closes
  wormholeColor: "#8a2be2",
  wormholePulseSeconds: 0.6,
  wormholeFadeMs: 1500, // over its last moments
  // Bubble's Suds: soapy tiles
  soapColor: "#dff3ff",
  soapTintOpacity: 0.45,
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
  fadeSeconds: 2,
  // a status burning out at the edge of the map: it darkens to smoke, then fades fast once it is gone
  smokeColor: "#000000",
  smokeFadeMs: 350,
  // where a status moves on, its icon leaves a fading ghost in the power's own color
  iconGhostOpacity: 0.6,
  iconGhostMs: 500
};

// any css color as [r, g, b]: the canvas turns names like 'tomato' into hex
const colorCanvas = document.createElement("canvas").getContext("2d");
const getRgb = color => {
  colorCanvas.fillStyle = color;
  const hex = colorCanvas.fillStyle;
  return [1, 3, 5].map(start => parseInt(hex.slice(start, start + 2), 16));
};

// from one color to another, 'amount' of the way: in steps, so colored tiles still share a few sprites
const SMOKE_STEPS = 6;
const mixColors = (from, to, amount) => {
  const step = Math.round(Math.min(Math.max(amount, 0), 1) * SMOKE_STEPS) / SMOKE_STEPS;
  const [a, b] = [getRgb(from), getRgb(to)];
  return `#${a.map((channel, k) => Math.round(channel + (b[k] - channel) * step).toString(16).padStart(2, "0")).join("")}`;
};

// smoke darkens as its count runs down
const getSmokeColor = (tile, color) => {
  const startCount = Math.max(tile.getTileStatus().bounceCountResetVal, 1);
  return mixColors(color, TILE_LOOK.smokeColor, 1 - tile.getCurrCount() / startCount);
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

// toward grey, then toward white, so that even a dark color reads on the map
const getHighlightColor = hex => {
  const channels = [1, 3, 5].map(start => parseInt(hex.slice(start, start + 2), 16));
  const grey = channels.reduce((total, channel) => total + channel, 0) / 3;
  const washOut = channel => {
    const greyed = channel + (grey - channel) * TILE_LOOK.highlightGrey;
    return Math.round(greyed + (255 - greyed) * TILE_LOOK.highlightLight).toString(16).padStart(2, "0");
  };
  return `#${channels.map(washOut).join("")}`;
};

const drawIcon = (ctx, { iconClass, rotation }, center, radius, color, lineScale) => {
  if (!iconClass) return;
  ctx.save();
  ctx.translate(center.x, center.y);
  ctx.rotate((rotation * Math.PI) / 180);
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
  if (iconClass == "fa-two-hearts") {
    // a little heart beside the big one
    ctx.font = `${radius * TILE_LOOK.iconSizeRatio * 1.1}px FontAwesome`;
    ctx.strokeText(getIconGlyph(iconClass), radius * 0.55, -radius * 0.4);
    ctx.fillText(getIconGlyph(iconClass), radius * 0.55, -radius * 0.4);
  }
  ctx.restore();
};

const getLineScale = grid => getHexRadius(grid) / TILE_LOOK.baseHexRadius;

export const TileCanvas = ({ gameManager, level, tone, isVisible, zoom, isTeamColors = false }) => {
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
      const { x, y } = gameManager.getFocusPiece().charLocation;
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
      (level.sites || []).forEach(({ spot }) => addLight(spot, TILE_LOOK.siteFadeStartTiles, TILE_LOOK.siteFadeEndTiles));

      ctx.globalCompositeOperation = "destination-in";
      ctx.drawImage(fadeMask, 0, 0, width, height);
      ctx.globalCompositeOperation = "source-over";
    };

    const drawPerimeter = ({ x, y }) => {
      const { perimeterColor, perimeterFullTiles, perimeterHiddenTiles } = TILE_LOOK;
      const fade = ctx.createRadialGradient(x, y, perimeterFullTiles * tileSize, x, y, perimeterHiddenTiles * tileSize);
      fade.addColorStop(0, `rgba(${perimeterColor}, ${TILE_LOOK.perimeterOpacity})`);
      fade.addColorStop(1, `rgba(${perimeterColor}, 0)`);
      ctx.strokeStyle = fade;
      ctx.lineWidth = TILE_LOOK.perimeterWidth / zoom;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.stroke(perimeter);
    };

    drawEmptyTiles();

    /*
      What was on the tiles last time, and what is still fading from tiles it has left, by tile.
      Smoke that has gone out fades fast. An icon that has moved on leaves a ghost of itself.
    */
    let smokeTiles = new Map(); // { center, color }
    let iconTiles = new Map(); // { center, icon, color }
    const smokeFades = new Map();
    const iconGhosts = new Map();
    let fadeFrame = undefined;
    const drawFades = () => {
      const nowMs = performance.now();
      const getOpacity = (fades, key, startMs, fadeMs) => {
        const opacity = 1 - (nowMs - startMs) / fadeMs;
        if (opacity <= 0) fades.delete(key);
        return opacity;
      };
      smokeFades.forEach(({ center, color, startMs }, key) => {
        const opacity = getOpacity(smokeFades, key, startMs, TILE_LOOK.smokeFadeMs);
        if (opacity <= 0) return;
        ctx.globalAlpha = opacity;
        drawSprite(ctx, getStatusSprite(color), center, pixelRatio);
      });
      iconGhosts.forEach(({ center, icon, color, startMs }, key) => {
        const opacity = getOpacity(iconGhosts, key, startMs, TILE_LOOK.iconGhostMs);
        if (opacity <= 0) return;
        ctx.globalAlpha = opacity * TILE_LOOK.iconGhostOpacity;
        drawIcon(ctx, icon, center, radius, color, lineScale);
      });
      ctx.globalAlpha = 1;
      // the fades are quicker than the game's ticks, so they draw on their own frames while they last
      if ((smokeFades.size || iconGhosts.size) && fadeFrame === undefined) fadeFrame = requestAnimationFrame(() => {
        fadeFrame = undefined;
        draw();
      });
    };

    // what is gone since last time starts to fade
    const startFades = (lastTiles, nextTiles, fades) => {
      lastTiles.forEach((last, key) => {
        if (!nextTiles.has(key)) fades.set(key, { ...last, startMs: performance.now() });
      });
    };

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
      const accTime = gameManager.getAccTime();
      const wormholePulse = (Math.sin((performance.now() / 1000 / TILE_LOOK.wormholePulseSeconds) * Math.PI * 2) + 1) / 2;
      gameManager.getWormholes().forEach(({ from, to, endsAt }) => {
        const closing = Math.min((endsAt - accTime) / TILE_LOOK.wormholeFadeMs, 1);
        ctx.globalAlpha = Math.max(closing, 0) * (0.55 + 0.45 * wormholePulse);
        [from, to].forEach(tileIndex => drawSprite(ctx, getStatusSprite(TILE_LOOK.wormholeColor), getTileCenter(grid, tileIndex), pixelRatio));
      });
      ctx.globalAlpha = 1;
      gameManager.getSoapyTiles().forEach(tileIndex => {
        drawSprite(ctx, getSoftSprite(TILE_LOOK.soapColor, TILE_LOOK.soapTintOpacity), getTileCenter(grid, tileIndex), pixelRatio);
      });
      const colorLookup = gameManager.getPieceColorsLookup();

      const pulse = (Math.sin((performance.now() / 1000 / TILE_LOOK.goalPulseSeconds) * Math.PI * 2) + 1) / 2;
      ctx.globalAlpha = TILE_LOOK.goalMinOpacity + (1 - TILE_LOOK.goalMinOpacity) * pulse;
      level.goalTiles.forEach(tileIndex => {
        const center = getTileCenter(grid, tileIndex);
        if (!level.goalColor) drawGoalBeam(ctx, center, radius);
        drawSprite(ctx, getSoftSprite(level.goalColor || TILE_LOOK.goalColor, TILE_LOOK.statusTintOpacity), center, pixelRatio);
      });
      ctx.globalAlpha = 1;

      const nextSmokeTiles = new Map();
      const nextIconTiles = new Map();
      gameManager.getActiveTiles().forEach(tile => {
        const key = `${tile.tileIndex.i} ${tile.tileIndex.j}`;
        const powerColor = tile.getColor();
        const teamColor = isTeamColors && powerColor && !tile.teleportTileStatus ? gameManager.getStatusTeamColor(tile.cast.casterIndex) : undefined;
        const statusColor = teamColor || powerColor;
        const isSmoke = !!statusColor && tile.cast.isSmoke && !tile.teleportTileStatus;
        const color = isSmoke ? getSmokeColor(tile, statusColor) : statusColor;
        // the icon keeps its power's color on a team-colored tile, so the power can always be told
        const iconColor = isSmoke ? getSmokeColor(tile, powerColor) : powerColor;
        if (isSmoke) nextSmokeTiles.set(key, { center: getTileCenter(grid, tile.tileIndex), color });
        const pieceColor = colorLookup[`${tile.tileIndex.i} ${tile.tileIndex.j}`];
        const isHighlighted = tile.getIsHighlighted();
        if (!color && !isHighlighted && !pieceColor) return;

        const center = getTileCenter(grid, tile.tileIndex);
        if (isHighlighted) drawSprite(ctx, getSoftSprite(getHighlightColor(gameManager.getPlayerColor()), TILE_LOOK.highlightTintOpacity), center, pixelRatio);
        else if (pieceColor && !color) drawSprite(ctx, getSoftSprite(pieceColor, TILE_LOOK.pieceTintOpacity), center, pixelRatio);
        if (color) {
          if (!isHighlighted) drawSprite(ctx, getStatusSprite(pieceColor || color), center, pixelRatio);
          const icon = { iconClass: tile.getActiveIcon(), rotation: tile.getRotation() };
          drawIcon(ctx, icon, center, radius, iconColor, lineScale);
          if (icon.iconClass && !tile.teleportTileStatus) nextIconTiles.set(key, { center, icon, color: iconColor });
        }
      });
      startFades(smokeTiles, nextSmokeTiles, smokeFades);
      startFades(iconTiles, nextIconTiles, iconGhosts);
      smokeTiles = nextSmokeTiles;
      iconTiles = nextIconTiles;
      drawFades();
    };

    draw();
    let isCancelled = false;
    document.fonts.load("20px FontAwesome").then(() => !isCancelled && draw());
    const unsubscribe = gameManager.subscribeToBoard(draw);
    return () => {
      isCancelled = true;
      if (fadeFrame !== undefined) cancelAnimationFrame(fadeFrame);
      unsubscribe();
    };
  }, [gameManager, level, tone, grid, width, height, zoom, isTeamColors]);

  return (
    <StyledCanvas
      ref={canvasRef}
      style={{ width: `${width}px`, height: `${height}px`, opacity: isVisible ? 1 : 0 }}
    />
  );
};
