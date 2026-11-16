import React, { useEffect, useRef } from "react";
import styled, { keyframes } from "styled-components";

/*
  The landing's extreme zoom (Jamie, 2026-11-16): on from the skyline, one camera push through three pictures, each
  zooming and cross-fading into the next so they overlap and blend: the city (into a lit window), the window (into its
  top two panes), then the room behind them (into the empty spot right of the desk lamp, where the Kaiju-Vision monitor
  stands: the player plays on a monitor in someone's apartment in this city).
  The push is one zoom, counted in its log (so it feels steady), sped up as it goes. Each picture takes over at the
  zoom where its first view matches the last one's end: 'span', its own zoom (as a log) to its 'target' (shares of the
  picture). A picture's spot moves to the screen's middle as it zooms.
  The room has two small things alive in it (Jamie): steam off the coffee, and a clock blinking 12:00 (the power went
  out and nobody reset it).
*/
export const ZOOM_THROUGH = {
  startMs: 900, // after the key: the landing's own zoom is well under way
  fadeInMs: 400, // the first picture over the landing's skyline
  blendSpan: 0.35, // a picture fades in over this much zoom (as a log) before it takes over
  // each its own time (the room's longest: its things seen before the push into the spot)
  pictures: [
    // Jamie's window: the lit four-pane one in the grey tower, middle (about 26 px of 1365 wide)
    { src: "/zoom-scene/1-city.png", target: { x: 727 / 1365, y: 430 / 768 }, span: Math.log(20), ms: 1500 },
    { src: "/zoom-scene/2-window.png", target: { x: 0.511, y: 0.337 }, span: Math.log(2.87), ms: 1100 }, // the top two panes
    { src: "/zoom-scene/3-room.png", target: { x: 0.381, y: 0.528 }, span: Math.log(4), ms: 1500 } // right of the lamp
  ],
  size: { width: 1365, height: 768 }
};
const PUSH_MS = ZOOM_THROUGH.pictures.reduce((sum, { ms }) => sum + ms, 0);
export const getZoomThroughMs = () => ZOOM_THROUGH.startMs + PUSH_MS;

// the zoom (as a log) at a time into the push: each picture's span in its own time, steady, the first easing in
const getZoomAt = ms => {
  let zoom = 0;
  let left = ms;
  for (const [k, { span, ms: own }] of ZOOM_THROUGH.pictures.entries()) {
    if (left >= own) {
      zoom += span;
      left -= own;
      continue;
    }
    const share = left / own;
    return zoom + span * (k == 0 ? share * share : share);
  }
  return zoom;
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

// the clock: 12:00, blinking, as one that lost its power
const blink = keyframes`
  0%, 49% { opacity: 1; }
  50%, 100% { opacity: 0; }
`;
const ClockDigits = styled.div`
  position: absolute;
  background: url(/zoom-scene/3-room-clock.png) 0 0 / 100% 100%;
  image-rendering: pixelated;
  filter: drop-shadow(0 0 3px rgba(255, 40, 30, 0.9));
  animation: ${blink} 1s steps(1) infinite;
`;

// the coffee's steam: a few soft pixel wisps rising and swaying, fading out
const rise = keyframes`
  0% { transform: translate(0, 0); opacity: 0; }
  20% { opacity: 0.55; }
  50% { transform: translate(35%, -45%); }
  100% { transform: translate(-25%, -100%); opacity: 0; }
`;
const Steam = styled.div`
  position: absolute;
  span {
    position: absolute;
    bottom: 0;
    width: 22%;
    height: 22%;
    background: rgba(240, 236, 228, 0.85);
    filter: blur(0.5px);
    animation: ${rise} 2.4s ease-out infinite;
  }
`;

// a spot in the room's picture, as shares of it
const at = (x, y, width, height) => ({
  left: `${(x / ZOOM_THROUGH.size.width) * 100}%`,
  top: `${(y / ZOOM_THROUGH.size.height) * 100}%`,
  width: `${(width / ZOOM_THROUGH.size.width) * 100}%`,
  height: `${(height / ZOOM_THROUGH.size.height) * 100}%`
});

// 'isOn': the key's been pressed; 'onDone': the push is over
export const ZoomThrough = ({ isOn }) => {
  const refs = useRef([]);
  useEffect(() => {
    if (!isOn) return;
    const start = performance.now();
    let frameId;
    const run = () => {
      const elapsed = performance.now() - start;
      const into = Math.max(0, elapsed - ZOOM_THROUGH.startMs);
      const progress = into / PUSH_MS;
      const zoom = getZoomAt(into);
      let before = 0;
      ZOOM_THROUGH.pictures.forEach(({ target, span }, k) => {
        const element = refs.current[k];
        const own = zoom - before; // this picture's own zoom, as a log
        before += span;
        if (!element) return;
        const scale = Math.exp(own);
        const share = Math.max(0, Math.min(1, own / span));
        const focus = { x: 0.5 + (target.x - 0.5) * share, y: 0.5 + (target.y - 0.5) * share };
        element.style.transform = `translate(${(0.5 - scale * focus.x) * 100}%, ${(0.5 - scale * focus.y) * 100}%) scale(${scale})`;
        const opacity = k == 0
          ? smooth((elapsed - ZOOM_THROUGH.startMs) / ZOOM_THROUGH.fadeInMs)
          : smooth((own + ZOOM_THROUGH.blendSpan) / ZOOM_THROUGH.blendSpan);
        element.style.opacity = String(opacity);
      });
      if (progress < 1) frameId = requestAnimationFrame(run);
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
            {k == 2 && (
              <>
                <ClockDigits style={at(300, 538, 100, 50)} />
                <Steam style={at(705, 470, 50, 68)}>
                  {[0, 0.8, 1.6].map((delay, n) => <span key={n} style={{ left: `${20 + n * 22}%`, animationDelay: `${delay}s` }} />)}
                </Steam>
              </>
            )}
          </Picture>
        ))}
      </Frame>
    </Stage>
  );
};
