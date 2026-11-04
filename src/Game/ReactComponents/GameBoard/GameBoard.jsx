import React, { useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import styled, { css, keyframes } from "styled-components";
import { DeadPlayer } from "./Pieces/DeadPlayerPiece";
import { ExplodingKaiju } from "./Pieces/ExplodingKaijuPiece";
import { PauseModal } from "./PauseModal";
import { GameBoardPieceComponent } from 'Game/ReactComponents/GameBoard/Pieces/GameBoardPieceComponent'
import { getSpeechScreenBox, PagedSpeechBalloon, SpeechBalloon } from 'Game/ReactComponents/GameBoard/SceneElements';
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
const RECRUIT_BODY_SIZE = 70; // at a 'pieceScale' of 1: the body then lies about as long as a character stands tall
const RECRUIT_LOOK_LEAN = 0.08; // how far the choice's camera leans with the mouse

// a shot with words in it keeps the whole balloon and the spot in view
const SHOT_FIT = {
  margin: 0.06, // room kept around them, as a fraction of the view
  feetRoomPx: 40, // the spot is usually someone's feet: a little floor under them too
  zoomStep: 0.94, // it pulls out this much at a time until everything fits
  maxSteps: 30
};
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

// the choice locks in: both buttons go, the chosen word flies to the middle and grows,
// the screen washes over in its color, and the word finishes itself in milk white
const RECRUIT_LOOK = {
  recruit: { button: "#2f7d57", wash: "rgba(38, 120, 52, 0.88)", suffix: "ED" }, // leaf green
  terminate: { button: "#a01230", wash: "rgba(120, 0, 12, 0.88)", suffix: "D" }, // blood red
  milk: "#f6f1e1",
  fadeMs: 250,
  flyMs: 900,
  washMs: 1200,
  suffixDelayMs: 1000,
  wordPx: 96 // the word's size in the middle of the screen
};

const RecruitButton = styled.button`
  padding: 12px 22px;
  font-family: gameboy;
  font-size: 22px;
  cursor: pointer;
  color: #fbfbf0;
  background: ${props => RECRUIT_LOOK[props.$choice].button};
  border: 4px solid #101018;
  box-shadow: 0 4px 0 #101018;
  opacity: ${props => props.$isGone ? 0 : 1};
  pointer-events: ${props => props.$isGone ? "none" : "auto"};
  transition: opacity ${RECRUIT_LOOK.fadeMs}ms;
  &:hover {
    filter: brightness(1.3);
  }
`;

const washIn = keyframes`
  from { opacity: 0; }
  to { opacity: 1; }
`;

const ChoiceWash = styled.div`
  position: absolute;
  inset: 0;
  z-index: 2147482400;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  animation: ${washIn} ${RECRUIT_LOOK.washMs}ms ease-in both;
`;

// from where the button was to the middle, growing as it goes
const wordFly = keyframes`
  from { transform: translate(var(--from-x), var(--from-y)) scale(var(--from-scale)); color: #fbfbf0; }
  to { transform: translate(0, 0) scale(1); color: ${RECRUIT_LOOK.milk}; }
`;

const ChoiceWord = styled.div`
  position: absolute;
  z-index: 2147482450;
  left: 50%;
  top: 50%;
  margin: 0;
  font-family: gameboy;
  font-size: ${RECRUIT_LOOK.wordPx}px;
  white-space: nowrap;
  pointer-events: none;
  text-shadow: 0 6px 0 #101018;
  translate: -50% -50%;
  animation: ${wordFly} ${RECRUIT_LOOK.flyMs}ms cubic-bezier(0.3, 0, 0.2, 1) both;
`;

const suffixArrive = keyframes`
  from { opacity: 0; transform: scale(1.8); }
  to { opacity: 1; transform: scale(1); }
`;

const ChoiceSuffix = styled.span`
  display: inline-block;
  animation: ${suffixArrive} 0.3s ease-out ${RECRUIT_LOOK.suffixDelayMs}ms both;
`;

const CHOICE_WORDS = { recruit: "Recruit", terminate: "Terminate" };

const ChoiceButton = ({ choice, recruitChoice, onChooseRecruit }) => (
  <RecruitButton $choice={choice} $isGone={!!recruitChoice} onClick={event => onChooseRecruit(choice, event.currentTarget.getBoundingClientRect())}>
    {CHOICE_WORDS[choice]}
  </RecruitButton>
);

// 'from': where the pressed button was on the page, so the word starts there
const ChoiceConfirm = ({ choice, from, board }) => {
  const boardBox = board.getBoundingClientRect();
  const fromX = from ? from.left + from.width / 2 - (boardBox.left + boardBox.width / 2) : 0;
  const fromY = from ? from.top + from.height / 2 - (boardBox.top + boardBox.height / 2) : 0;
  const fromScale = from ? Math.min(from.height / (RECRUIT_LOOK.wordPx * 1.6), 1) : 0.3;
  return (
    <>
      <ChoiceWash style={{ background: RECRUIT_LOOK[choice].wash }} />
      <ChoiceWord style={{ "--from-x": `${fromX}px`, "--from-y": `${fromY}px`, "--from-scale": fromScale }}>
        {CHOICE_WORDS[choice].toUpperCase()}<ChoiceSuffix>{RECRUIT_LOOK[choice].suffix}</ChoiceSuffix>
      </ChoiceWord>
    </>
  );
};

const getClosestEnemy = (player, pieces) => {
  const getDistance = ({ charLocation: { x, y } }) => Math.hypot(x - player.charLocation.x, y - player.charLocation.y);
  return pieces
    .filter(piece => piece.getTeamIndex() != player.getTeamIndex() && !piece.isDead && piece.isOnTiles)
    .reduce((closest, piece) => !closest || getDistance(piece) < getDistance(closest) ? piece : closest, undefined);
};


// the Agent's ray: a flickering beam from him to each of the team
const rayFlicker = keyframes`
  0%, 100% { opacity: 0.95; }
  30% { opacity: 0.55; }
  60% { opacity: 1; }
`;

const RayBeams = styled.svg`
  position: absolute;
  left: 0;
  top: 0;
  z-index: 2147481000;
  overflow: visible;
  pointer-events: none;
  animation: ${rayFlicker} 0.18s steps(2) infinite;
`;

const MOVEMENT_KEYS = ["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowLeft", "ArrowDown", "ArrowRight"];

const getIsTouchScreen = () => window.matchMedia("(pointer: coarse)").matches;

export const GameBoard = ({ isWindowOpen = true, isPaused, gameManager, level, activePhases, isWholeScene, playWindow, isShowingWindowSize, isEditingTiles, isMouseLook, isEnemyZoom, isSlowMotion, isTeamColors, speech, recruitScene, recruitChoice, onChooseRecruit, onHotspot }) => {
  // redraws the pieces when the game updates. the tiles draw themselves.
  useSyncExternalStore(gameManager.subscribeToBoard, gameManager.getBoardRevision);
  const pieces = gameManager.getPieces();

  const boardRef = useRef(null);
  const choiceFrom = useRef(undefined); // where the pressed Recruit or Terminate button was
  const chooseRecruit = (choice, buttonBox) => {
    if (recruitChoice) return;
    choiceFrom.current = buttonBox;
    onChooseRecruit(choice);
  };
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

  // the window opens up to the whole frame for wide shots, unless the monitor always stays: then every shot is framed inside it
  const shotView = isWindowOpen ? { viewWidth: frame.width, viewHeight: frame.height } : { viewWidth: windowWidth, viewHeight: windowHeight };

  const wideCamera = useMemo(() => {
    const sizes = { ...worldSizes, ...shotView };
    const camera = new Camera({ ...sizes, zoom: getFitZoom(sizes) });
    camera.centerOn({ x: world.width / 2, y: world.height / 2 });
    return camera;
  }, [level, frame, isWindowOpen, playWindow]);

  // walking scenes are made to be seen whole
  const getIsWholeLevelInView = () => (level.isWalkingLevel && !level.isMapWalk) || gameManager.getIsWideShot();
  const isWideShot = getIsWholeLevelInView();
  const camera = isWideShot ? wideCamera : closeCamera;

  // the camera for a cutscene's shot: it looks at a spot, and can lean with the mouse
  const fullFrameSizes = { worldWidth: world.width, worldHeight: world.height, ...shotView };
  // with words on screen, the shot looks between the spot and the balloon, and pulls out until both fit
  const speechRef = useRef(speech);
  speechRef.current = speech; // the camera's loop is set up once, and reads the words from here
  const getShotFraming = ({ point, zoomScale }) => {
    const fitZoom = getFitZoom(fullFrameSizes);
    let zoom = fitZoom * zoomScale;
    const speech = speechRef.current;
    if (!speech) return { zoom, center: point };
    const box = getSpeechScreenBox(speech, SpeechBubbleScale);
    const usedWidth = shotView.viewWidth * (1 - SHOT_FIT.margin * 2);
    const usedHeight = shotView.viewHeight * (1 - SHOT_FIT.margin * 2);
    let center = point;
    for (let step = 0; step < SHOT_FIT.maxSteps; step += 1) {
      const left = Math.min(point.x, speech.x + box.left / zoom);
      const right = Math.max(point.x, speech.x + box.right / zoom);
      const top = Math.min(point.y, speech.y + box.top / zoom);
      const bottom = Math.max(point.y + SHOT_FIT.feetRoomPx, speech.y + box.bottom / zoom);
      center = { x: (left + right) / 2, y: (top + bottom) / 2 };
      const isFitting = (right - left) * zoom <= usedWidth && (bottom - top) * zoom <= usedHeight;
      if (isFitting || zoom <= fitZoom) break;
      zoom = Math.max(zoom * SHOT_FIT.zoomStep, fitZoom);
    }
    return { zoom, center };
  };

  const getShotCamera = shot => {
    const { zoom, center } = getShotFraming(shot);
    const shotCamera = new Camera({ ...fullFrameSizes, zoom });
    const lean = shot.isFollowingMouse ? shotView.viewWidth / shotCamera.zoom * RECRUIT_LOOK_LEAN : 0;
    shotCamera.centerOn({ x: center.x + mouseAim.current.x * lean, y: center.y + mouseAim.current.y * lean });
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
  const isChoosingRef = useRef(false);
  isChoosingRef.current = !!recruitScene;
  useEffect(() => {
    const move = e => {
      document.body.style.cursor = "";
      if (boardRef.current) boardRef.current.style.cursor = isChoosingRef.current ? "pointer" : "";
      mouseHandlers.current.handleMouseMove(e);
    };
    // browsers can't move the cursor, so it hides while the keys are in charge. not at the Recruit or Terminate choice: the hand stays there.
    const hideCursor = ({ code }) => {
      if (!MOVEMENT_KEYS.includes(code) || isChoosingRef.current) return;
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
      isQuiet={!!recruitScene}
    />
  );

  const currentShot = gameManager.getCameraShot();
  const shotZoom = currentShot && !currentShot.isWide ? getShotFraming(currentShot).zoom : getFitZoom(fullFrameSizes) * ((recruitScene && recruitScene.shot.zoomScale) || 1);
  const overlayScale = SpeechBubbleScale / shotZoom;

  // a balloon is kept inside the scene: near an edge, it slides in (the tail still starts from the same spot on it)
  const getSpeechX = currentSpeech => {
    const box = getSpeechScreenBox(currentSpeech, overlayScale);
    const margin = world.width * 0.02;
    const pastLeft = Math.max(margin - (currentSpeech.x + box.left), 0);
    const pastRight = Math.max(currentSpeech.x + box.right - (world.width - margin), 0);
    return currentSpeech.x + pastLeft - pastRight;
  };

  const deathPiecesComponents = recruitScene ? [] : gameManager.getDeathPieces().map(death => {
    const { key, avatar, charLocation, color, zIndex, body } = death;
    return avatar == 'kaiju' ?
      <ExplodingKaiju key={key} charLocation={charLocation} color={color} zIndex={zIndex} />
      : <DeadPlayer key={key} avatar={avatar} pieceScale={pieceScale} charLocation={charLocation} body={body} spriteSheetSrc={death.spriteSheetSrc} color={color} zIndex={zIndex} />;
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
      ref={boardRef}
      style={recruitScene ? { cursor: "pointer" } : undefined}>
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
            <ChoiceButton choice="recruit" recruitChoice={recruitChoice} onChooseRecruit={chooseRecruit} />
            <ChoiceButton choice="terminate" recruitChoice={recruitChoice} onChooseRecruit={chooseRecruit} />
          </RecruitPrompt>
        )}
        {gameManager.getRayBeam() && (() => {
          const { from, color, targets } = gameManager.getRayBeam();
          return (
            <RayBeams width={world.width} height={world.height}>
              {targets.map(({ x, y }, k) => (
                <g key={k}>
                  <line x1={from.x} y1={from.y} x2={x} y2={y} stroke={color} strokeWidth={18} strokeOpacity={0.35} strokeLinecap="round" />
                  <line x1={from.x} y1={from.y} x2={x} y2={y} stroke="white" strokeWidth={5} strokeLinecap="round" />
                  <circle cx={x} cy={y} r={26} fill={color} fillOpacity={0.45} />
                </g>
              ))}
              <circle cx={from.x} cy={from.y} r={16} fill="white" />
            </RayBeams>
          );
        })()}
        {speech && (speech.lines
          ? <PagedSpeechBalloon name={speech.name} lines={speech.lines} x={getSpeechX(speech)} y={speech.y} isFlipped={speech.isFlipped} zIndex={2147482000} scale={overlayScale} />
          : <SpeechBalloon name={speech.name} text={speech.text} x={getSpeechX(speech)} y={speech.y} isFlipped={speech.isFlipped} zIndex={2147482000} scale={overlayScale} />)}
        <WorldContent style={{ left: `${contentOffset.x}px`, top: `${contentOffset.y}px` }}>
          {/* canvases are sized from the zoom, which means nothing until the frame has been measured */}
          {isFrameMeasured && <TileCanvas gameManager={gameManager} level={level} tone={getTileTone(level, activePhases)} isVisible={!isPaused && !isEditingTiles} zoom={closeCamera.zoom} isTeamColors={isTeamColors} />}
          {isFrameMeasured && <WakeCanvas gameManager={gameManager} level={level} zoom={closeCamera.zoom} isActive={!!level.flood && activePhases.includes(level.flood.phase)} />}
          {piecesComponents}
          {deathPiecesComponents}
        </WorldContent>
      </World>
      </SceneShake>
      {recruitScene && recruitChoice && <ChoiceConfirm choice={recruitChoice} from={choiceFrom.current} board={boardRef.current} />}
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
