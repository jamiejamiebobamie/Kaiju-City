import React, { useEffect, useRef } from "react";
import styled, { keyframes } from "styled-components";

/*
  The room (Jamie, 2026-11-16): the apartment the game is played in. The landing's zoom ends in it, and from then on the
  player sits in it, looking at the Kaiju-Vision monitor, which stands on the shelf in the empty spot right of the lamp,
  the clock blinking 12:00 to its left and the coffee steaming to its right. The room is placed from the monitor's
  casing, every frame: when the monitor moves (easing aside, shifting), the room goes with it, as if the viewer moved.
  'monitor': where the casing stands in the picture (its pixels): its middle across, its bottom (the shelf's top), and
  how tall it is there.
*/
export const ROOM = {
  src: "/zoom-scene/3-room.png",
  size: { width: 1365, height: 768 },
  monitor: { centerX: 532, bottom: 582, height: 350 }, // (the clock left of it, the coffee right: Jamie)
  settleMs: 900, // from where the zoom ended to the monitor's spot
  brightness: 0.5 // behind the monitor (Jamie: much darker; a CSS filter, so it's easy to change)
};

// the zoom's last view of the room (its box on the screen, px), for the game page to start from
export const ROOM_HANDOFF = { view: undefined };

// the room's box (px) for a casing's box on the screen
export const getRoomViewFor = casing => {
  const k = casing.height / ROOM.monitor.height;
  return {
    left: casing.left + casing.width / 2 - ROOM.monitor.centerX * k,
    top: casing.bottom - ROOM.monitor.bottom * k,
    width: ROOM.size.width * k
  };
};

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
  left: `${(x / ROOM.size.width) * 100}%`,
  top: `${(y / ROOM.size.height) * 100}%`,
  width: `${(width / ROOM.size.width) * 100}%`,
  height: `${(height / ROOM.size.height) * 100}%`
});

// the room's living things, over its picture (in a box the picture's shape)
export const RoomExtras = () => (
  <>
    <ClockDigits style={at(256, 538, 100, 50)} />
    <Steam style={at(717, 470, 50, 68)}>
      {[0, 0.8, 1.6].map((delay, n) => <span key={n} style={{ left: `${20 + n * 22}%`, animationDelay: `${delay}s` }} />)}
    </Steam>
  </>
);

const Box = styled.div`
  position: fixed;
  z-index: 0;
  aspect-ratio: ${ROOM.size.width} / ${ROOM.size.height};
  background: url(${ROOM.src}) 0 0 / 100% 100%;
  image-rendering: pixelated;
  pointer-events: none;
  filter: brightness(var(--room-brightness, 1));
  transition: filter ${ROOM.settleMs}ms ease-out;
`;

const lerp = (a, b, t) => a + (b - a) * t;
const ease = t => 1 - Math.pow(1 - Math.min(Math.max(t, 0), 1), 3);

// behind the game's monitor: the room, kept placed from the casing (and settling there from the zoom's last view)
export const RoomBackdrop = () => {
  const ref = useRef(null);
  useEffect(() => {
    const from = ROOM_HANDOFF.view;
    ROOM_HANDOFF.view = undefined;
    const start = performance.now();
    let frameId;
    const place = () => {
      const box = ref.current;
      const casing = document.querySelector("[data-tv-casing]");
      if (box) {
        let view = casing && getRoomViewFor(casing.getBoundingClientRect());
        if (view && from) {
          const t = ease((performance.now() - start) / ROOM.settleMs);
          view = { left: lerp(from.left, view.left, t), top: lerp(from.top, view.top, t), width: lerp(from.width, view.width, t) };
        }
        view = view || from;
        if (view) {
          box.style.left = `${view.left}px`;
          box.style.top = `${view.top}px`;
          box.style.width = `${view.width}px`;
          box.style.visibility = "visible";
        }
      }
      frameId = requestAnimationFrame(place);
    };
    place();
    // the lights down as the view settles (from the zoom's brightness)
    const dim = requestAnimationFrame(() => ref.current && ref.current.style.setProperty("--room-brightness", String(ROOM.brightness)));
    return () => {
      cancelAnimationFrame(frameId);
      cancelAnimationFrame(dim);
    };
  }, []);
  return <Box ref={ref} aria-hidden="true" style={{ visibility: "hidden" }}><RoomExtras /></Box>;
};
