import React, { useEffect, useRef, useState } from "react";
import styled, { keyframes } from "styled-components";
import { TV_LOOK } from "Game/ReactComponents/GameBoard/PlayWindow";

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
  // (the clock left of it, the coffee right: Jamie); its bottom above the shelf, on its stand (Jamie: not floating)
  monitor: { centerX: 532, bottom: 548, height: 350, aspect: 0.98 },
  stand: { shelfTop: 582, neckWidth: 44, footWidth: 170, footHeight: 10 },
  settleMs: 900, // from where the zoom ended to the monitor's spot
  brightness: 0.5 // behind the monitor (Jamie: much darker; a CSS filter, so it's easy to change)
};

// the zoom's last view of the room (its box on the screen, px), for the game page to start from; the real casing's
// shape (width over height), for the stand-in monitor the zoom shows
export const ROOM_HANDOFF = { view: undefined, casingAspect: undefined };

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

/*
  The monitor's stand (Jamie: it was floating): a neck from its bottom down to the shelf, on a flat foot. Part of the
  room, so it's always under the monitor.
*/
const STAND_COLOR = TV_LOOK.casing;
const Neck = styled.div`
  position: absolute;
  background: linear-gradient(to right, #121110, ${STAND_COLOR} 30%, #2a2725 55%, ${STAND_COLOR} 80%, #121110);
`;
const Foot = styled.div`
  position: absolute;
  border-radius: 40% 40% 12% 12% / 70% 70% 30% 30%;
  background: ${STAND_COLOR};
  box-shadow: inset 0 0.15vh 0 ${TV_LOOK.casingLight}, 0 0.4vh 0.8vh rgba(0, 0, 0, 0.6);
`;
export const MonitorStand = () => {
  const { centerX, bottom } = ROOM.monitor;
  const { shelfTop, neckWidth, footWidth, footHeight } = ROOM.stand;
  return (
    <>
      <Neck style={at(centerX - neckWidth / 2, bottom - 4, neckWidth, shelfTop - footHeight - bottom + 6)} />
      <Foot style={at(centerX - footWidth / 2, shelfTop - footHeight, footWidth, footHeight)} />
    </>
  );
};

/*
  A stand-in for the Kaiju-Vision, dead, in its spot (Jamie: the spot was empty all through the zoom, the monitor
  popping in at its end): the zoom shows it, in and out; on the game page it sits under the real one as that fades up,
  then goes. Its shape is the real casing's (once one has been seen).
*/
const StandIn = styled.div`
  position: absolute;
  box-sizing: border-box;
  border-radius: 6% / 6%;
  background: ${TV_LOOK.casing};
  box-shadow: inset 0 0.25vh 0 ${TV_LOOK.casingLight}, 0 1vh 2.5vh rgba(0, 0, 0, 0.8);
  transition: opacity 500ms ease-out;
  &::before {
    /* the dead screen */
    content: "";
    position: absolute;
    inset: 9% 5% 7% 5%;
    border-radius: 3.5%;
    background: radial-gradient(ellipse at 35% 25%, rgba(255, 255, 255, 0.05), transparent 55%), #050606;
    box-shadow: inset 0 0 2vh rgba(0, 0, 0, 0.9);
  }
`;
export const RoomMonitor = ({ isShown = true }) => {
  const { centerX, bottom, height } = ROOM.monitor;
  const width = height * (ROOM_HANDOFF.casingAspect || ROOM.monitor.aspect);
  return <StandIn style={{ ...at(centerX - width / 2, bottom - height, width, height), opacity: isShown ? 1 : 0 }} />;
};

// the room's living things, over its picture (in a box the picture's shape)
export const RoomExtras = () => (
  <>
    <MonitorStand />
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
  const [isStandInShown, setIsStandInShown] = useState(!!ROOM_HANDOFF.view);
  useEffect(() => {
    const from = ROOM_HANDOFF.view;
    ROOM_HANDOFF.view = undefined;
    const start = performance.now();
    let frameId;
    const place = () => {
      const box = ref.current;
      const casing = document.querySelector("[data-tv-casing]");
      if (box) {
        const casingBox = casing && casing.getBoundingClientRect();
        if (casingBox && casingBox.height > 0) ROOM_HANDOFF.casingAspect = casingBox.width / casingBox.height;
        let view = casingBox && getRoomViewFor(casingBox);
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
    // the stand-in goes once the real monitor is up over it
    const standIn = setTimeout(() => setIsStandInShown(false), ROOM.settleMs + 900);
    return () => {
      cancelAnimationFrame(frameId);
      cancelAnimationFrame(dim);
      clearTimeout(standIn);
    };
  }, []);
  return <Box ref={ref} aria-hidden="true" style={{ visibility: "hidden" }}><RoomExtras /><RoomMonitor isShown={isStandInShown} /></Box>;
};
