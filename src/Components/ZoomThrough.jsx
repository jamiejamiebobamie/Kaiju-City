import React, { useEffect, useRef } from "react";
import styled, { keyframes } from "styled-components";
import { ROOM, ROOM_HANDOFF, RoomExtras, RoomMonitor } from "./RoomScene";

// Leave (Jamie): the way back to the landing is the zoom backwards, quicker; set before the landing shows
// 'fromView': the room's box (px) as the game page's pull-back left it, the way back blending on from there
export const ZOOM_BACK = { isPending: false, speed: 1.7, cityFadeMs: 500, fromView: undefined, blendMs: 700 };

/*
  The landing's extreme zoom (Jamie, 2026-11-16): after the logo's zoom and the clouds, one camera push through three
  pictures, each zooming and blending into the next: the city (into Jamie's lit window), the window (into its top two
  panes), then the room behind them, where it stops: the monitor's spot right of the lamp, the clock and the coffee in
  shot (the game page then puts the monitor there: RoomScene).
  The push is one zoom, counted in its log (so it feels steady). Each picture takes over at the zoom where its first
  view matches the last one's end: 'span', its own zoom (as a log) to its 'target' (shares of the picture), which moves
  to the screen's middle as it zooms. A picture blends in over 'blendSpan' of zoom before it takes over, its edges
  feathered (a soft oval) so its rectangle never shows, opening up as it takes over (Jamie: a blend by their alphas).
*/
export const ZOOM_THROUGH = {
  fadeInMs: 450, // the first picture, as the clouds sweep past
  blendSpan: 0.8,
  pictures: [
    // Jamie's window: the lit four-pane one in the grey tower, middle (about 26 px of 1365 wide)
    { src: "/zoom-scene/1-city.png", target: { x: 727 / 1365, y: 430 / 768 }, span: Math.log(20), ms: 3000 }, // (eases in: longer, was 2200)
    { src: "/zoom-scene/2-window.png", target: { x: 0.511, y: 0.337 }, span: Math.log(2.87), ms: 1200 }, // the top two panes
    { src: ROOM.src, target: undefined, span: undefined, ms: 1500 } // to the monitor's spot (worked out for the screen)
  ],
  size: ROOM.size
};

const getPushMs = () => ZOOM_THROUGH.pictures.reduce((sum, { ms }) => sum + ms, 0);
// the way back's length, and when its city has faded (the landing's skyline zooms back out from there: MainMenu)
export const getZoomBackMs = () => getPushMs() / ZOOM_BACK.speed;
export const getZoomThroughMs = startMs => startMs + getPushMs();

/*
  The room's last view: as the game page will have it, the monitor (about 0.8 of the screen's height, in its middle)
  standing in its spot. In the pictures' frame (it covers the screen): its zoom, and the picture's point at the middle.
*/
const getRoomEnd = () => {
  const screen = { width: window.innerWidth, height: window.innerHeight };
  const frameWidth = Math.max(screen.width, screen.height * (ROOM.size.width / ROOM.size.height));
  const k = (0.8 * screen.height) / ROOM.monitor.height; // screen px for the picture's px
  const zoom = (k * ROOM.size.width) / frameWidth;
  const middle = { x: ROOM.monitor.centerX, y: ROOM.monitor.bottom - ROOM.monitor.height / 2 };
  return { span: Math.log(Math.max(zoom, 1.05)), target: { x: middle.x / ROOM.size.width, y: middle.y / ROOM.size.height } };
};

const smooth = x => {
  const t = Math.max(0, Math.min(1, x));
  return t * t * (3 - 2 * t);
};

const Stage = styled.div`
  position: fixed;
  inset: 0;
  z-index: 15;
  overflow: hidden;
  pointer-events: none;
`;

// the pictures' frame: their shape, covering the screen, centered
const Frame = styled.div`
  position: absolute;
  left: 50%;
  top: 50%;
  width: max(100vw, calc(100vh * ${ZOOM_THROUGH.size.width / ZOOM_THROUGH.size.height}));
  aspect-ratio: ${ZOOM_THROUGH.size.width} / ${ZOOM_THROUGH.size.height};
  transform: translate(-50%, -50%);
`;

const Picture = styled.div`
  position: absolute;
  inset: 0;
  transform-origin: 0 0;
  opacity: 0;
  background-size: 100% 100%;
  image-rendering: pixelated;
  will-change: transform, opacity;
`;

/*
  The zoom's clouds (Jamie, after the Simpsons' opening): a few, quick and sparse, sweeping in from both sides and on
  past the camera as it zooms, adding detail to the logo's city as it comes, a little distraction as the logo fades out
  and the city's picture fades in. Not the cloud transition (they never cover the screen). Each: its side, its height
  (share of the screen), its size (vh), its delay.
*/
const CLOUDS = {
  ms: 1100,
  startMs: 650, // after the key
  puffs: [
    { side: -1, y: 0.2, size: 20, delay: 0 }, { side: 1, y: 0.3, size: 24, delay: 60 },
    { side: -1, y: 0.72, size: 26, delay: 120 }, { side: 1, y: 0.78, size: 20, delay: 170 },
    { side: -1, y: 0.46, size: 16, delay: 220 }, { side: 1, y: 0.08, size: 18, delay: 260 }
  ]
};
const sweep = keyframes`
  0% { transform: translate(calc(var(--side) * 70vw), 0) scale(0.6); opacity: 0; }
  25% { opacity: 0.8; }
  60% { opacity: 0.7; }
  100% { transform: translate(calc(var(--side) * 30vw), 0) scale(2); opacity: 0; }
`;
const Puff = styled.div`
  position: absolute;
  left: 50%;
  aspect-ratio: 2 / 1;
  margin-left: calc(var(--size) * -1);
  margin-top: calc(var(--size) * -0.5);
  /* a pixel-edged cloud: a few round lobes, white to a lavender underside */
  background:
    radial-gradient(circle at 30% 60%, #f4f0ff 0 28%, transparent 29%),
    radial-gradient(circle at 52% 42%, #ffffff 0 30%, transparent 31%),
    radial-gradient(circle at 72% 62%, #ebe4ff 0 25%, transparent 26%),
    radial-gradient(ellipse 48% 22% at 50% 78%, #c9bde8 0 98%, transparent 100%);
  image-rendering: pixelated;
  filter: drop-shadow(0 0.6vh 0 rgba(120, 96, 170, 0.45));
  opacity: 0;
  animation: ${sweep} ${CLOUDS.ms}ms cubic-bezier(0.3, 0, 0.6, 1) forwards;
`;
// 'isReverse': the way back, the sweep played backwards (from by the camera out to the sides), from 'startMs'
const Clouds = ({ isReverse = false, startMs = CLOUDS.startMs }) => (
  <>
    {CLOUDS.puffs.map(({ side, y, size, delay }, k) => (
      <Puff key={k} style={{ top: `${y * 100}%`, width: `${size * 2}vh`, "--size": `${size}vh`, "--side": side, animationDelay: `${startMs + delay}ms`, animationDirection: isReverse ? "reverse" : undefined, animationFillMode: isReverse ? "both" : undefined }} />
    ))}
  </>
);

// 'startMs': when the push starts after the key (as the clouds sweep past); 'onDone': it's over, in the room
// 'isReverse': backwards, from the room out to the city, which then fades away to the landing
export const ZoomThrough = ({ isOn, startMs, onDone, isReverse = false }) => {
  const refs = useRef([]);
  const frameRef = useRef(null);
  useEffect(() => {
    if (!isOn) return;
    const fromView = isReverse ? ZOOM_BACK.fromView : undefined;
    ZOOM_BACK.fromView = undefined;
    const room = getRoomEnd();
    const pictures = ZOOM_THROUGH.pictures.map(picture => picture.span === undefined ? { ...picture, ...room } : picture);
    const pushMs = getPushMs();
    // the zoom (as a log) at a time into the push: each picture's span in its own time, steady; the last eases to a stop
    const getZoomAt = ms => {
      let zoom = 0;
      let left = ms;
      for (const [k, { span, ms: own }] of pictures.entries()) {
        if (left >= own) {
          zoom += span;
          left -= own;
          continue;
        }
        const share = left / own;
        // the first eases in (Jamie, playtest 29: a slow, dramatic start), speeding up to just the next one's pace as it
        // hands over: a cubic with no speed at its start and the next picture's at its end
        if (k == 0 && pictures.length > 1) {
          const next = pictures[1];
          const endSlope = Math.max(0.2, Math.min(2.8, ((next.span / next.ms) * own) / span));
          return zoom + span * ((3 - endSlope) * share * share + (endSlope - 2) * share * share * share);
        }
        return zoom + span * (k == pictures.length - 1 ? 1 - Math.pow(1 - share, 2) : share);
      }
      return zoom;
    };
    const start = performance.now();
    let frameId;
    let isDone = false;
    const run = () => {
      const elapsed = performance.now() - start;
      const into = isReverse ? Math.max(0, pushMs - elapsed * ZOOM_BACK.speed) : Math.max(0, elapsed - startMs);
      const zoom = getZoomAt(Math.min(into, pushMs));
      let before = 0;
      pictures.forEach(({ target, span }, k) => {
        const element = refs.current[k];
        const own = zoom - before; // this picture's own zoom, as a log
        before += span;
        if (!element) return;
        const scale = Math.exp(own);
        const share = Math.max(0, Math.min(1, own / span));
        const focus = { x: 0.5 + (target.x - 0.5) * share, y: 0.5 + (target.y - 0.5) * share };
        let view = { x: 0.5 - scale * focus.x, y: 0.5 - scale * focus.y, scale };
        // backwards, the room starts where the game page left it and blends onto the way back's path
        if (fromView && k == pictures.length - 1 && frameRef.current) {
          const frame = frameRef.current.getBoundingClientRect();
          const from = { x: (fromView.left - frame.left) / frame.width, y: (fromView.top - frame.top) / frame.height, scale: fromView.width / frame.width };
          const t = smooth(elapsed / ZOOM_BACK.blendMs);
          view = { x: from.x + (view.x - from.x) * t, y: from.y + (view.y - from.y) * t, scale: from.scale + (view.scale - from.scale) * t };
        }
        element.style.transform = `translate(${view.x * 100}%, ${view.y * 100}%) scale(${view.scale})`;
        if (k == 0) {
          element.style.opacity = String(isReverse
            ? smooth(into / ZOOM_BACK.cityFadeMs)
            : elapsed >= startMs ? smooth((elapsed - startMs) / ZOOM_THROUGH.fadeInMs) : 0);
          return;
        }
        // backwards, the room starts as dark as it was behind the monitor and brightens as it pulls away
        if (isReverse && k == pictures.length - 1) element.style.filter = `brightness(${ROOM.brightness + (1 - ROOM.brightness) * smooth(elapsed / 700)})`;
        const blend = smooth((own + ZOOM_THROUGH.blendSpan) / ZOOM_THROUGH.blendSpan);
        element.style.opacity = String(blend);
        // feathered while it blends in: a soft oval, opening to the whole picture as it takes over
        const mask = blend < 1 ? `radial-gradient(ellipse 75% 75% at 50% 50%, black ${30 + 70 * blend}%, transparent 100%)` : "none";
        element.style.maskImage = mask;
        element.style.webkitMaskImage = mask;
      });
      if (isReverse) {
        if (into > 0) frameId = requestAnimationFrame(run);
        else if (!isDone) {
          isDone = true;
          onDone && onDone();
        }
      } else if (into < pushMs) {
        frameId = requestAnimationFrame(run);
      } else if (!isDone) {
        isDone = true;
        // where the room is on the screen now, for the game page to start from
        const last = refs.current[pictures.length - 1];
        if (last) {
          const box = last.getBoundingClientRect();
          ROOM_HANDOFF.view = { left: box.left, top: box.top, width: box.width };
        }
        onDone && onDone();
      }
    };
    frameId = requestAnimationFrame(run);
    return () => cancelAnimationFrame(frameId);
  }, [isOn]);

  if (!isOn) return null;
  return (
    <Stage aria-hidden="true">
      <Frame ref={frameRef}>
        {ZOOM_THROUGH.pictures.map(({ src }, k) => (
          <Picture key={src} ref={element => { refs.current[k] = element; }} style={{ backgroundImage: `url(${src})` }}>
            {k == ZOOM_THROUGH.pictures.length - 1 && <><RoomExtras /><RoomMonitor /></>}
          </Picture>
        ))}
      </Frame>
      {isReverse ? <Clouds isReverse startMs={getZoomBackMs() - 650} /> : <Clouds />}
    </Stage>
  );
};
