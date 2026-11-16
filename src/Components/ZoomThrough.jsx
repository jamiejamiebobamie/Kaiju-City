import React, { useEffect, useRef } from "react";
import styled from "styled-components";
import { ROOM, ROOM_HANDOFF, RoomExtras } from "./RoomScene";

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
  fadeInMs: 80, // the first picture, under the clouds
  blendSpan: 0.8,
  pictures: [
    // Jamie's window: the lit four-pane one in the grey tower, middle (about 26 px of 1365 wide)
    { src: "/zoom-scene/1-city.png", target: { x: 727 / 1365, y: 430 / 768 }, span: Math.log(20), ms: 2200 },
    { src: "/zoom-scene/2-window.png", target: { x: 0.511, y: 0.337 }, span: Math.log(2.87), ms: 1200 }, // the top two panes
    { src: ROOM.src, target: undefined, span: undefined, ms: 1500 } // to the monitor's spot (worked out for the screen)
  ],
  size: ROOM.size
};

const getPushMs = () => ZOOM_THROUGH.pictures.reduce((sum, { ms }) => sum + ms, 0);
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

// 'startMs': when the push starts after the key (the clouds covering); 'onDone': it's over, in the room
export const ZoomThrough = ({ isOn, startMs, onDone }) => {
  const refs = useRef([]);
  useEffect(() => {
    if (!isOn) return;
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
        return zoom + span * (k == pictures.length - 1 ? 1 - Math.pow(1 - share, 2) : share);
      }
      return zoom;
    };
    const start = performance.now();
    let frameId;
    let isDone = false;
    const run = () => {
      const elapsed = performance.now() - start;
      const into = Math.max(0, elapsed - startMs);
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
        element.style.transform = `translate(${(0.5 - scale * focus.x) * 100}%, ${(0.5 - scale * focus.y) * 100}%) scale(${scale})`;
        if (k == 0) {
          element.style.opacity = String(elapsed >= startMs ? smooth((elapsed - startMs) / ZOOM_THROUGH.fadeInMs) : 0);
          return;
        }
        const blend = smooth((own + ZOOM_THROUGH.blendSpan) / ZOOM_THROUGH.blendSpan);
        element.style.opacity = String(blend);
        // feathered while it blends in: a soft oval, opening to the whole picture as it takes over
        const mask = blend < 1 ? `radial-gradient(ellipse 75% 75% at 50% 50%, black ${30 + 70 * blend}%, transparent 100%)` : "none";
        element.style.maskImage = mask;
        element.style.webkitMaskImage = mask;
      });
      if (into < pushMs) {
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
      <Frame>
        {ZOOM_THROUGH.pictures.map(({ src }, k) => (
          <Picture key={src} ref={element => { refs.current[k] = element; }} style={{ backgroundImage: `url(${src})` }}>
            {k == ZOOM_THROUGH.pictures.length - 1 && <RoomExtras />}
          </Picture>
        ))}
      </Frame>
    </Stage>
  );
};
