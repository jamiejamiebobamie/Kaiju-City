import React, { useEffect, useRef, useState } from "react";
import styled, { keyframes } from "styled-components";
import { TV_LOOK } from "Game/ReactComponents/GameBoard/PlayWindow";
import { APARTMENT_TRIAL } from "Game/DataClasses/apartmentTrial";
import { getEdgeFade } from "Utils/stage";
import { resetCamera, stepCamera } from "Utils/camera";

// how much of the room picture's width and height its edges fade over (where they show: odd-shaped windows)
const ROOM_EDGE_FADE = 0.025;

/*
  The room (Jamie, 2026-11-16): the apartment the game is played in. The landing's zoom ends in it, and from then on the
  player sits in it, looking at the Kaiju-Vision monitor, which stands on the shelf in the empty spot right of the lamp,
  the clock blinking 12:00 to its left and the coffee steaming to its right. The room is placed from the monitor's
  casing, every frame: when the monitor moves (easing aside, shifting), the room goes with it, as if the viewer moved.
  'monitor': where the casing stands in the picture (its pixels): its middle across, its bottom (the shelf's top), and
  how tall it is there.
*/
// 'clockDigits', 'steam': where the clock's 12:00 and the coffee's steam go (x, y, width, height); 'hasOwnMonitor': the
// picture has the monitor and its stand in it (no stand drawn, no stand-in monitor in the zoom); 'blackLight': the
// purple tube's place (x, y, width, height), for its flicker (BlackLight)
export const OLD_ROOM = {
  src: "/zoom-scene/3-room-old.png", // (the Lab computer's desk is still built on it)
  size: { width: 1365, height: 768 },
  // (the clock left of it, the coffee right: Jamie); its bottom above the shelf, on its stand (Jamie: not floating)
  monitor: { centerX: 532, bottom: 548, height: 350, aspect: 0.98 },
  // (chunkier, retro: a thick neck, a swivel collar under the set, a broad heavy foot. Jamie, playtest 29)
  stand: { shelfTop: 582, neckWidth: 78, footWidth: 250, footHeight: 18, collarWidth: 130, collarHeight: 12 },
  clockDigits: [256, 538, 100, 50],
  steam: [717, 470, 50, 68],
  hasOwnMonitor: false,
  blackLight: undefined,
  settleMs: 900, // from where the zoom ended to the monitor's spot
  brightness: 0.5 // behind the monitor (Jamie: much darker; a CSS filter, so it's easy to change)
};

/*
  The new apartment (Jamie, 2026-11-25): laid out in the mock-up tool (/apartment), relit by Jamie, put together from
  three of the relit pictures (scripts/apartmentComposite.py). Tried with ?apartment (APARTMENT_TRIAL) until it's the
  game's own.
*/
const clockScale = APARTMENT_TRIAL && APARTMENT_TRIAL.clock ? APARTMENT_TRIAL.clock.scale || 1 : 1;
const NEW_ROOM = APARTMENT_TRIAL && {
  ...OLD_ROOM,
  src: "/zoom-scene/3-room.png", // (scripts/apartmentComposite.py's, approved by Jamie)
  front: "/zoom-scene/3-room-front.png", // what's in front of the monitor (scripts/apartmentFront.py): drawn over it
  monitor: { aspect: 0.98, ...APARTMENT_TRIAL.monitor },
  clockDigits: APARTMENT_TRIAL.clock ? [APARTMENT_TRIAL.clock.x + 2 * clockScale, APARTMENT_TRIAL.clock.y + 2 * clockScale, 100 * clockScale, 50 * clockScale] : OLD_ROOM.clockDigits,
  steam: [794, 493, 62, 120], // (over the relit mug: the pictures made Jamie's stand-in mug a real one, a little lower)
  hasOwnMonitor: true,
  blackLight: [893, 26, 400, 30]
};
export const ROOM = NEW_ROOM || OLD_ROOM;

// the zoom's last view of the room (its box on the screen, px), for the game page to start from; the real casing's
// shape (width over height), for the stand-in monitor the zoom shows
export const ROOM_HANDOFF = { view: undefined, casingAspect: undefined, isFrozen: false };

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

/*
  The coffee's steam (Jamie, 2026-11-25: a different steam, as his references: curly wavy lines, 8-bit): thin pixel
  strands, each a wavy line that rises off the cup, its curls travelling up it, fading in at the cup and out as it
  climbs; a new one starts as one goes. Drawn on a small canvas (a pixel of it is STEAM.roomPx of the picture's), at a
  stepped frame rate, so it's as chunky as the picture.
*/
const STEAM = {
  roomPx: 2, // picture px per steam px
  fps: 12,
  strands: 3,
  lifeMs: [2600, 3600], // (each strand's, picked)
  length: 0.55, // of the box's height
  rise: 1.25, // box heights over a life
  wave: { amplitude: [2, 3], perPx: [0.2, 0.26], speed: 0.005 }, // steam px; radians per px; radians per ms
  color: [238, 234, 226],
  alpha: 0.85
};
const SteamCanvas = styled.canvas`
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  image-rendering: pixelated;
  filter: drop-shadow(0 0 1px rgba(255, 250, 240, 0.35));
`;
const pick = ([min, max]) => min + Math.random() * (max - min);
const Steam = ({ style, size }) => {
  const ref = useRef(null);
  const width = Math.max(4, Math.round(size[0] / STEAM.roomPx));
  const height = Math.max(4, Math.round(size[1] / STEAM.roomPx));
  useEffect(() => {
    const canvas = ref.current;
    const context = canvas && canvas.getContext("2d");
    if (!context) return;
    const image = context.createImageData(width, height);
    const newStrand = (now, n) => ({
      bornAt: now,
      lifeMs: pick(STEAM.lifeMs),
      x: width * (0.3 + (0.4 * (n + Math.random() * 0.6)) / STEAM.strands),
      amplitude: pick(STEAM.wave.amplitude),
      perPx: pick(STEAM.wave.perPx),
      phase: Math.random() * Math.PI * 2
    });
    // (staggered from the start, so they don't all rise together)
    const start = performance.now();
    const strands = Array.from({ length: STEAM.strands }, (_, n) => {
      const strand = newStrand(start, n);
      strand.bornAt -= (strand.lifeMs * n) / STEAM.strands;
      return strand;
    });
    let frameId;
    let lastAt = 0;
    const draw = now => {
      frameId = requestAnimationFrame(draw);
      if (now - lastAt < 1000 / STEAM.fps) return;
      lastAt = now;
      image.data.fill(0);
      strands.forEach((strand, n) => {
        let age = (now - strand.bornAt) / strand.lifeMs;
        if (age >= 1) {
          Object.assign(strand, newStrand(now, n));
          age = 0;
        }
        const lifeAlpha = Math.min(1, age / 0.2, (1 - age) / 0.35);
        // (its bottom leaves the cup as it goes up; its top a length above that)
        const bottom = height - age * STEAM.rise * height;
        const top = bottom - STEAM.length * height;
        // (bottom to top; each row's pixel joined to the row below's, so a steep curl is a line, not a jump)
        let below;
        for (let y = Math.min(height, Math.ceil(bottom)) - 1; y >= Math.max(0, Math.floor(top)); y--) {
          const along = (bottom - y) / (bottom - top); // 0 at its bottom, 1 at its top
          const heightUp = 1 - y / height;
          // (the wave grows as it rises: curlier up top)
          const amplitude = strand.amplitude * (0.5 + heightUp);
          const x = Math.round(strand.x + amplitude * Math.sin(y * strand.perPx + now * STEAM.wave.speed + strand.phase));
          const from = below === undefined ? x : x > below ? below + 1 : x < below ? below - 1 : x;
          below = x;
          const alpha = STEAM.alpha * lifeAlpha * Math.min(1, along / 0.2, (1 - along) / 0.4) * (1 - heightUp * 0.4);
          if (alpha <= 0) continue;
          for (let each = Math.min(from, x); each <= Math.max(from, x); each++) {
            if (each < 0 || each >= width) continue;
            const index = (y * width + each) * 4;
            image.data[index] = STEAM.color[0];
            image.data[index + 1] = STEAM.color[1];
            image.data[index + 2] = STEAM.color[2];
            image.data[index + 3] = Math.max(image.data[index + 3], Math.round(alpha * 255));
          }
        }
      });
      context.putImageData(image, 0, 0);
    };
    frameId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frameId);
  }, [width, height]);
  return (
    <div style={{ position: "absolute", ...style }}>
      <SteamCanvas ref={ref} width={width} height={height} />
    </div>
  );
};

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
  box-shadow: inset 0 calc(var(--safe-h) * 0.0015) 0 ${TV_LOOK.casingLight}, 0 calc(var(--safe-h) * 0.004) calc(var(--safe-h) * 0.008) rgba(0, 0, 0, 0.6);
`;
export const MonitorStand = ({ room = ROOM }) => {
  const { centerX, bottom } = room.monitor;
  const { shelfTop, neckWidth, footWidth, footHeight, collarWidth, collarHeight } = room.stand;
  return (
    <>
      <Neck style={at(centerX - neckWidth / 2, bottom - 4, neckWidth, shelfTop - footHeight - bottom + 6)} />
      <Foot style={{ ...at(centerX - collarWidth / 2, bottom - 2, collarWidth, collarHeight), borderRadius: "0 0 30% 30% / 0 0 80% 80%" }} />
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
  box-shadow: inset 0 calc(var(--safe-h) * 0.0025) 0 ${TV_LOOK.casingLight}, 0 calc(var(--safe-h) * 0.01) calc(var(--safe-h) * 0.025) rgba(0, 0, 0, 0.8);
  transition: opacity 500ms ease-out;
  &::before {
    /* the dead screen */
    content: "";
    position: absolute;
    inset: 9% 5% 7% 5%;
    border-radius: 3.5%;
    background: radial-gradient(ellipse at 35% 25%, rgba(255, 255, 255, 0.05), transparent 55%), #050606;
    box-shadow: inset 0 0 calc(var(--safe-h) * 0.02) rgba(0, 0, 0, 0.9);
  }
`;
export const RoomMonitor = ({ isShown = true }) => {
  if (ROOM.hasOwnMonitor) return null; // (the picture's own monitor shows: Jamie liked its shading)
  const { centerX, bottom, height } = ROOM.monitor;
  const width = height * (ROOM_HANDOFF.casingAspect || ROOM.monitor.aspect);
  return <StandIn style={{ ...at(centerX - width / 2, bottom - height, width, height), opacity: isShown ? 1 : 0 }} />;
};

/*
  The black light's flicker (Jamie, 2026-11-25): the purple tube goes out for a few short stutters, and the room's purple
  light with it, as an old tube does. A few times in the landing zoom's push into the room ('burstsAtMs', from when it
  mounts); in play, now and then (FLICKER.playEveryMs).
  'burst': off and on, in turn, ms each (it starts off)
*/
// (Jamie, 2026-11-25: more often and more dramatic, it was too subtle: every 8-20 s, was 25-70; darker, 0.82, was 0.5;
// longer stutters, and now and then the tube dead for a second or so before it catches)
export const FLICKER = {
  bursts: [
    [70, 90, 45, 160, 110, 60, 40],
    [50, 60, 40, 220, 90, 70, 35, 140, 60],
    [120, 80, 60, 300, 50],
    [60, 50, 40, 900, 80, 60, 50, 120, 40] // (out for a beat, then catching)
  ],
  playEveryMs: [8000, 20000],
  darkness: 0.82 // how dark the room's purple goes while the tube is out
};
const TubeOff = styled.div`
  position: absolute;
  border-radius: 45% / 50%;
  background: linear-gradient(to bottom, #241d2c, #3b3346 45%, #1d1824);
  box-shadow: 0 0 calc(var(--safe-h) * 0.004) rgba(0, 0, 0, 0.6);
  pointer-events: none;
`;
const RoomDim = styled.div`
  position: absolute;
  inset: 0;
  pointer-events: none;
`;
export const BlackLight = ({ room = ROOM, burstsAtMs = undefined }) => {
  const [isOff, setIsOff] = useState(false);
  useEffect(() => {
    if (!room.blackLight) return;
    const timers = [];
    const burst = startMs => {
      const steps = FLICKER.bursts[Math.floor(Math.random() * FLICKER.bursts.length)];
      let t = startMs;
      steps.forEach((ms, k) => {
        timers.push(setTimeout(() => setIsOff(k % 2 == 0), t));
        t += ms;
      });
      timers.push(setTimeout(() => setIsOff(false), t));
    };
    if (burstsAtMs) burstsAtMs.forEach(burst);
    else {
      const [min, max] = FLICKER.playEveryMs;
      const next = () => timers.push(setTimeout(() => { burst(0); next(); }, min + Math.random() * (max - min)));
      next();
    }
    return () => timers.forEach(clearTimeout);
  }, []);
  if (!room.blackLight) return null;
  const [x, y, width, height] = room.blackLight;
  const middle = { x: ((x + width / 2) / room.size.width) * 100, y: ((y + height / 2) / room.size.height) * 100 };
  return (
    <>
      <RoomDim style={{ opacity: isOff ? 1 : 0, background: `radial-gradient(ellipse 70% 90% at ${middle.x}% ${middle.y}%, rgba(6, 0, 14, ${FLICKER.darkness}), rgba(6, 0, 14, ${FLICKER.darkness * 0.45}) 70%, rgba(6, 0, 14, ${FLICKER.darkness * 0.2}))` }} />
      <TubeOff style={{ ...at(x - 2, y - 2, width + 4, height + 4), opacity: isOff ? 1 : 0 }} />
    </>
  );
};

// the room's living things, over its picture (in a box the picture's shape)
// ('hasClock': false for the Lab's desk, which has none: Jamie, playtest 39; 'room': which room's spots: the Lab's desk
// is the old room's; 'blackLightBurstsAtMs': the zoom's flickers)
export const RoomExtras = ({ hasClock = true, room = ROOM, blackLightBurstsAtMs = undefined, hasSteam = true }) => (
  <>
    {!room.hasOwnMonitor && <MonitorStand room={room} />}
    {hasClock && <ClockDigits style={at(...room.clockDigits)} />}
    {hasSteam && <Steam style={at(...room.steam)} size={room.steam.slice(2)} />}
    {room.blackLight && <BlackLight room={room} burstsAtMs={blackLightBurstsAtMs} />}
  </>
);

// (Jamie, 2026-11-27: the room's edges darken into black, as if past the lamp's light, before they fade out: something's
// there, unlit, not a flat color)
const ROOM_EDGE_DARK = { across: 9, down: 8, darkness: 0.92 }; // % of the picture's width and height; at the very edge
const Box = styled.div`
  position: fixed;
  z-index: 0;
  aspect-ratio: ${ROOM.size.width} / ${ROOM.size.height};
  background: url(${ROOM.src}) 0 0 / 100% 100%;
  image-rendering: pixelated;
  pointer-events: none;
  filter: brightness(var(--room-brightness, 1));
  transition: filter ${ROOM.settleMs}ms ease-out;
  &::after {
    content: "";
    position: absolute;
    inset: 0;
    pointer-events: none;
    background:
      linear-gradient(to right, rgba(0, 0, 0, ${ROOM_EDGE_DARK.darkness}), transparent ${ROOM_EDGE_DARK.across}%, transparent ${100 - ROOM_EDGE_DARK.across}%, rgba(0, 0, 0, ${ROOM_EDGE_DARK.darkness})),
      linear-gradient(to bottom, rgba(0, 0, 0, ${ROOM_EDGE_DARK.darkness}), transparent ${ROOM_EDGE_DARK.down}%, transparent ${100 - ROOM_EDGE_DARK.down}%, rgba(0, 0, 0, ${ROOM_EDGE_DARK.darkness}));
  }
`;

// the front layer: the room picture's things in front of the monitor, over the game frame (it's a stacking context)
// (6: over the whole monitor, PlayWindow's 5; under the Lab's lights out, 40 and up)
const FrontBox = styled.div`
  position: fixed;
  z-index: 6;
  aspect-ratio: ${ROOM.size.width} / ${ROOM.size.height};
  background: 0 0 / 100% 100% no-repeat;
  image-rendering: pixelated;
  pointer-events: none;
`;

// the coffee's steam, rising in front of the side monitor and console (Jamie, 2026-11-27: more immersive; the mug stays
// where it is in the room). Placed as the room is; over the front layer and the side units, under the Lab's lights out
const SteamBox = styled(FrontBox)`
  z-index: 7;
  background: none;
`;

const lerp = (a, b, t) => a + (b - a) * t;
const ease = t => 1 - Math.pow(1 - Math.min(Math.max(t, 0), 1), 3);

// behind the game's monitor: the room, kept placed from the casing (and settling there from the zoom's last view)
export const RoomBackdrop = () => {
  const ref = useRef(null);
  const frontRef = useRef(null);
  const steamRef = useRef(null);
  const [isStandInShown, setIsStandInShown] = useState(!!ROOM_HANDOFF.view);
  // (the whole page has the eye cursor while the apartment is up: where the camera's pan has moved the game area aside,
  // at the window's edges, the page shows. Jamie, 2026-11-25)
  useEffect(() => {
    document.documentElement.setAttribute("data-eye-cursor", "");
    return () => document.documentElement.removeAttribute("data-eye-cursor");
  }, []);
  useEffect(() => {
    const from = ROOM_HANDOFF.view;
    ROOM_HANDOFF.view = undefined;
    if (from) resetCamera(); // (from the landing's zoom: the view starts still, in the middle)
    const start = performance.now();
    let frameId;
    // the camera's offset and zoom this game area has now (it moves the whole area: the room, the monitor, all of it;
    // the zoom about the window's middle)
    const applied = { x: 0, y: 0, scale: 1 };
    // a box seen on the screen, as it would be with the camera still (the area unmoved and unzoomed)
    const unmove = (seen, middle) => ({
      left: middle.x + (seen.left - middle.x - applied.x) / applied.scale,
      top: middle.y + (seen.top - middle.y - applied.y) / applied.scale,
      width: seen.width / applied.scale,
      height: seen.height / applied.scale
    });
    const place = () => {
      const box = ref.current;
      const casing = document.querySelector("[data-tv-casing]");
      const area = box && box.parentElement;
      if (box && area && !ROOM_HANDOFF.isFrozen) {
        const now = performance.now();
        // (where the casing would be with the camera still: the room is placed from that)
        const middle = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
        const seen = casing && unmove(casing.getBoundingClientRect(), middle);
        const casingBox = seen && { left: seen.left, width: seen.width, bottom: seen.top + seen.height, height: seen.height };
        if (casingBox && casingBox.height > 0) ROOM_HANDOFF.casingAspect = casingBox.width / casingBox.height;
        let view = casingBox && getRoomViewFor(casingBox);
        const isSettling = !!from && now - start < ROOM.settleMs;
        if (view && from) {
          const t = ease((now - start) / ROOM.settleMs);
          view = { left: lerp(from.left, view.left, t), top: lerp(from.top, view.top, t), width: lerp(from.width, view.width, t) };
        }
        view = view || from;
        if (view) {
          // the camera: as far as the room picture reaches past the window each way (less its faded edge)
          const height = (view.width * ROOM.size.height) / ROOM.size.width;
          const fade = { x: ROOM_EDGE_FADE * view.width, y: ROOM_EDGE_FADE * height };
          // (zoomed out by 's' about the window's middle, the room's edges come in toward it: the pan's limits shrink)
          const getLimits = s => {
            // (zoomed out, the room may have to move to keep covering the window: it's placed round the monitor, not the
            // window's middle. When it can't cover both sides at once (it's out as far as it goes), it's held between)
            const edge = (low, size, extent, fadeBy, mid) => {
              const least = extent - mid - s * (low + size - mid) + s * fadeBy;
              const most = -mid - s * (low - mid) - s * fadeBy;
              if (s >= 0.999) return [Math.min(0, least), Math.max(0, most)]; // (as it always was, not zoomed)
              return least <= most ? [least, most] : [(least + most) / 2, (least + most) / 2];
            };
            return { x: edge(view.left, view.width, window.innerWidth, fade.x, middle.x), y: edge(view.top, height, window.innerHeight, fade.y, middle.y) };
          };
          // (how far out it may go: the room, less its faded edges, still covering the window)
          const minScale = Math.min(1, Math.max(window.innerWidth / Math.max(1, view.width - 2 * fade.x), window.innerHeight / Math.max(1, height - 2 * fade.y)));
          const areaBox = unmove(area.getBoundingClientRect(), middle);
          const origin = { x: areaBox.left, y: areaBox.top };
          const camera = stepCamera(now, getLimits, isSettling, casingBox && { left: casingBox.left, right: casingBox.left + casingBox.width }, minScale);
          applied.x = camera.x;
          applied.y = camera.y;
          applied.scale = camera.scale;
          area.style.translate = `${applied.x.toFixed(2)}px ${applied.y.toFixed(2)}px`;
          area.style.transformOrigin = `${(middle.x - origin.x).toFixed(1)}px ${(middle.y - origin.y).toFixed(1)}px`;
          area.style.scale = applied.scale.toFixed(4);
          // (the room's box is fixed, so it's placed in the moved area's own px: where it's seen, less the area's place)
          box.style.left = `${view.left - origin.x}px`;
          box.style.top = `${view.top - origin.y}px`;
          box.style.width = `${view.width}px`;
          box.style.visibility = "visible";
          const steam = steamRef.current;
          if (steam) {
            steam.style.left = box.style.left;
            steam.style.top = box.style.top;
            steam.style.width = box.style.width;
            steam.style.visibility = "visible";
            steam.style.filter = getComputedStyle(box).filter;
          }
          const front = frontRef.current;
          if (front) {
            front.style.left = box.style.left;
            front.style.top = box.style.top;
            front.style.width = box.style.width;
            front.style.visibility = "visible";
            front.style.filter = getComputedStyle(box).filter;
          }
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
  // (its edges fade to the dark ground, where the window shows past the picture: layout phase 1, 1B)
  // (and what's in front of the monitor, over the game frame: placed as the room is. Layout phase 3)
  return (
    <>
      <Box ref={ref} data-room-box aria-hidden="true" style={{ visibility: "hidden", ...getEdgeFade(ROOM_EDGE_FADE) }}><RoomExtras hasSteam={false} /><RoomMonitor isShown={isStandInShown} /></Box>
      {ROOM.front && <FrontBox ref={frontRef} aria-hidden="true" style={{ visibility: "hidden", backgroundImage: `url(${ROOM.front})`, ...getEdgeFade(ROOM_EDGE_DARK.across / 100) }} />}
      <SteamBox ref={steamRef} aria-hidden="true" style={{ visibility: "hidden" }}><Steam style={at(...ROOM.steam)} size={ROOM.steam.slice(2)} /></SteamBox>
    </>
  );
};
