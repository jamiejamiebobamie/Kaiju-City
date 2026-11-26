import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import styled, { css, keyframes } from "styled-components";
import { OLD_ROOM as ROOM, RoomExtras } from "Components/RoomScene"; // (the Lab desk is built on the old room picture)
import { enterUnlockCode } from "Game/DataClasses/UnlockCodes";
import { DesignBox } from "./GameBoard/PlayWindow";
import { stepScreenLook } from "Utils/camera";
import { TILE_STATUSES_AND_ABILITY_DATA } from "Utils/gameState";

/*
  The Lab monitor (Jamie, 2026-11-24, a first mock-up): a computer on a desk in the walking Lab, seen on the player's
  own monitor, a monitor in a monitor. Its desk is the apartment's (the lamp, the books, the 12:00 clock, the coffee),
  in the Lab's cold light. On its screen, an MS-DOS style terminal: no GUI, typed text, keys or clicks.
  Two places open it, each with its own menu:
  - the walking Lab, its "Check Computer" spot (key 2): unlock codes, the Agent's master plan, his vacation photos, the
    personnel files (Guy, Girl and every recruit recruited or terminated this playthrough), and Quit (back to the Lab)
  - Settings, on the start screen ("the fake landing page"): unlock codes and Quit (back to it)
  Both ways in, the monitor's picture has faded to black first (the opener's job); then this slides in from the right
  and fades up. Quit is the reverse: it slides out to the right and fades, and then 'onClose'.
*/
export const LAB_TERMINAL = {
  inMs: 700, // its slide in from the right, fading up
  outMs: 550, // and back out
  fadeMs: 450, // the opener's fade of the monitor's picture to black first (and back after)
  charsPerTick: 7, // the typing, every 16 ms
  // the desk's picture (the room's), sized so the Lab monitor is this share of the screen's height, at its middle
  // (Jamie, 2026-11-24: framed as the apartment is round the Kaiju-Vision, zoomed in; was the room 200 screen widths
  // across, the monitor about half the screen's height)
  monitorHeightCqh: 80,
  monitor: { width: 380, height: 350 }, // in the room picture's pixels, standing where the Kaiju-Vision stands at home (was 430 wide)
  planPassword: "password", // MASTPLAN's (Jamie, 2026-11-24); caps or not
  scrollLines: 3, // Up and Down: this many lines a press
  // the unlock cards (Jamie, 2026-11-24): in batches as many as fit down the screen, one after another, held, faded
  // (sized as the game's own unlock card, in the frame's cqw: their cqh was the browser window's, so a full batch was
  // squeezed small. Batches as many as fit the screen, measured. Jamie, 2026-11-25)
  cards: { heightCqw: 4.6, gapCqw: 0.8,
    staggerMs: 220, holdMs: 2600, fadeMs: 500 }
};

const TEXT = "#c8c8c8";
const BRIGHT = "#ffffff";
const DIM = "#8a8a8a";
const RED = "#ff4a4a";

const slideIn = keyframes`
  from { transform: translateX(45%); opacity: 0; }
  to { transform: translateX(0); opacity: 1; }
`;
const slideOut = keyframes`
  from { transform: translateX(0); opacity: 1; }
  to { transform: translateX(45%); opacity: 0; }
`;

const Root = styled.div`
  position: absolute;
  inset: 0;
  z-index: 2147483000;
  overflow: hidden;
  background: black;
  pointer-events: auto;
  /* (the eye over the Lab's desk, the plain pointer over its screen: Glass. Jamie, 2026-11-25) */
  cursor: var(--eye-cursor, default);
`;
// (its desk, monitor and words in the screen's design box: today's size on a wider screen, the desk picture running on
// past it. Layout phase 2; the Root was the container, the whole screen)
const TerminalBox = styled(DesignBox)`
  container-type: size;
`;
const Scene = styled.div`
  position: absolute;
  inset: 0;
  animation: ${props => props.$isLeaving ? css`${slideOut} ${LAB_TERMINAL.outMs}ms ease-in both` : css`${slideIn} ${LAB_TERMINAL.inMs}ms ease-out both`};
`;

// the room's picture, placed so the Lab monitor's middle is the screen's
const { width: ROOM_W, height: ROOM_H } = ROOM.size;
const MONITOR_MIDDLE_Y = ROOM.monitor.bottom - LAB_TERMINAL.monitor.height / 2;
const boxHeightCqh = LAB_TERMINAL.monitorHeightCqh * ROOM_H / LAB_TERMINAL.monitor.height;
const boxWidthCqh = boxHeightCqh * ROOM_W / ROOM_H;
const Desk = styled.div`
  position: absolute;
  width: ${boxWidthCqh}cqh;
  height: ${boxHeightCqh}cqh;
  left: calc(50cqw - ${(ROOM.monitor.centerX / ROOM_W) * boxWidthCqh}cqh);
  top: calc(50cqh - ${(MONITOR_MIDDLE_Y / ROOM_H) * boxHeightCqh}cqh);
`;
/*
  Looking about the Lab's computer desk (Jamie, playtest 40; from the walking Lab and from Settings on the start screen): as in the apartment, but
  inside the main monitor's screen. The mouse along the screen's inside edges leans the view that way, as far as the
  desk picture goes past the screen (less 'edgePx'); and the shaky cam's bob, kept inside that too.
*/
const DESK_LOOK = { reach: 0.6, edgePx: 2 }; // (of how far the picture goes past the screen on that side)
const DeskLook = ({ isOn, children }) => {
  const ref = useRef(null);
  useEffect(() => {
    if (!isOn) return;
    let frameId;
    const applied = { x: 0, y: 0 };
    const step = () => {
      frameId = requestAnimationFrame(step);
      const element = ref.current;
      const desk = element && element.firstElementChild;
      const screen = element && element.closest("[data-lab-terminal]");
      if (!desk || !screen) return;
      const view = screen.getBoundingClientRect();
      const seen = desk.getBoundingClientRect();
      // (where the desk would be, still)
      const still = { left: seen.left - applied.x, right: seen.right - applied.x, top: seen.top - applied.y, bottom: seen.bottom - applied.y };
      const room = {
        left: Math.max(0, view.left - still.left - DESK_LOOK.edgePx), right: Math.max(0, still.right - view.right - DESK_LOOK.edgePx),
        up: Math.max(0, view.top - still.top - DESK_LOOK.edgePx), down: Math.max(0, still.bottom - view.bottom - DESK_LOOK.edgePx)
      };
      const look = stepScreenLook("labDesk", performance.now(), view);
      const x = (look.x < 0 ? -look.x * room.left : -look.x * room.right) * DESK_LOOK.reach + look.shake.x;
      const y = (look.y < 0 ? -look.y * room.up : -look.y * room.down) * DESK_LOOK.reach + look.shake.y;
      applied.x = Math.max(-room.right, Math.min(room.left, x));
      applied.y = Math.max(-room.down, Math.min(room.up, y));
      element.style.transform = `translate(${applied.x.toFixed(2)}px, ${applied.y.toFixed(2)}px)`;
    };
    step();
    return () => cancelAnimationFrame(frameId);
  }, [isOn]);
  return <div ref={ref} style={{ position: "absolute", inset: 0 }}>{children}</div>;
};

// the apartment's things, in the Lab's cold light (a mock-up: Jamie's own Lab desk art can replace it)
const DeskPicture = styled.div`
  position: absolute;
  inset: 0;
  background: url(${ROOM.src}) 0 0 / 100% 100%;
  image-rendering: pixelated;
  filter: hue-rotate(155deg) saturate(0.55) brightness(0.62) contrast(1.1);
`;
/*
  Behind the Lab's computer (Jamie, playtest 39): no room wall, poster or clock: the Lab's window, its metal sill
  across, and above it the Peninsula by day (the walking Lab's day view). A strip of the Lab's wall under the sill, then
  the desk. The coffee stays (cut from the room's picture).
  In the room picture's pixels: 'sillTop' the frame's top, 'sillHeight' its height, 'deskTop' the desk's top;
  'view': the day picture's part shown above the sill (its own pixels: the top and the height).
*/
export const LAB_DESK_WINDOW = {
  src: "/levels/labIntro-window-day.png",
  // (at night, as the walking Lab before the trap, and from Settings: Jamie, 2026-11-25)
  nightSrc: "/levels/labIntro-window.png",
  sillTop: 430, sillHeight: 34, deskTop: 584,
  view: { top: 130, height: 330 },
  mug: { x: 708, y: 532, width: 58, height: 56 }
};
const DeskView = styled.div`
  position: absolute;
  overflow: hidden;
  background-repeat: no-repeat;
  image-rendering: pixelated;
  filter: saturate(0.9) brightness(0.92);
`;
// the window's bottom frame: brushed metal, a bevel and a shadow on the wall below
const DeskSill = styled.div`
  position: absolute;
  background: linear-gradient(to bottom, #d6dde2 0%, #9aa4ab 30%, #6f7980 70%, #4a5258 100%);
  box-shadow: inset 0 0.15cqw 0 rgba(255, 255, 255, 0.7), 0 0.6cqw 0.9cqw rgba(0, 0, 0, 0.55);
`;
const DeskWall = styled.div`
  position: absolute;
  background: linear-gradient(to bottom, #2e3a40, #232d32);
`;
const DeskMug = styled.div`
  position: absolute;
  background-image: url(${ROOM.src});
  background-repeat: no-repeat;
  image-rendering: pixelated;
  filter: hue-rotate(155deg) saturate(0.55) brightness(0.62) contrast(1.1);
`;
// the window, the sill, the wall strip and the mug, over the room's picture (all in its pixels)
const DAY_SIZE = { width: 1408, height: 768 }; // (the day picture's)
const DeskWindow = ({ isNight = false }) => {
  const { sillTop, sillHeight, deskTop, view, mug } = LAB_DESK_WINDOW;
  const scale = sillTop / view.height; // the day picture's pixels, in the room's
  return (
    <>
      <DeskView style={{ ...at(0, 0, ROOM_W, sillTop), backgroundImage: `url(${isNight ? LAB_DESK_WINDOW.nightSrc : LAB_DESK_WINDOW.src})`, backgroundSize: `${(DAY_SIZE.width * scale / ROOM_W) * 100}% auto`, backgroundPosition: `50% ${(view.top * scale / (DAY_SIZE.height * scale - sillTop)) * 100}%` }} />
      <DeskWall style={at(0, sillTop + sillHeight, ROOM_W, deskTop - sillTop - sillHeight)} />
      <DeskSill style={at(0, sillTop, ROOM_W, sillHeight)} />
      <DeskMug style={{ ...at(mug.x, mug.y, mug.width, mug.height), backgroundSize: `${(ROOM_W / mug.width) * 100}% ${(ROOM_H / mug.height) * 100}%`, backgroundPosition: `${(mug.x / (ROOM_W - mug.width)) * 100}% ${(mug.y / (ROOM_H - mug.height)) * 100}%` }} />
    </>
  );
};
// the Lab's wall panels and its strip light's glow over it
const LabLight = styled.div`
  position: absolute;
  inset: 0;
  pointer-events: none;
  background:
    radial-gradient(ellipse 45% 30% at 40% 0%, rgba(120, 220, 255, 0.18), transparent 70%),
    repeating-linear-gradient(to right, transparent 0 7.6%, rgba(160, 230, 255, 0.06) 7.6% 7.8%);
  mix-blend-mode: screen;
`;

// a spot in the room's picture, as shares of it
const at = (x, y, width, height) => ({
  left: `${(x / ROOM_W) * 100}%`,
  top: `${(y / ROOM_H) * 100}%`,
  width: `${(width / ROOM_W) * 100}%`,
  height: `${(height / ROOM_H) * 100}%`
});

// the Lab's computer: an off-white casing, as the window picture's little monitor (Jamie, 2026-11-16)
const Casing = styled.div`
  position: absolute;
  box-sizing: border-box;
  border-radius: 5% / 6%;
  background: linear-gradient(to bottom, #e3dfd2, #c9c4b4 60%, #b3ad9b);
  box-shadow: inset 0 0.3cqw 0 rgba(255, 255, 255, 0.6), inset 0 -0.4cqw 0 rgba(0, 0, 0, 0.25), 0 1.5cqw 3cqw rgba(0, 0, 0, 0.7);
`;
const Glass = styled.div`
  position: absolute;
  inset: 6% 5.5% 13% 5.5%;
  border-radius: 3% / 4%;
  background: #030303;
  box-shadow: inset 0 0 2cqw rgba(0, 0, 0, 1), 0 0 0 0.35cqw #8e8977;
  overflow: hidden;
  cursor: default;
  &::after {
    /* scanlines and the glass's sheen */
    content: "";
    position: absolute;
    inset: 0;
    pointer-events: none;
    background:
      radial-gradient(ellipse at 30% 20%, rgba(255, 255, 255, 0.07), transparent 55%),
      repeating-linear-gradient(to bottom, rgba(0, 0, 0, 0.28) 0 1px, transparent 1px 3px);
  }
`;
const Badge = styled.div`
  position: absolute;
  left: 7%;
  bottom: 4%;
  font: bold 1.1cqw monospace;
  letter-spacing: 0.15cqw;
  color: #6f6a5a;
`;
// a post-it stuck on the bezel's bottom right, under the green light (Jamie, playtests 38, 39): MASTPLAN's password,
// in someone's hand, written slanting up from its bottom left corner to its top right. The walking Lab's only
const PostIt = styled.div`
  position: absolute;
  right: 4%;
  top: 95.5%; /* (just below the light, hanging off the bezel's bottom: all of it in the shot) */
  width: 15.5%;
  aspect-ratio: 1;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: center;
  transform: rotate(3deg);
  background: linear-gradient(to bottom, #f6e77a, #eedb5c 85%, #ddc94a);
  box-shadow: 0.2cqw 0.4cqw 0.6cqw rgba(0, 0, 0, 0.45);
  font-family: "Segoe Print", "Comic Sans MS", cursive;
  font-size: 1.75cqw;
  color: #2a2a7a;
  white-space: nowrap;
  & span { display: block; transform: rotate(-40deg); }
`;
const Led = styled.div`
  position: absolute;
  right: 8%;
  bottom: 5%;
  width: 0.9cqw;
  height: 0.9cqw;
  border-radius: 50%;
  background: #4dff6a;
  box-shadow: 0 0 0.8cqw #4dff6a;
`;

const Text = styled.div`
  position: absolute;
  inset: 0;
  padding: 1.6cqw 1.9cqw;
  box-sizing: border-box;
  font-family: "Lucida Console", "Courier New", monospace;
  font-size: 2cqw; /* (bigger with the zoom in: Jamie, 2026-11-24; was 1.7) */
  line-height: 1.28;
  color: ${TEXT};
  text-shadow: 0 0 0.4cqw rgba(220, 220, 220, 0.35);
  white-space: pre-wrap;
  /* (Up and Down scroll it: Jamie, 2026-11-24; no scrollbar, as a DOS screen; room at the bottom for the legend) */
  overflow-y: auto;
  scrollbar-width: none;
  &::-webkit-scrollbar { display: none; }
  padding-bottom: 3.8cqw;
`;
// the keys for what's on the screen, at its bottom right (Jamie, 2026-11-24)
const Legend = styled.div`
  position: absolute;
  right: 1.4cqw;
  bottom: 0.9cqw;
  padding: 0.2cqw 0.6cqw;
  font-family: "Lucida Console", "Courier New", monospace;
  font-size: 1.45cqw;
  color: black;
  background: ${DIM};
  pointer-events: none;
`;
const Line = styled.div`
  min-height: 1.28em;
  ${props => props.$isBright && css`color: ${BRIGHT};`}
  ${props => props.$isDim && css`color: ${DIM};`}
  ${props => props.$isRed && css`color: ${RED}; text-shadow: 0 0 0.4cqw rgba(255, 60, 60, 0.5);`}
  ${props => props.$isPick && css`cursor: pointer;`}
  ${props => props.$isHi && css`background: ${TEXT}; color: black; text-shadow: none;`}
`;
const blink = keyframes`0%, 49% { opacity: 1; } 50%, 100% { opacity: 0; }`;
const Cursor = styled.span`
  display: inline-block;
  width: 0.6em;
  height: 1em;
  vertical-align: -0.15em;
  background: ${TEXT};
  animation: ${blink} 1s steps(1) infinite;
`;

// a personnel file's picture, grey as the screen; a red X over it once the recruit is dead. its facts beside it
// (Jamie, 2026-11-24: the whole file in view, or nearly)
const FileRow = styled.div`
  display: flex;
  gap: 1.6cqw;
  align-items: flex-start;
  margin: 0.4em 0 0.6em;
`;
const FileFacts = styled.div`
  flex: 1;
  min-width: 0;
`;
const Photo = styled.div`
  position: relative;
  flex: none;
  width: 8cqw;
  aspect-ratio: 3 / 4;
  border: 0.2cqw solid ${TEXT};
  background: #111 center top / cover no-repeat;
  image-rendering: pixelated;
  filter: grayscale(1) contrast(1.25) brightness(0.95);
`;
const DeadX = styled.svg`
  position: absolute;
  inset: -8%;
  width: 116%;
  height: 116%;
  filter: drop-shadow(0 0 0.4cqw rgba(255, 40, 40, 0.8));
`;

// ---- what's on it ----

const MENUS = {
  lab: [
    { id: "codes", name: "UNLOCK.EXE", note: "Enter an unlock code" },
    { id: "plan", name: "MASTPLAN <DIR>", note: "Classified" },
    { id: "photos", name: "VACATION <DIR>", note: "Personal. Do not open" },
    { id: "bios", name: "RECRUITS <DIR>", note: "Personnel files" },
    { id: "quit", name: "QUIT", note: "Back to the Lab" }
  ],
  // (Jamie: only these make sense outside the Lab)
  landing: [
    { id: "codes", name: "UNLOCK.EXE", note: "Enter an unlock code" },
    { id: "quit", name: "QUIT", note: "Back to the start screen" }
  ]
};

// DRAFT (Jamie, 2026-11-24): the Agent's plan, the Kaiju his own doing, and him the savior who sends the bill
const MASTER_PLAN = [
  { text: "========== EYES ONLY: THE AGENT ==========", isBright: true },
  "GOAL: Own Kaiju City. Legally. Mostly.",
  "",
  "STEP 1  Make Kaiju. Lots of them. The Lab",
  "        has volunteers. And citizens.",
  "STEP 2  Point them at the city. An explosion",
  "        of attacks. Every night. From the sea.",
  "STEP 3  Be the city's only hope. Lend it my",
  "        cyborg heroes. On a short leash.",
  "STEP 4  Send the bill. Protection: $1 BILLION",
  "        a month. Repairs: extra.",
  "STEP 5  Swap the heroes for clones of ME.",
  "        Cheaper. Loyal. Handsome.",
  "STEP 6  Sole savior. Statue. Parade. Mayor?",
  "",
  { text: "P.S. SHRED THIS FILE.   [ ] DONE", isRed: true }
];

// DRAFT (Jamie, 2026-11-24): something silly
const VACATION = [
  {
    file: "BEACH.TXT",
    art: [
      "    \\  |  /             ~   ~",
      "  -- (  ) --       ~  ~",
      "    /  |  \\",
      "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
      "      _o/        |\\__",
      "       |\\     ___|___\\__",
      "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~"
    ],
    caption: "Me. The beach. Zero Kaiju. (They're all at the city. Ha!)"
  },
  {
    file: "SELFIE.TXT",
    art: [
      "    .---.      .---.",
      "   ( o_o )    ( -_o )",
      "    | = |      | = |",
      "   /|___|\\    /|___|\\",
      "    |   |      |   |"
    ],
    caption: "Me and me. Clone #2 blinked. Recycle him."
  },
  {
    file: "SKI.TXT",
    art: [
      "          /\\",
      "         /  \\     /\\",
      "        / /\\ \\   /  \\",
      "       /_/  \\_\\ /____\\",
      "            \\o",
      "             |\\__",
      "      ______/ \\________"
    ],
    caption: "Paid for by the city's Kaiju Relief Fund."
  },
  {
    file: "MAYOR.TXT",
    art: [
      "   ______________________",
      "  | PAY TO: THE AGENT    |",
      "  | $1,000,000,000.00    |",
      "  |______________________|",
      "        o/      \\o",
      "        |\\------/|",
      "       / \\      / \\"
    ],
    caption: "The Mayor, shaking my hand. Note the zeros."
  }
];

const getMenuLines = (context, picked, isDone) => {
  const prompt = context == "lab" ? "C:\\AGENT>" : "C:\\SETTINGS>";
  return [
    { text: "LAB-OS 3.3  (C) 1984 KAIJU CITY LABORATORIES", isBright: true },
    context == "lab" ? "640K OK.  AGENT ACCESS ONLY." : "640K OK.  SETTINGS.",
    "",
    `${prompt} MENU`,
    "",
    ...MENUS[context].map(({ name, note }, k) => ({ text: `  ${k + 1}  ${name.padEnd(16)}${note}`, isHi: isDone && k == picked, pick: k })),
    "",
    { text: `Press 1-${MENUS[context].length}, or the arrows and ENTER.`, isDim: true }
  ];
};

// the files: Guy, Girl, then each recruit met this playthrough
const getFileLines = (file, index, count) => [
  `C:\\AGENT\\RECRUITS> TYPE ${file.file.replace(" ", "_").toUpperCase()}.TXT`,
  "",
  { text: `${file.file.toUpperCase()}  ${file.name.toUpperCase()}`, isBright: true },
  {
    photo: true,
    facts: [
      ...file.lines.map(([label, value]) => `${label}: ${value}`),
      file.isDeceased ? { text: "STATUS: DECEASED", isRed: true } : `STATUS: ${file.status || "Active"}`
    ]
  },
  file.bio,
  "",
  { text: `File ${index + 1} of ${count}.`, isDim: true }
];

// (his own ASCII art, signed in the corner as ASCII artists do; .TXT files, TYPEd, not pictures. Jamie, 2026-11-25)
const ART_SIGNATURE = "-A. '84";
const getPhotoLines = (photo, index) => [
  `C:\\AGENT\\VACATION> TYPE ${photo.file}`,
  "",
  ...photo.art.map(text => ({ text, isBright: true })),
  { text: ART_SIGNATURE.padStart(Math.max(...photo.art.map(text => text.length))), isDim: true },
  "",
  photo.caption,
  "",
  { text: `${index + 1} of ${VACATION.length}`, isDim: true } // (Jamie: was 'Photo 1 of 4.')
];

const getLineText = line => typeof line == "string" ? line : line.text || "";
const getTextLength = lines => lines.reduce((total, line) => total + getLineText(line).length + 1 + (line && line.facts ? getTextLength(line.facts) : 0), 0);

// the legend's keys, by what's on the screen
const getLegend = (view, context) => ({
  menu: `1-${MENUS[context].length} / \u2191\u2193 pick  ENTER open  ESC quit`,
  codes: "Type a code  ENTER  ESC back",
  planLock: "Type  ENTER  ESC back",
  plan: "\u2191\u2193 scroll  ESC back",
  photos: "\u2190\u2192 files  \u2191\u2193 scroll  ESC back", // (not "photos": the Agent's ASCII art. Jamie, 2026-11-25)
  bios: "\u2190\u2192 files  \u2191\u2193 scroll  ESC back"
})[view];

// ---- the unlock cards (Jamie, 2026-11-24): as after a choice scene's, for each thing a code opened ----
const cardIn = keyframes`
  from { opacity: 0; transform: translateX(30%); }
  to { opacity: 1; transform: translateX(0); }
`;
const CardColumn = styled.div`
  position: absolute;
  inset: 3% 0;
  z-index: 3;
  display: flex;
  flex-direction: column;
  align-items: flex-end; /* (right-aligned on the monitor: Jamie, playtest 39) */
  justify-content: center;
  padding-right: 2cqw; /* (a smaller indent: Jamie, 2026-11-25; was 3cqw) */
  gap: ${LAB_TERMINAL.cards.gapCqw}cqw;
  pointer-events: none;
  transition: opacity ${LAB_TERMINAL.cards.fadeMs}ms ease-in;
`;
const Card = styled.div`
  box-sizing: border-box;
  height: ${LAB_TERMINAL.cards.heightCqw}cqw;
  flex: none; /* (never squeezed by a full batch) */
  display: flex;
  align-items: center;
  gap: 1cqw;
  padding: 0 1.4cqw;
  font-family: gameboy;
  font-size: 1.4cqw;
  white-space: nowrap;
  color: #101018;
  background: #fbfbf0;
  border: 0.25cqw solid #101018;
  box-shadow: 0.35cqw 0.35cqw 0 rgba(0, 0, 0, 0.5);
  animation: ${cardIn} 0.45s ease-out both;
`;
const CardPortrait = styled.img`
  height: 80%;
  aspect-ratio: 3 / 4;
  object-fit: cover;
  object-position: 50% 0;
  image-rendering: pixelated;
`;
const CardTile = styled.div`
  flex: none;
  height: 74%;
  aspect-ratio: 1.13;
  display: flex;
  align-items: center;
  justify-content: center;
  clip-path: polygon(25% 0, 75% 0, 100% 50%, 75% 100%, 25% 100%, 0 50%);
  font-size: 1.5cqw;
  color: #fbfbf0;
  text-shadow: 0 0 0.3cqw rgba(0, 0, 0, 0.8);
`;
const CardFace = ({ card }) => {
  if (card.power) {
    const look = TILE_STATUSES_AND_ABILITY_DATA.find(data => data.element == card.power);
    return look ? <CardTile style={{ background: look.color }}><i className={`fa ${look.activeIcon}`} /></CardTile> : null;
  }
  return card.image ? <CardPortrait src={card.image} alt="" /> : null;
};
// batch after batch, each card in after the last, all held, faded, then the next; 'onDone' after the last
const UnlockCards = ({ cards, onDone }) => {
  const [batch, setBatch] = useState(0);
  const [isFading, setIsFading] = useState(false);
  const [batchSize, setBatchSize] = useState(0); // (as many as fit the column's height: measured once it's laid out)
  const columnRef = useRef(null);
  useLayoutEffect(() => {
    const column = columnRef.current;
    if (!column) return;
    const probe = document.createElement("div");
    probe.style.cssText = "position:absolute;width:100cqw;height:0;visibility:hidden";
    column.appendChild(probe);
    const pxPerCqw = probe.getBoundingClientRect().width / 100;
    probe.remove();
    const { heightCqw, gapCqw } = LAB_TERMINAL.cards;
    const room = column.clientHeight - parseFloat(getComputedStyle(column).paddingTop) - parseFloat(getComputedStyle(column).paddingBottom);
    setBatchSize(Math.max(1, Math.floor((room + gapCqw * pxPerCqw) / ((heightCqw + gapCqw) * pxPerCqw))));
  }, []);
  const batches = [];
  if (batchSize) for (let k = 0; k < cards.length; k += batchSize) batches.push(cards.slice(k, k + batchSize));
  const shown = batches[batch] || [];
  useEffect(() => {
    if (!batchSize) return;
    const { staggerMs, holdMs, fadeMs } = LAB_TERMINAL.cards;
    const fadeAt = shown.length * staggerMs + holdMs;
    setIsFading(false);
    const fade = setTimeout(() => setIsFading(true), fadeAt);
    const next = setTimeout(() => (batch + 1 < batches.length ? setBatch(batch + 1) : onDone()), fadeAt + fadeMs);
    return () => {
      clearTimeout(fade);
      clearTimeout(next);
    };
  }, [batch, batchSize]);
  return (
    <CardColumn key={batch} ref={columnRef} style={{ opacity: isFading ? 0 : 1 }}>
      {shown.map((card, k) => (
        <Card key={card.id} style={{ animationDelay: `${k * LAB_TERMINAL.cards.staggerMs}ms` }}>
          <CardFace card={card} />
          {card.label}
        </Card>
      ))}
    </CardColumn>
  );
};

// 'context': "lab" or "landing"; 'files': the personnel files (the Lab's); 'onClose': once it has slid away
// 'isNight': the Peninsula behind it by night (the walking Lab before the trap; Settings always)
export const LabTerminal = ({ context = "lab", files = [], onClose, isNight = context != "lab" }) => {
  const [view, setView] = useState("menu"); // menu, codes, planLock, plan, photos, bios
  const [isPlanOpen, setIsPlanOpen] = useState(false); // its password given (while the terminal's up)
  const [picked, setPicked] = useState(0);
  const [page, setPage] = useState(0); // the photo or file shown
  const [code, setCode] = useState("");
  const [codeResults, setCodeResults] = useState([]);
  const [isLeaving, setIsLeaving] = useState(false);
  const [cards, setCards] = useState(undefined); // the unlock cards showing
  const textRef = useRef(null);
  const menu = MENUS[context];

  const getLines = isDone => {
    if (view == "menu") return getMenuLines(context, picked, isDone);
    if (view == "codes") return [
      `${context == "lab" ? "C:\\AGENT>" : "C:\\SETTINGS>"} UNLOCK.EXE`,
      { text: "UNLOCK.EXE  v1.0", isBright: true },
      { text: "Type a code and press ENTER.  ESC back.", isDim: true },
      "",
      ...codeResults,
      { code: true }
    ];
    // (password protected: Jamie, 2026-11-24)
    if (view == "planLock") return [
      "C:\\AGENT> CD MASTPLAN",
      { text: "MASTPLAN is password protected.", isBright: true },
      { text: "Type the password and press ENTER.  ESC back.", isDim: true },
      "",
      ...codeResults,
      { code: true, label: "PASSWORD", isMasked: true }
    ];
    if (view == "plan") return ["C:\\AGENT\\MASTPLAN> TYPE PLAN.TXT", "", ...MASTER_PLAN, "", { text: "ESC back.", isDim: true }];
    if (view == "photos") return getPhotoLines(VACATION[page], page);
    if (view == "bios") return files.length ? getFileLines(files[page], page, files.length) : ["C:\\AGENT\\RECRUITS> DIR", "", "No files.", "", { text: "ESC back.", isDim: true }];
    return [];
  };

  // the typing: each new page types out; any key or click finishes it
  const [shown, setShown] = useState(0);
  const total = getTextLength(getLines(false));
  const pageKey = `${view} ${page}`;
  useEffect(() => {
    setShown(0);
    if (textRef.current) textRef.current.scrollTop = 0;
    const id = setInterval(() => setShown(count => count + LAB_TERMINAL.charsPerTick), 16);
    return () => clearInterval(id);
  }, [pageKey]);
  const scroll = lines => {
    const box = textRef.current;
    if (!box) return;
    const linePx = parseFloat(getComputedStyle(box).fontSize) * 1.28;
    box.scrollTop += lines * linePx;
  };
  const isDone = shown >= total;

  const leave = () => {
    if (isLeaving) return;
    setIsLeaving(true);
    setTimeout(() => onClose && onClose(), LAB_TERMINAL.outMs);
  };
  const open = k => {
    const item = menu[k];
    if (!item) return;
    setPicked(k);
    if (item.id == "quit") return leave();
    setPage(0);
    setCode("");
    setCodeResults([]);
    setView(item.id == "plan" && !isPlanOpen ? "planLock" : item.id);
  };
  const back = () => setView("menu");

  // the keys are the terminal's while it's up (none reach the game: no walking in the Lab behind it)
  const onKey = useRef(undefined);
  onKey.current = event => {
    const { key } = event;
    if (isLeaving || cards) return; // (the unlock cards play out first)
    if (!isDone && key != "Escape") {
      setShown(total);
      if (view != "codes" && view != "planLock") return;
    }
    if (view == "menu") {
      const number = Number(key);
      if (number >= 1 && number <= menu.length) open(number - 1);
      else if (key == "ArrowDown" || key == "ArrowRight") setPicked(k => (k + 1) % menu.length);
      else if (key == "ArrowUp" || key == "ArrowLeft") setPicked(k => (k - 1 + menu.length) % menu.length);
      else if (key == "Enter" || key == " ") open(picked);
      else if (key == "Escape") leave();
      return;
    }
    if (key == "Escape") return back();
    if (view == "planLock") {
      if (key == "Enter") {
        if (!code) return;
        if (code.toLowerCase() == LAB_TERMINAL.planPassword) {
          setIsPlanOpen(true);
          setCode("");
          setView("plan");
        } else {
          setCodeResults(lines => [...lines.slice(-6), { text: "ACCESS DENIED.", isRed: true }, ""]);
          setCode("");
        }
      } else if (key == "Backspace") setCode(typed => typed.slice(0, -1));
      else if (/^[a-z0-9]$/i.test(key) && code.length < 16) setCode(typed => typed + key);
      return;
    }
    if (view == "codes") {
      if (key == "Enter") {
        if (!code) return;
        const entered = enterUnlockCode(code);
        const result = entered && (entered.cards.length ? entered.result : "NOTHING NEW: ALL OPEN ALREADY.");
        setCodeResults(lines => [...lines.slice(-6), `CODE: ${code.toUpperCase()}`, result ? { text: `ACCESS GRANTED. ${result}`, isBright: true } : { text: "INVALID CODE.", isRed: true }, ""]);
        setCode("");
        if (entered && entered.cards.length) setCards(entered.cards);
      } else if (key == "Backspace") setCode(typed => typed.slice(0, -1));
      else if (/^[a-z0-9]$/i.test(key) && code.length < 16) setCode(typed => typed + key);
      return;
    }
    // Left and Right: the other files or photos; Up and Down: scroll (Jamie, 2026-11-24)
    const count = view == "photos" ? VACATION.length : view == "bios" ? files.length : 0;
    if (key == "ArrowDown") scroll(LAB_TERMINAL.scrollLines);
    else if (key == "ArrowUp") scroll(-LAB_TERMINAL.scrollLines);
    else if (count && key == "ArrowRight") setPage(k => (k + 1) % count);
    else if (count && key == "ArrowLeft") setPage(k => (k - 1 + count) % count);
    else if (key == "Enter" && !count) back();
  };
  useEffect(() => {
    const handle = event => {
      event.stopImmediatePropagation();
      event.preventDefault();
      if (event.type == "keydown" && !event.repeat) onKey.current(event);
    };
    window.addEventListener("keydown", handle, true);
    window.addEventListener("keyup", handle, true);
    return () => {
      window.removeEventListener("keydown", handle, true);
      window.removeEventListener("keyup", handle, true);
    };
  }, []);

  // the lines, typed out as far as they've got
  let budget = shown;
  const file = view == "bios" ? files[page] : undefined;
  const renderLine = (line, k) => {
    if (line && line.photo) {
      return file ? (
        <FileRow key={k}>
          <Photo style={{ backgroundImage: `url(/levels/portraits/${file.avatar}.png)` }}>
            {isDone && file.isDeceased && (
              <DeadX viewBox="0 0 10 10" preserveAspectRatio="none">
                <path d="M1 1 L9 9 M9 1 L1 9" stroke={RED} strokeWidth="1" strokeLinecap="round" />
              </DeadX>
            )}
          </Photo>
          <FileFacts>{(line.facts || []).map(renderLine)}</FileFacts>
        </FileRow>
      ) : null;
    }
    if (line && line.code) return isDone ? <Line key={k} $isBright>{line.label || "CODE"}: {line.isMasked ? "*".repeat(code.length) : code.toUpperCase()}<Cursor /></Line> : null;
    const { text = "", ...look } = typeof line == "string" ? { text: line } : line;
    if (budget <= 0) return null;
    const part = text.slice(0, budget);
    budget -= text.length + 1;
    const isPick = look.pick !== undefined;
    return (
      <Line key={k} $isBright={look.isBright} $isDim={look.isDim} $isRed={look.isRed} $isHi={look.isHi} $isPick={isPick}
        onMouseEnter={isPick && isDone ? () => setPicked(look.pick) : undefined}
        onClick={isPick ? () => open(look.pick) : undefined}>
        {part}{budget > 0 || !part ? "" : <Cursor />}
      </Line>
    );
  };
  const rendered = getLines(isDone).map(renderLine);

  return (
    <Root data-lab-terminal onClick={() => !isDone && setShown(total)}>
      <TerminalBox>
      <Scene $isLeaving={isLeaving}>
        <DeskLook isOn>
        <Desk>
          <DeskPicture />
          {/* (Settings' too, as the walking Lab's, not the old room's wall and clock: Jamie, 2026-11-25) */}
          <DeskWindow isNight={isNight} />
          <RoomExtras hasClock={false} room={ROOM} />
          <LabLight />
          <Casing style={at(ROOM.monitor.centerX - LAB_TERMINAL.monitor.width / 2, ROOM.monitor.bottom - LAB_TERMINAL.monitor.height, LAB_TERMINAL.monitor.width, LAB_TERMINAL.monitor.height)}>
            <Glass>
              <Text ref={textRef}>
                {rendered}
                {isDone && view == "menu" && <Line>{context == "lab" ? "C:\\AGENT>" : "C:\\SETTINGS>"} <Cursor /></Line>}
              </Text>
              {getLegend(view, context) && <Legend>{getLegend(view, context)}</Legend>}
            </Glass>
            <Badge>LAB-TERM 84</Badge>
            {/* (no post-it: the plan's password is the player's to guess, an easter egg. Jamie, 2026-11-25) */}
            <Led />
          </Casing>
        </Desk>
        </DeskLook>
      </Scene>
      {/* (Settings' codes: once the cards are done, back to the start screen; nothing's left to do there. Jamie, playtest 39) */}
      {cards && <UnlockCards cards={cards} onDone={() => { setCards(undefined); if (context == "landing") leave(); }} />}
      </TerminalBox>
    </Root>
  );
};
