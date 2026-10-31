import type { HexGrid } from 'Game/DataClasses/GameBoard/hexGrid';
import aquarium from './data/aquarium.json';
import peninsula from './data/peninsula.json';
import rapidTransit from './data/rapidTransit.json';
import rooftop from './data/rooftop.json';
import sewer1 from './data/sewer1.json';
import sewer2 from './data/sewer2.json';
import street from './data/street.json';

type TileIndex = { i: number; j: number };

export type LevelLayer = {
  src: string;
  zIndex: number;
};

// art that characters walk behind. a character standing above 'sortY' in the scene is drawn behind it.
export type ForegroundLayer = {
  src: string;
  x: number;
  y: number;
  width: number;
  height: number;
  sortY: number;
};

const ABOVE_CHARACTERS = 100000; // a 'sortY' past the bottom of any scene

// the same scale as the pieces' zIndex
export const getTileTone = ({ tileTone, phaseTileTones = {} }, activePhases) => {
  const phase = activePhases.find(id => phaseTileTones[id]);
  return TILE_TONES[phase ? phaseTileTones[phase] : tileTone];
};

export const getSortZIndex = ({ grid }: { grid: HexGrid }, sortY: number) =>
  20001 + grid.columns * Math.round((sortY - grid.originY) / grid.rowStep);

// a part of a level that can be switched on and off. the game will drive these later.
export type LevelPhase = {
  id: string;
  label: string;
};

/*
  Moving art in a level. x, y, width and height are in the level's scene pixels.
  'phase' shows it only during that phase. 'sortY' works as it does for foreground layers,
  and 'zIndex' sets its layer directly.
*/
export type SceneElement = {
  id: string;
  type: 'image' | 'sprite' | 'pulse' | 'light' | 'sequence' | 'part' | 'moth' | 'whiteout';
  x: number;
  y: number;
  width: number;
  height: number;
  phase?: string;
  sortY?: number;
  zIndex?: number;
  src?: string;
  frames?: number; // sprite: how many frames to play, each 'width' wide
  firstFrame?: number; // sprite: the frame to start from
  fps?: number; // sprite and sequence
  seconds?: number; // pulse: one fade down and up
  delaySeconds?: number; // pulse
  lowOpacity?: number; // pulse
  highOpacity?: number; // pulse
  enter?: Array<string>; // sequence
  loop?: Array<string>; // sequence
  exit?: Array<string>; // sequence
  startDelayMs?: number; // sequence
  sheetFrames?: number; // sprite: the whole sheet's frames, to scale it to 'width' and 'height'
  flip?: number; // sprite and moth: -1 mirrors it
  flutterSeconds?: number; // moth
  isUneven?: boolean; // pulse: an irregular beat
  isHaunting?: boolean; // pulse: fades up slowly, holds, fades away, then rests in the dark
  color?: string; // light: its color
  comesFrom?: { x: number; y: number }; // sprite: leaps here from this point, after 'appearSeconds'
  appearSeconds?: number; // sprite
  flashColor?: string; // part: the whole screen flashes this color when it is touched
  glowColor?: string; // part: the color it blazes in its 'brightPhase'
  blend?: 'screen'; // adds its light to the art below
  dimPhase?: string; // pulse: grey and dim during this phase
  fadeSeconds?: number; // image: fades in over this long
  touchPhase?: string; // part: in this phase it transforms and disappears
  brightPhase?: string; // part: in this phase it blazes
};

/*
  How the plain grid looks on a level. Each tone suits how bright the floor under its tiles is.
  The casing is a second line beside the first, in the opposite color, so tiles read on mixed floors.
*/
export const TILE_TONES = {
  white: { line: '#ffffff', lineOpacity: 0.6, casing: '#000000', casingOpacity: 0.4, fillOpacity: 0.03 },
  faint: { line: '#ffffff', lineOpacity: 0.32, casing: '#000000', casingOpacity: 0.3, fillOpacity: 0.02 },
  dark: { line: '#06141c', lineOpacity: 0.7, casing: '#ffffff', casingOpacity: 0.45, fillOpacity: 0.03 }
};

type TileTone = keyof typeof TILE_TONES;

export type LevelConfig = {
  id: string;
  name: string;
  accentColor: string;
  world: { width: number; height: number }; // the whole level, in world pixels
  contentOffset: { x: number; y: number }; // from the level's art to its tiles and pieces, in world pixels
  pieceScale: number; // how large characters are drawn
  moveSpeedScale: number; // keeps the time to cross a tile the same on every level
  grid: HexGrid;
  walkableTiles: Array<TileIndex>;
  tileSets?: Record<string, Array<TileIndex>>; // the level's walkable tiles for each phase
  isWalkingLevel: boolean; // a scene to walk through: no powers, and no HUDs
  tileLinks: Array<[TileIndex, TileIndex]>; // pairs of tiles a piece jumps between instantly
  spawnTiles: Array<TileIndex>; // where the player's team starts, in order. random if empty.
  goalTiles: Array<TileIndex>; // tiles highlighted to show the player where to go
  layers: Array<LevelLayer>;
  foregroundLayers: Array<ForegroundLayer>;
  phases: Array<LevelPhase>;
  defaultPhases: Array<string>; // phases that are on when the level starts
  sceneElements: Array<SceneElement>;
  hasTrainSchedule: boolean;
  shakePhases: Array<string>; // phases that shake the whole scene
  cameraZoom: number; // how close the camera sits during play. at 1, the whole scene fits the frame.
  wideShots?: Record<string, number>; // phases the camera pulls out to show, and how long it holds there in ms
  tileTone: TileTone;
  phaseTileTones?: Record<string, TileTone>; // phases that change the floor enough to need another tone
  flood?: { phase: string; top: number };
  kaijuEntry?: {
    perimeterTiles: Array<TileIndex>; // the tiles Kaiju walk onto the board from
    bounds: { minX: number; minY: number; maxX: number; maxY: number }; // where they start
  };
};

const PENINSULA_ROW_HEIGHT = 21.6; // in world pixels

// characters stand this many rows tall in the level mockups
const CHARACTER_HEIGHT_IN_ROWS = 2.9;
const CHARACTER_HEIGHT = 80; // in pixels, at a 'pieceScale' of 1

// from the top-left of a character at 'pieceScale' 1 to the center of the tile it stands on
const CHARACTER_TILE_CENTER = { x: 4, y: 7.5 };
const CHARACTER_LEFT_SHIFT = 3.5;

// the files made by the level editor: /level-editor can import these to change them
const buildLevel = (editorFile, name, accentColor, characterHeightInRows = CHARACTER_HEIGHT_IN_ROWS, foregroundLayers = [], isWalkingLevel = false): LevelConfig => {
  const { id, sceneWidth, sceneHeight, grid, tileLinks = [], cameraZoom = 1 } = editorFile;
  const { spawn = [], goal = [], kaijuEntry, ...tileSets } = editorFile.tileSets;
  const pieceScale = (grid.rowStep * characterHeightInRows) / CHARACTER_HEIGHT;
  return {
    id,
    name,
    accentColor,
    world: { width: sceneWidth, height: sceneHeight },
    contentOffset: { x: 0, y: 0 },
    pieceScale,
    moveSpeedScale: grid.rowStep / PENINSULA_ROW_HEIGHT,
    cameraZoom,
    grid: {
      ...grid,
      charOffsetX: -(CHARACTER_TILE_CENTER.x * pieceScale + CHARACTER_LEFT_SHIFT),
      charOffsetY: -(CHARACTER_TILE_CENTER.y * pieceScale)
    },
    walkableTiles: Object.values(tileSets)[0] as Array<TileIndex>,
    tileSets,
    isWalkingLevel,
    tileLinks,
    spawnTiles: spawn,
    goalTiles: goal,
    foregroundLayers,
    phases: [],
    defaultPhases: [],
    sceneElements: [],
    hasTrainSchedule: false,
    shakePhases: [],
    tileTone: 'white' as const,
    layers: [{ src: `/levels/${id}.png`, zIndex: -4 }]
  };
};

const trainFrames = names => names.map(name => `/levels/rapidTransit/train-${name}.png`);

// a god ray: fades up and down, out of step with the others
const godRay = (id, src, x, y, width, height, seconds, delaySeconds, look) => ({
  id, type: 'pulse' as const, src, x, y, width, height, sortY: ABOVE_CHARACTERS, seconds, delaySeconds, ...look
});

const subwayRay = (n, seconds, delaySeconds) =>
  godRay(`godRay${n}`, `/levels/rapidTransit/god-rays-${n}.png`, 0, 0, 1380, 752, seconds, delaySeconds, { isUneven: true, lowOpacity: 0.15, highOpacity: 0.85 });

const signalLight = (id, x) => [
  { id: `${id}Off`, type: 'sprite' as const, src: '/levels/rapidTransit/lights-spritesheet.png', x, y: 3, width: 48, height: 94, zIndex: -2, firstFrame: 0, frames: 1, fps: 1 },
  { id, type: 'sprite' as const, phase: 'trainLights', src: '/levels/rapidTransit/lights-spritesheet.png', x, y: 3, width: 48, height: 94, zIndex: -2, firstFrame: 1, frames: 2, fps: 2 }
];

// moths circle each lamp. each one flutters on its own timing.
const moths = (id, x, y, flip, flutterSeconds, delaySeconds) => ({
  id, type: 'moth' as const, src: '/levels/rapidTransit/moths-spritesheet.png', x, y, width: 82, height: 88, zIndex: -1, frames: 4, fps: 8, flip, flutterSeconds, delaySeconds
});

const PART_TOUCH_HOLD_MS = 4200; // long enough for the part's whole transformation and flash
const TRAIN_WARNING_HOLD_MS = 1500;
const SHATTER_HOLD_MS = 2500;

const RAPID_TRANSIT_SCENE = {
  hasTrainSchedule: true,
  shakePhases: ['train'],
  wideShots: { eyeTouched: PART_TOUCH_HOLD_MS, trainLights: TRAIN_WARNING_HOLD_MS },
  phases: [{ id: 'eye', label: 'Kaiju eye' }, { id: 'eyeTouched', label: 'Touch part' }, { id: 'train', label: 'Train' }],
  defaultPhases: ['eye'],
  sceneElements: [
    { id: 'godRaysAll', type: 'image' as const, src: '/levels/rapidTransit/god-rays-all.png', x: 0, y: 0, width: 1380, height: 752, sortY: ABOVE_CHARACTERS },
    subwayRay(1, 7.3, 0),
    subwayRay(2, 9.1, -2.4),
    subwayRay(3, 6.1, -4.3),
    subwayRay(4, 8.3, -1.2),
    ...signalLight('leftLight', 369),
    ...signalLight('rightLight', 991),
    moths('mothsLeft1', 380, 76, 1, 5.2, 0),
    moths('mothsLeft2', 372, 88, -1, 7.4, 0.9),
    moths('mothsRight1', 952, 72, -1, 6.2, 0.4),
    moths('mothsRight2', 944, 84, 1, 8.6, 1.6),
    {
      id: 'train',
      type: 'sequence' as const,
      phase: 'train',
      x: 178,
      y: 60,
      width: 1074,
      height: 691,
      zIndex: -2,
      fps: 10,
      enter: trainFrames(['enter1', 'enter2']),
      loop: trainFrames(['loop1', 'loop2', 'loop3', 'loop4']),
      exit: trainFrames(['exit1', 'exit2'])
    },
    { id: 'eye', type: 'part' as const, phase: 'eye', touchPhase: 'eyeTouched', src: '/levels/rapidTransit/eye-spritesheet.png', x: 839, y: 190, width: 484, height: 467, sortY: 600, seconds: 4, flashColor: '#57E931' }
  ]
};

const ROOFTOP_SCENE = {
  wideShots: { headTouched: PART_TOUCH_HOLD_MS },
  phases: [{ id: 'head', label: 'Kaiju head' }, { id: 'headTouched', label: 'Touch part' }],
  defaultPhases: ['head'],
  sceneElements: [
    { id: 'head', type: 'part' as const, phase: 'head', touchPhase: 'headTouched', src: '/levels/rooftop/head-spritesheet.png', x: 255, y: 233, width: 959, height: 519, sortY: 573, seconds: 4.5, flashColor: '#ff1a0d' }
  ]
};

// each ray keeps its own slow time, so they never settle into a pattern
const aquariumRay = (n, x, y, width, height, seconds, delaySeconds, highOpacity) =>
  godRay(`godRay${n}`, `/levels/aquarium/rays/ray-${n}.png`, x, y, width, height, seconds, delaySeconds, {
    isHaunting: true, dimPhase: 'shattered', blend: 'screen' as const, lowOpacity: 0, highOpacity
  });

const GLASS_PANEL_PLACES = [
  { id: 'left1', x: 0, y: 440, width: 142, height: 306, startDelayMs: 300 },
  { id: 'left2', x: 166, y: 378, width: 314, height: 343, startDelayMs: 0 },
  { id: 'left3', x: 410, y: 344, width: 163, height: 250, startDelayMs: 500 },
  { id: 'right3', x: 837, y: 344, width: 163, height: 250, startDelayMs: 150 },
  { id: 'right2', x: 926, y: 377, width: 332, height: 343, startDelayMs: 650 },
  { id: 'right1', x: 1266, y: 440, width: 142, height: 306, startDelayMs: 400 }
];

const GLASS_PANELS = GLASS_PANEL_PLACES.map(({ id, x, y, width, height, startDelayMs }) => ({
  id: `glass-${id}`,
  type: 'sequence' as const,
  phase: 'shattered',
  x, y, width, height, startDelayMs,
  zIndex: -2,
  fps: 7,
  enter: [1, 2, 3, 4, 5].map(n => `/levels/aquarium/glass/${id}-${n}.png`),
  loop: [`/levels/aquarium/glass/${id}-5.png`],
  exit: []
}));

// a fish leaps out of its tank's panel as the glass bursts
const FISH_BURST_DELAY_SECONDS = 0.3;

const fish = (id, x, y, width, height, flip, fps, panelId) => {
  const panel = GLASS_PANEL_PLACES.find(({ id }) => id == panelId);
  return {
    id, type: 'sprite' as const, phase: 'shattered', src: '/levels/aquarium/fish-spritesheet.png', x, y, width, height, sheetFrames: 4, frames: 4, zIndex: -1, flip, fps,
    comesFrom: { x: panel.x + panel.width / 2, y: panel.y + panel.height / 2 },
    appearSeconds: panel.startDelayMs / 1000 + FISH_BURST_DELAY_SECONDS
  };
};

const AQUARIUM_SCENE = {
  wideShots: { tongueTouched: PART_TOUCH_HOLD_MS, shattered: SHATTER_HOLD_MS },
  tileTone: 'dark' as const,
  phaseTileTones: { shattered: 'white' as const }, // the shattered hall is much darker
  flood: { phase: 'shattered', top: 530 }, // pieces below this line, in scene pixels, walk through water
  phases: [
    { id: 'tongue', label: 'Kaiju tongue' },
    { id: 'tongueTouched', label: 'Touch part' },
    { id: 'shards', label: 'Skylight shards' },
    { id: 'shattered', label: 'Shattered glass' }
  ],
  defaultPhases: ['tongue', 'shards'],
  sceneElements: [
    { id: 'shattered', type: 'image' as const, phase: 'shattered', src: '/levels/aquarium/shattered.png', x: 0, y: 0, width: 1408, height: 768, zIndex: -3, fadeSeconds: 1.2, delaySeconds: 0.8 },
    ...GLASS_PANELS,
    aquariumRay(1, 234, -16, 349, 463, 7, 0, 0.9),
    aquariumRay(2, 324, -16, 324, 596, 9.5, -3, 1),
    aquariumRay(3, 554, -8, 108, 542, 6, -1.5, 0.8),
    aquariumRay(4, 756, 0, 126, 534, 10.5, -6.5, 1),
    aquariumRay(5, 808, -6, 273, 576, 8, -5, 0.85),
    aquariumRay(6, 881, -8, 327, 453, 8.5, -1, 0.95),
    { id: 'shards', type: 'image' as const, phase: 'shards', src: '/levels/aquarium/shards.png', x: 352, y: 587, width: 675, height: 181, zIndex: -2 },
    fish('fish1', 1062, 613, 81, 100, 1, 6, 'right2'),
    fish('fish2', 900, 571, 46, 57, -1, 8, 'right3'),
    fish('fish3', 470, 590, 62, 76, -1, 7, 'left3'),
    { id: 'tongue', type: 'part' as const, phase: 'tongue', touchPhase: 'tongueTouched', src: '/levels/aquarium/tongue-spritesheet.png', x: 549, y: 516, width: 305, height: 161, sortY: 726, seconds: 3.5, flashColor: '#ff1464' }
  ]
};

// a soft colored light over the sewer opening. x and y are its center.
const sewerLight = (id, color, x, y, size, seconds, delaySeconds, highOpacity) => ({
  id, type: 'light' as const, phase: 'glow', color, x: x - size / 2, y: y - size / 2, width: size, height: size, zIndex: -3, seconds, delaySeconds, lowOpacity: 0, highOpacity
});

const SEWER1_SCENE = {
  tileTone: 'faint' as const,
  phases: [{ id: 'glow', label: 'Glow' }],
  sceneElements: [
    // two smooth fades on different beats drift in and out of step, so it never settles into a pattern
    { id: 'glow', type: 'pulse' as const, phase: 'glow', src: '/levels/sewer1/glow.png', x: 193, y: 274, width: 244, height: 176, zIndex: -3, seconds: 3.7, lowOpacity: 0.1, highOpacity: 0.7 },
    { id: 'glowEcho', type: 'pulse' as const, phase: 'glow', src: '/levels/sewer1/glow.png', x: 193, y: 274, width: 244, height: 176, zIndex: -3, seconds: 5.9, delaySeconds: 1.3, lowOpacity: 0, highOpacity: 0.6 },
    sewerLight('lightGreen', '#3dffa0', 235, 320, 170, 4.3, 0, 0.4),
    sewerLight('lightBlue', '#3f7dff', 300, 300, 190, 6.1, -1.7, 0.45),
    sewerLight('lightPink', '#ff3dc8', 250, 375, 160, 5.3, -3.1, 0.35),
    sewerLight('lightAmber', '#ffb13d', 315, 365, 150, 7.7, -2.2, 0.3),
    sewerLight('lightViolet', '#a45cff', 270, 285, 140, 3.9, -0.8, 0.35)
  ]
};

const sewerPart = (id, x, y, width, height, seconds, delaySeconds, glowColor) => ({
  id, type: 'part' as const, src: `/levels/sewer2/${id}-spritesheet.png`, x, y, width, height, zIndex: -2, seconds, delaySeconds, brightPhase: 'blinding', glowColor
});

const SEWER2_SCENE = {
  tileTone: 'faint' as const,
  phases: [{ id: 'blinding', label: 'Blinding light' }],
  sceneElements: [
    sewerPart('eye', 601, 133, 284, 369, 3.1, 0, '#e6ff3a'),
    sewerPart('tail', 28, 96, 455, 349, 5.3, 1.1, '#b13cff'),
    sewerPart('tooth', 458, 330, 165, 179, 2.3, 0.4, '#2a9cff'),
    sewerPart('viscera', 320, 191, 219, 157, 3.7, 2.2, '#ff9a1f'),
    sewerPart('bone', 287, 410, 602, 358, 6.1, 0.8, '#ff3d6e'),
    sewerPart('claw', 5, 411, 379, 271, 4.3, 1.7, '#22e08a'),
    { id: 'whiteout', type: 'whiteout' as const, phase: 'blinding', x: 0, y: 0, width: 1408, height: 768, sortY: ABOVE_CHARACTERS * 2 }
  ]
};

const streetGlow = (id, x, y, width, height, seconds, delaySeconds) => ({
  id, type: 'pulse' as const, isUneven: true, blend: 'screen' as const, src: `/levels/street/${id}-glow.png`, x, y, width, height, zIndex: -3, seconds, delaySeconds, lowOpacity: 0.05, highOpacity: 0.9
});

const STREET_SCENE = {
  tileTone: 'dark' as const,
  sceneElements: [
    streetGlow('hand', 586, 0, 168, 129, 4.7, 0),
    streetGlow('tail', 571, 126, 348, 266, 6.3, 1.4),
    streetGlow('tentacle', 901, 56, 173, 173, 3.9, 0.6),
    streetGlow('eye', 961, 251, 233, 151, 5.2, 2.1),
    streetGlow('claw', 751, 361, 453, 243, 7.1, 0.3),
    streetGlow('van', 361, 471, 148, 148, 4.3, 1)
  ]
};

// everything about a level that isn't in its file
const LEVEL_BUILDERS: Record<string, (file) => LevelConfig> = {
  peninsula: file => ({
    ...buildLevel(file, 'Peninsula', '#5a8a7a', CHARACTER_HEIGHT / PENINSULA_ROW_HEIGHT),
    layers: [
      { src: '/Map.gif', zIndex: -4 },
      { src: '/landDimmer.png', zIndex: -3 }
    ],
    kaijuEntry: {
      perimeterTiles: file.tileSets.kaijuEntry,
      bounds: { minX: -5, minY: 0, maxX: 485, maxY: 770 }
    }
  }),
  rapidTransit: file => ({ ...buildLevel(file, 'Rapid Transit Station', '#57E931', 3.7), ...RAPID_TRANSIT_SCENE }),
  rooftop: file => ({
    ...buildLevel(file, 'Rooftop Cemetary', '#880808', undefined, [
      { src: '/levels/rooftop-crane.png', x: 0, y: 0, width: 515, height: 376, sortY: ABOVE_CHARACTERS }
    ]),
    ...ROOFTOP_SCENE
  }),
  aquarium: file => ({
    ...buildLevel(file, 'Kaiju City Aquarium', '#C5063F', undefined, [
      { src: '/levels/aquarium-railing.png', x: 0, y: 219, width: 1408, height: 161, sortY: 267 },
      { src: '/levels/aquarium-tank.png', x: 549, y: 575, width: 305, height: 145, sortY: 726 }
    ]),
    ...AQUARIUM_SCENE
  }),
  sewer1: file => ({ ...buildLevel(file, 'Sewer 1', '#7a8a3a', undefined, [], true), ...SEWER1_SCENE }),
  sewer2: file => ({ ...buildLevel(file, 'Sewer 2', '#7a8a3a', undefined, [], true), ...SEWER2_SCENE }),
  street: file => ({ ...buildLevel(file, 'Street', '#7a8a3a', undefined, [], true), ...STREET_SCENE })
};

export const LEVEL_FILES = { peninsula, rapidTransit, rooftop, aquarium, sewer1, sewer2, street };

export const LEVELS: Record<string, LevelConfig> = Object.fromEntries(
  Object.entries(LEVEL_FILES).map(([id, file]) => [id, LEVEL_BUILDERS[id](file)])
);

export const PENINSULA = LEVELS.peninsula;

// the level editor saved a level: the game uses it from now on
export const applyLevelFile = file => {
  LEVEL_FILES[file.id] = file;
  LEVELS[file.id] = LEVEL_BUILDERS[file.id](file);
};
