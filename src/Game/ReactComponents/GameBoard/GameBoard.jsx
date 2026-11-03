import React, { useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import styled, { css, keyframes } from "styled-components";
import { DeadPlayer } from "./Pieces/DeadPlayerPiece";
import { ExplodingKaiju } from "./Pieces/ExplodingKaijuPiece";
import { PauseModal } from "./PauseModal";
import { GameBoardPieceComponent } from 'Game/ReactComponents/GameBoard/Pieces/GameBoardPieceComponent'
import { SpeechBalloon } from 'Game/ReactComponents/GameBoard/SceneElements';
import { TileCanvas } from 'Game/ReactComponents/GameBoard/Tile/TileCanvas';
import { SceneElements } from 'Game/ReactComponents/GameBoard/SceneElements';
import { getSortZIndex, getTileTone } from 'Game/DataClasses/Levels/levels';
import { WakeCanvas } from 'Game/ReactComponents/GameBoard/WakeCanvas';
import { Camera, CAMERA, getCloseZoom, getFitZoom, WIDE_SHOT } from 'Game/DataClasses/Camera';
import { CUTSCENE } from 'Game/DataClasses/GameManager';
import { SpeechBubbleScale } from 'Game/ReactComponents/GameBoard/recruitLook';
import { getHexRadius } from 'Game/DataClasses/GameBoard/hexGrid';

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

const CHARM_COLOR = "#ff7ad9";
const RECRUIT_BODY_SIZE = 100; // at a 'pieceScale' of 1: the body in the art is then as long as a character is tall
const RECRUIT_LOOK_LEAN = 0.08; // how far the choice's camera leans with the mouse
const RECRUIT_PROMPT_SHIFT = 130; // to the right of the player, clear of the teammate's words

const WinDimmer = styled.div`
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  background: rgba(0, 0, 0, 0.62);
  transition: opacity 1s;
`;

// lying where they fell
const RecruitBody = styled.img`
  position: absolute;
  z-index: 19000;
  transform: translate(-50%, -50%);
  pointer-events: none;
`;

const RecruitPrompt = styled.div`
  position: absolute;
  z-index: 2147482500;
  display: flex;
  gap: 16px;
  transform-origin: 50% 100%;
`;

const RecruitButton = styled.button`
  padding: 12px 22px;
  font-family: gameboy;
  font-size: 22px;
  cursor: pointer;
  color: #fbfbf0;
  background: ${props => props.$isRecruit ? "#2f7d57" : "#a01230"};
  border: 4px solid #101018;
  &:hover {
    filter: brightness(1.3);
  }
`;

const getClosestEnemy = (player, pieces) => {
  const getDistance = ({ charLocation: { x, y } }) => Math.hypot(x - player.charLocation.x, y - player.charLocation.y);
  return pieces
    .filter(piece => piece.getTeamIndex() != player.getTeamIndex() && !piece.isDead && piece.isOnTiles)
    .reduce((closest, piece) => !closest || getDistance(piece) < getDistance(closest) ? piece : closest, undefined);
};

const MOVEMENT_KEYS = ["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowLeft", "ArrowDown", "ArrowRight"];

const getIsTouchScreen = () => window.matchMedia("(pointer: coarse)").matches;

export const GameBoard = ({ isPaused, gameManager, level, activePhases, isWholeScene, playWindow, isShowingWindowSize, isEditingTiles, isMouseLook, isEnemyZoom, isSlowMotion, speech, recruitScene, recruitChoice, onChooseRecruit, onHotspot }) => {
  // redraws the pieces when the game updates. the tiles draw themselves.
  useSyncExternalStore(gameManager.subscribeToBoard, gameManager.getBoardRevision);
  const pieces = gameManager.getPieces();

  const boardRef = useRef(null);
  const worldRef = useRef(null);
  const mouseAim = useRef({ x: 0, y: 0 }); // where the mouse is in the view: -1 to 1, with 0 in the middle
  const [frame, setFrame] = useState({ width: 1, height: 1 });
  const isFrameMeasured = frame.width > 1;
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
  const getIsWholeLevelInView = () => (level.isWalkingLevel && !level.isMapWalk) || gameManager.getIsWideShot();
  const isWideShot = getIsWholeLevelInView();
  const camera = isWideShot ? wideCamera : closeCamera;

  // the camera for a cutscene's shot: it looks at a spot, and can lean with the mouse
  const fullFrameSizes = { worldWidth: world.width, worldHeight: world.height, viewWidth: frame.width, viewHeight: frame.height };
  const getShotCamera = ({ point, zoomScale, isFollowingMouse }) => {
    const shotCamera = new Camera({ ...fullFrameSizes, zoom: getFitZoom(fullFrameSizes) * zoomScale });
    const lean = isFollowingMouse ? frame.width / shotCamera.zoom * RECRUIT_LOOK_LEAN : 0;
    shotCamera.centerOn({ x: point.x + mouseAim.current.x * lean, y: point.y + mouseAim.current.y * lean });
    return shotCamera;
  };

  useEffect(() => {
    let wasWideShot = getIsWholeLevelInView();
    let lastShot = undefined;
    let pullEndMs = 0;
    let pullMs = WIDE_SHOT.pullMs;
    let pullEase = "ease-in-out";
    let isCutting = false; // the camera is already there when the shot starts
    const moveCamera = () => {
      const player = gameManager.getFocusPiece();
      if (!player || !worldRef.current) return;
      const shot = gameManager.getCameraShot();
      const isWide = getIsWholeLevelInView();
      const nowMs = performance.now();
      if (isWide != wasWideShot || shot != lastShot) {
        if (lastShot && !shot) closeCamera.centerOn(getWorldLocation(player.charLocation));
        wasWideShot = isWide;
        lastShot = shot;
        pullMs = shot && shot.panMs || WIDE_SHOT.pullMs;
        pullEase = shot && shot.ease || "ease-in-out";
        pullEndMs = shot && shot.isCut ? 0 : nowMs + pullMs;
        isCutting = !!shot && !!shot.isCut;
      }
      const isFollowingMouse = !!shot && shot.isFollowingMouse && nowMs >= pullEndMs;
      worldRef.current.style.transition = isCutting ? "none" : isFollowingMouse ? `transform ${CAMERA.panTransitionMs}ms linear` : nowMs < pullEndMs ? `transform ${pullMs}ms ${pullEase}` : "";
      isCutting = false;
      if (shot && !shot.isWide) {
        worldRef.current.style.transform = getShotCamera(shot).getTransform();
        return;
      }
      if (!isWide) {
        // the keys are in charge when the mouse's hover is hidden
        const isLooking = isMouseLook && !!gameManager.getHoveredTileIndex();
        const closestEnemy = isEnemyZoom ? getClosestEnemy(player, gameManager.getPieces()) : undefined;
        closeCamera.lookToward(
          getWorldLocation(player.charLocation),
          isLooking ? mouseAim.current : { x: 0, y: 0 },
          closestEnemy ? getWorldLocation(closestEnemy.charLocation) : undefined
        );
      }
      worldRef.current.style.transform = (isWide ? wideCamera : closeCamera).getTransform();
    };
    closeCamera.centerOn(getWorldLocation(gameManager.getFocusPiece().charLocation));
    moveCamera();
    return gameManager.subscribeToBoard(moveCamera);
  }, [gameManager, closeCamera, wideCamera, isMouseLook, isEnemyZoom]);

  // everything animated plays in slow motion once the match is won
  // once a fight is over, the game eases into slow motion: the animations follow its speed
  const slowRate = isSlowMotion ? "outcome" : gameManager.isChaseSlowed ? CUTSCENE.chaseSlowSpeed : undefined;
  useEffect(() => {
    if (!slowRate) return;
    const getRate = () => slowRate == "outcome" ? gameManager.getTimeScale() : slowRate;
    // transitions are left alone: the camera's pull and the bodies' easing between ticks already run on game time
    const getIsTransition = animation => typeof CSSTransition != "undefined" && animation instanceof CSSTransition;
    const setRate = rate => worldRef.current && worldRef.current.getAnimations({ subtree: true }).forEach(animation => {
      if (!getIsTransition(animation)) animation.playbackRate = rate;
    });
    const interval = setInterval(() => setRate(getRate()), 100);
    setRate(getRate());
    return () => {
      clearInterval(interval);
      setRate(1);
    };
  }, [slowRate]);

  const focusPiece = pieces.length ? gameManager.getFocusPiece() : undefined;
  const siteTargets = (level.sites || []).map(({ spot, color }) => ({ key: `${spot.x} ${spot.y}`, color, charLocation: spot }));
  const edgeCarets = isWideShot || !focusPiece ? [] : [
    ...pieces
      .filter(p => p.getTeamIndex() != focusPiece.getTeamIndex() && !p.isDead)
      .map(p => ({ key: p.pieceIndex, color: p.color, charLocation: p.charLocation })),
    ...siteTargets
  ]
    .map(({ key, color, charLocation }) => ({
      key,
      color,
      caret: closeCamera.getEdgeCaret(getWorldLocation(charLocation), getWorldLocation(focusPiece.charLocation), grid.rowStep * grid.scale)
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

  // the keys move and use powers. the mouse only looks around, and clicks scene objects and buttons.
  const handleMouseMove = e => {
    if (getIsTouchScreen()) return;
    const board = boardRef.current.getBoundingClientRect();
    const getAim = (spot, start, size) => Math.max(Math.min(((spot - start) / size) * 2 - 1, 1), -1);
    mouseAim.current = { x: getAim(e.clientX, board.left, board.width), y: getAim(e.clientY, board.top, board.height) };
  };

  const handleMouseLeave = () => {
    mouseAim.current = { x: 0, y: 0 };
  };

  const mouseHandlers = useRef(null);
  mouseHandlers.current = { handleMouseMove, handleMouseLeave };

  // the mouse counts everywhere on the page, so the empty area around a small play window still aims
  useEffect(() => {
    const move = e => {
      document.body.style.cursor = "";
      mouseHandlers.current.handleMouseMove(e);
    };
    // browsers can't move the cursor, so it hides while the keys are in charge
    const hideCursor = ({ code }) => {
      if (!MOVEMENT_KEYS.includes(code)) return;
      document.body.style.cursor = "none";
      if (boardRef.current) boardRef.current.style.cursor = "none";
    };
    const leave = () => mouseHandlers.current.handleMouseLeave();
    document.addEventListener("mousemove", move);
    document.addEventListener("keydown", hideCursor);
    document.documentElement.addEventListener("mouseleave", leave);
    return () => {
      document.removeEventListener("mousemove", move);
      document.removeEventListener("keydown", hideCursor);
      document.body.style.cursor = "";
      document.documentElement.removeEventListener("mouseleave", leave);
    };
  }, []);

  const piecesComponents = pieces.map(p =>
    <GameBoardPieceComponent
      key={p.pieceIndex}
      zIndex={p.introZIndex ?? p.getZIndex()}
      charLocation={p.charLocation}
      avatar={p.avatar}
      color={p.isPlain ? "transparent" : p.isCharmed ? CHARM_COLOR : p.color}
      isVisible={p.isVisible}
      isHealed={p.isHealed}
      isCharmed={p.isCharmed}
      isTeleported={p.isTeleported}
      isFalling={p.isFalling}
      dir={p.dir}
      facingDir={p.getFacingDir()}
      pieceScale={pieceScale}
      spriteSheetSrc={p.spriteSheetSrc}
      lives={p.lives}
      isGoingToSpewFire={p.isGoingToSpewFire}
      isShowHealthBarOnComponent={p.isShowHealthBarOnComponent}
    />
  );

  const shotZoom = getFitZoom(fullFrameSizes) * ((recruitScene && recruitScene.shot.zoomScale) || (gameManager.getCameraShot() || {}).zoomScale || 1);
  const overlayScale = SpeechBubbleScale / shotZoom;

  const deathPiecesComponents = recruitScene ? [] : gameManager.getDeathPieces().map(death => {
    const { key, avatar, charLocation, color, zIndex, body } = death;
    return avatar == 'kaiju' ?
      <ExplodingKaiju key={key} charLocation={charLocation} color={color} zIndex={zIndex} />
      : <DeadPlayer key={key} avatar={avatar} pieceScale={pieceScale} charLocation={gameManager.getDeathLocation(death)} angle={body ? body.angle : 0} isFlying={!!body && !body.isResting} color={color} zIndex={zIndex} />;
  });

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
        <SceneElements level={level} activePhases={activePhases} isPaused={isPaused} onHotspot={onHotspot} />
        {isSlowMotion && !recruitScene && <WinDimmer />}
        {recruitScene && <RecruitBody src={`/levels/dead/${recruitScene.body.avatar}.png`} style={{
          left: `${recruitScene.body.x}px`,
          top: `${recruitScene.body.y}px`,
          height: `${pieceScale * RECRUIT_BODY_SIZE}px`
        }} />}
        {recruitScene && (
          <RecruitPrompt style={{ left: `${recruitScene.prompt.x}px`, top: `${recruitScene.prompt.y}px`, transform: `translate(-50%, -100%) scale(${overlayScale}) translateX(${RECRUIT_PROMPT_SHIFT}px)` }}>
            {(!recruitChoice || recruitChoice == "recruit") && <RecruitButton $isRecruit onClick={() => onChooseRecruit("recruit")}>{recruitChoice ? "Confirmed" : "Recruit"}</RecruitButton>}
            {(!recruitChoice || recruitChoice == "terminate") && <RecruitButton onClick={() => onChooseRecruit("terminate")}>{recruitChoice ? "Confirmed" : "Terminate"}</RecruitButton>}
          </RecruitPrompt>
        )}
        {speech && <SpeechBalloon name={speech.name} text={speech.text} x={speech.x} y={speech.y} isFlipped={speech.isFlipped} zIndex={2147482000} scale={overlayScale} />}
        <WorldContent style={{ left: `${contentOffset.x}px`, top: `${contentOffset.y}px` }}>
          {/* canvases are sized from the zoom, which means nothing until the frame has been measured */}
          {isFrameMeasured && <TileCanvas gameManager={gameManager} level={level} tone={getTileTone(level, activePhases)} isVisible={!isPaused && !isEditingTiles} zoom={closeCamera.zoom} />}
          {isFrameMeasured && <WakeCanvas gameManager={gameManager} level={level} zoom={closeCamera.zoom} isActive={!!level.flood && activePhases.includes(level.flood.phase)} />}
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
