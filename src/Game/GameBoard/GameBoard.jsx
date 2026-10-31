import React, { useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import styled, { css, keyframes } from "styled-components";
import { DeadPlayer } from "./Pieces/DeadPlayerPiece";
import { ExplodingKaiju } from "./Pieces/ExplodingKaijuPiece";
import { PauseModal } from "./PauseModal";
import { GameBoardPieceComponent } from 'Game/GameBoard/Pieces/GameBoardPieceComponent'
import { TileCanvas } from 'Game/GameBoard/Tile/TileCanvas';
import { SceneElements } from 'Game/GameBoard/SceneElements';
import { getSortZIndex, getTileTone } from 'Game/Levels/levels';
import { WakeCanvas } from 'Game/GameBoard/WakeCanvas';
import { Camera, CAMERA, getCloseZoom, getFitZoom, WIDE_SHOT } from 'Game/DataClasses/Camera';
import { getHexRadius, getTileIndexAtLocation } from 'Game/DataClasses/GameBoard/hexGrid';

const Board = styled.div`
  position: absolute;
  inset: 0;
  overflow: hidden;
  cursor: default;
  touch-action: manipulation;
`;

// a train rattling through. sized a little over the view, so its edges never show.
const trainRumble = keyframes`
  0%, 100% { transform: scale(1.012) translate(0.12%, 0.18%); }
  14% { transform: scale(1.012) translate(-0.16%, -0.1%); }
  29% { transform: scale(1.012) translate(0.1%, -0.2%); }
  43% { transform: scale(1.012) translate(-0.1%, 0.2%); }
  57% { transform: scale(1.012) translate(0.18%, 0.06%); }
  71% { transform: scale(1.012) translate(-0.18%, 0.12%); }
  86% { transform: scale(1.012) translate(0.06%, -0.16%); }
`;

const SceneShake = styled.div`
  position: absolute;
  inset: 0;
  ${props => props.$isShaking && css`animation: ${trainRumble} 0.32s linear infinite;`}
`;

// the level. the camera moves and scales this.
const World = styled.div`
  position: absolute;
  left: 0;
  top: 0;
  transform-origin: 0 0;
  transition: transform ${CAMERA.panTransitionMs}ms linear;
`;

const WorldContent = styled.div`
  position: absolute;
`;

const LevelLayer = styled.img`
  position: absolute;
  left: 0;
  top: 0;
  pointer-events: none;
  transition: opacity 2s;
`;

// points at an enemy outside of the view, like a compass needle. bigger means closer.
const CARET_LOOK = {
  rim: "#f6efd9",
  rimWidth: 6, // in the caret's own 100 x 100 drawing
  centerLineWidth: 4,
  shadeOpacity: 0.35 // one half of the needle is darker, as on a compass rose
};

const EdgeCaret = styled.svg`
  position: absolute;
  z-index: 2147483000;
  overflow: visible;
  pointer-events: none;
  filter: drop-shadow(0 0 2px black);
`;

// the play window's size, while it is being adjusted
const WindowSize = styled.div`
  position: absolute;
  left: 50%;
  bottom: 1cqw;
  transform: translateX(-50%);
  z-index: 2147483001;
  padding: 0.3cqw 0.8cqw;
  border-radius: 0.4cqw;
  font-size: 1.2cqw;
  white-space: nowrap;
  pointer-events: none;
  color: #ffd24a;
  background: rgba(0, 0, 0, 0.75);
`;

const getIsTouchScreen = () => window.matchMedia("(pointer: coarse)").matches;

export const GameBoard = ({ isPaused, gameManager, level, activePhases, isWholeScene, playWindow, isShowingWindowSize, isEditingTiles, isMouseLook }) => {
  // redraws the pieces when the game updates. the tiles draw themselves.
  useSyncExternalStore(gameManager.subscribeToBoard, gameManager.getBoardRevision);
  const pieces = gameManager.getPieces();
  const inputHandler = gameManager.getPlayerInputHandler();

  const boardRef = useRef(null);
  const worldRef = useRef(null);
  const mouseAim = useRef({ x: 0, y: 0 }); // where the mouse is in the view: -1 to 1, with 0 in the middle
  const [frame, setFrame] = useState({ width: 1, height: 1 });
  const { grid, world, contentOffset, pieceScale } = level;
  const getWorldLocation = ({ x, y }) => ({ x: x + contentOffset.x, y: y + contentOffset.y });

  useLayoutEffect(() => {
    const gameFrame = boardRef.current.closest("[data-game-frame]");
    const measure = () => setFrame({ width: gameFrame.clientWidth, height: gameFrame.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(gameFrame);
    return () => observer.disconnect();
  }, []);

  // the cameras work from the frame, which holds still while the window opens for a wide shot
  const worldSizes = { worldWidth: world.width, worldHeight: world.height };
  const windowWidth = frame.width * (playWindow.right - playWindow.left);
  const windowHeight = frame.height * (playWindow.bottom - playWindow.top);

  const closeCamera = useMemo(() => {
    const sizes = { ...worldSizes, viewWidth: windowWidth, viewHeight: windowHeight };
    return new Camera({
      ...sizes,
      // zoomed for the whole frame: a smaller window shows less of the level, with tiles at the same size
      zoom: isWholeScene ? getFitZoom(sizes) : getCloseZoom({
        ...worldSizes,
        viewWidth: frame.width,
        viewHeight: frame.height,
        hexWidthPx: getHexRadius(grid) * 2,
        cameraZoom: level.cameraZoom,
        isTouch: getIsTouchScreen()
      })
    });
  }, [level, frame, isWholeScene, playWindow]);

  const wideCamera = useMemo(() => {
    const sizes = { ...worldSizes, viewWidth: frame.width, viewHeight: frame.height };
    const camera = new Camera({ ...sizes, zoom: getFitZoom(sizes) });
    camera.centerOn({ x: world.width / 2, y: world.height / 2 });
    return camera;
  }, [level, frame]);

  // walking scenes are made to be seen whole
  const getIsWholeLevelInView = () => level.isWalkingLevel || gameManager.getIsWideShot();
  const isWideShot = getIsWholeLevelInView();
  const camera = isWideShot ? wideCamera : closeCamera;

  useEffect(() => {
    let wasWideShot = getIsWholeLevelInView();
    let pullEndMs = 0;
    const moveCamera = () => {
      const player = gameManager.getPieces()[0];
      if (!player || !worldRef.current) return;
      const isWide = getIsWholeLevelInView();
      const nowMs = performance.now();
      if (isWide != wasWideShot) {
        wasWideShot = isWide;
        pullEndMs = nowMs + WIDE_SHOT.pullMs;
      }
      worldRef.current.style.transition = nowMs < pullEndMs ? `transform ${WIDE_SHOT.pullMs}ms ease-in-out` : "";
      if (!isWide) {
        // the keys are in charge when the mouse's hover is hidden
        const isLooking = isMouseLook && !!gameManager.getHoveredTileIndex();
        closeCamera.lookToward(getWorldLocation(player.charLocation), isLooking ? mouseAim.current : { x: 0, y: 0 });
      }
      worldRef.current.style.transform = (isWide ? wideCamera : closeCamera).getTransform();
    };
    closeCamera.centerOn(getWorldLocation(gameManager.getPieces()[0].charLocation));
    moveCamera();
    return gameManager.subscribeToBoard(moveCamera);
  }, [gameManager, closeCamera, wideCamera, isMouseLook]);

  const getLocationFromEvent = e => {
    // includes the camera's pan and zoom
    const rect = worldRef.current.getBoundingClientRect();
    const onScreenZoom = rect.width / world.width; // holds mid-pull and mid-shake, when it isn't the camera's zoom
    return {
      x: (e.clientX - rect.left) / onScreenZoom - contentOffset.x,
      y: (e.clientY - rect.top) / onScreenZoom - contentOffset.y
    };
  };

  const playerIndex = 0;
  const isPlayerDead = !!pieces[playerIndex] && pieces[playerIndex].isDead;

  const edgeCarets = isWideShot || !pieces[playerIndex] ? [] : pieces
    .filter(p => p.getTeamIndex() != pieces[playerIndex].getTeamIndex() && !p.isDead)
    .map(p => ({
      key: p.pieceIndex,
      color: p.color,
      caret: closeCamera.getEdgeCaret(getWorldLocation(p.charLocation), getWorldLocation(pieces[playerIndex].charLocation), grid.rowStep * grid.scale)
    }))
    .filter(({ caret }) => !!caret)
    .map(({ key, color, caret: { left, top, size, degrees } }) => (
      <EdgeCaret key={key} viewBox="0 0 100 100" style={{
        left: `${left - size / 2}px`,
        top: `${top - size / 2}px`,
        width: `${size}px`,
        height: `${size}px`,
        transform: `rotate(${degrees}deg)`
      }}>
        <path d="M100 50 L0 10 L24 50 L0 90 Z" fill={color} />
        <path d="M100 50 L24 50 L0 90 Z" fill="black" opacity={CARET_LOOK.shadeOpacity} />
        <path d="M100 50 L0 10 L24 50 L0 90 Z" fill="none" stroke={CARET_LOOK.rim} strokeWidth={CARET_LOOK.rimWidth} strokeLinejoin="round" />
        <path d="M100 50 L24 50" stroke={CARET_LOOK.rim} strokeWidth={CARET_LOOK.centerLineWidth} />
      </EdgeCaret>
    ));

  // on press rather than on release, so a click can't be lost, and it feels immediate
  const handlePress = e => {
    if (isPlayerDead || isPaused || isEditingTiles || e.button != 0) return;
    inputHandler.updatePlayerDestinationAndClickedTileFromClick(gameManager.getClosestReachableTile(getLocationFromEvent(e)));
  };

  const handleMouseMove = e => {
    const board = boardRef.current.getBoundingClientRect();
    if (!getIsTouchScreen()) {
      const getAim = (spot, start, size) => Math.max(Math.min(((spot - start) / size) * 2 - 1, 1), -1);
      mouseAim.current = { x: getAim(e.clientX, board.left, board.width), y: getAim(e.clientY, board.top, board.height) };
    }
    const location = getLocationFromEvent(e);
    const tileIndex = getTileIndexAtLocation(grid, location);
    const isClickable = !isPlayerDead && !!tileIndex && gameManager.getIsWalkable(tileIndex);
    boardRef.current.style.cursor = isClickable ? "pointer" : "default";
    if (isPlayerDead || isPaused || isEditingTiles) return;
    inputHandler.updateHoveredTileFromPlayerHover(gameManager.getClosestReachableTile(location));
  };

  const handleMouseLeave = () => {
    mouseAim.current = { x: 0, y: 0 };
    if (isPlayerDead) return;
    inputHandler.updateHoveredTileFromPlayerHover(undefined);
  };

  const mouseHandlers = useRef(null);
  mouseHandlers.current = { handlePress, handleMouseMove, handleMouseLeave };

  // the mouse counts everywhere on the page, so the empty area around a small play window still aims and clicks
  useEffect(() => {
    const gameFrame = boardRef.current.closest("[data-game-frame]");
    const press = e => {
      const isOnGameArea = e.target == gameFrame || boardRef.current.contains(e.target);
      if (isOnGameArea) mouseHandlers.current.handlePress(e);
    };
    const move = e => mouseHandlers.current.handleMouseMove(e);
    const leave = () => mouseHandlers.current.handleMouseLeave();
    gameFrame.addEventListener("pointerdown", press);
    document.addEventListener("mousemove", move);
    document.documentElement.addEventListener("mouseleave", leave);
    return () => {
      gameFrame.removeEventListener("pointerdown", press);
      document.removeEventListener("mousemove", move);
      document.documentElement.removeEventListener("mouseleave", leave);
    };
  }, []);

  const piecesComponents = pieces.map(p =>
    <GameBoardPieceComponent
      key={p.pieceIndex}
      zIndex={p.getZIndex()}
      charLocation={p.charLocation}
      avatar={p.avatar}
      color={p.color}
      isVisible={p.isVisible}
      isHealed={p.isHealed}
      isCharmed={p.isCharmed}
      isTeleported={p.isTeleported}
      dir={p.dir}
      facingDir={p.getFacingDir()}
      pieceScale={pieceScale}
      spriteSheetSrc={p.spriteSheetSrc}
      lives={p.lives}
      isGoingToSpewFire={p.isGoingToSpewFire}
      isShowHealthBarOnComponent={p.isShowHealthBarOnComponent}
    />
  );

  const deathPiecesComponents = gameManager.getDeathPieces().map(({ key, avatar, charLocation, color, zIndex, pieceIndex }) => (
    avatar == 'kaiju' ?
      <ExplodingKaiju key={key} charLocation={charLocation} color={color} zIndex={zIndex} />
      : <DeadPlayer key={key} i={pieceIndex} charLocation={charLocation} color={color} zIndex={zIndex} />
  ));

  const foregroundLayers = level.foregroundLayers.map(({ src, x, y, width, height, sortY }) => (
    <LevelLayer
      key={src}
      src={src}
      style={{ left: `${x}px`, top: `${y}px`, width: `${width}px`, height: `${height}px`, zIndex: getSortZIndex(level, sortY), opacity: isPaused ? 0 : 1 }}
    />
  ));

  const levelLayers = level.layers.map(({ src, zIndex }) => (
    <LevelLayer
      key={src}
      src={src}
      style={{ zIndex, width: `${world.width}px`, height: `${world.height}px`, opacity: isPaused ? 0 : 1 }}
    />
  ));

  return (
    <Board
      ref={boardRef}>
      {isPaused && <PauseModal />}
      <SceneShake $isShaking={!isPaused && level.shakePhases.some(id => activePhases.includes(id))}>
      <World ref={worldRef} data-game-world style={{ width: `${world.width}px`, height: `${world.height}px` }}>
        {levelLayers}
        {foregroundLayers}
        <SceneElements level={level} activePhases={activePhases} isPaused={isPaused} />
        <WorldContent style={{ left: `${contentOffset.x}px`, top: `${contentOffset.y}px` }}>
          <TileCanvas gameManager={gameManager} level={level} tone={getTileTone(level, activePhases)} isVisible={!isPaused && !isEditingTiles} zoom={closeCamera.zoom} />
          <WakeCanvas gameManager={gameManager} level={level} zoom={closeCamera.zoom} isActive={!!level.flood && activePhases.includes(level.flood.phase)} />
          {piecesComponents}
          {deathPiecesComponents}
        </WorldContent>
      </World>
      </SceneShake>
      {edgeCarets}
      {isShowingWindowSize && (
        <WindowSize>
          {Math.round((playWindow.right - playWindow.left) * 100)}% x {Math.round((playWindow.bottom - playWindow.top) * 100)}% of the frame:
          {" "}{Math.floor(windowWidth / (grid.colStep * grid.scale * closeCamera.zoom))} x {Math.floor(windowHeight / (grid.rowStep * grid.scale * closeCamera.zoom))} tiles in view
        </WindowSize>
      )}
    </Board>
  );
};
