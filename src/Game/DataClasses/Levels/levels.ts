import { getDialogueLine, getDialogueScript, getDialogueTexts, getIntroLines, getKeyedLines } from 'Game/DataClasses/Dialogue/dialogue';
import { getSpeechMs } from '../speechTiming';
import { getTileCenter } from 'Game/DataClasses/GameBoard/hexGrid';
import type { HexGrid } from 'Game/DataClasses/GameBoard/hexGrid';
import aquarium from './data/aquarium.json';
import lab from './data/lab.json';
import labIntro from './data/labIntro.json';
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
  type: 'image' | 'sprite' | 'pulse' | 'light' | 'sequence' | 'part' | 'moth' | 'whiteout' | 'npc' | 'speech' | 'walker' | 'door' | 'hotspot';
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
  glowPhase?: string; // npc: the phase that lights up its glowing outline
  lines?: Array<string>; // speech: what the character says, in turn
  hidePhase?: string; // npc: the phase that takes it off the scene
  route?: Array<Array<number>>; // walker: the [x, y] spots it runs between, in turn
  isSweeping?: boolean; // npc
  label?: string; // door, hotspot
  name?: string; // speech: who is talking
  outline?: string; // hotspot: its shape, drawn over the whole scene
  action?: string; // hotspot: what clicking it opens
  labelY?: number; // hotspot: where its label sits, if not just above it
  rotate?: number; // hotspot: in degrees
  walkSeconds?: number;
  idleSeconds?: number;
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

// the empowered bystander fought on a side level. the level starts with them standing as an NPC.
type Rival = {
  avatar: string;
  abilities: Array<string>; // ability elements
  maxLives: number;
  moveSpeed: number;
  touchPhase: string; // the phase where they touch the Kaiju part. the fight starts once it plays out.
  spot: { x: number; y: number }; // where the fight starts from, in scene pixels
  recruitSpot: { x: number; y: number }; // where they lie for the player's choice, in scene pixels
  isStandingBeside?: boolean;
  canTeleportAcross?: boolean; // a Teleport may land on tiles it can't walk to, like the other platforms // for the choice, the team stands either side of them (the Rooftop, below the RIP stone)
  pronoun: string;
  intro: {
    focus: { x: number; y: number }; // what the camera pulls in on, in scene pixels
    zoomScale: number;
    lines: Array<{ name?: string; text: string; x?: number; y?: number; isTeammate?: boolean; isFlipped?: boolean }>;
    isTouchWide?: boolean; // the touch is shown on the whole scene, so all of the Kaiju part is in it
    afterTouch?: { name: string; text: string }; // the bystander's line once the power is in them, close on them
  };
};

// Agents who walk in along a catwalk and drop to the floor, one after another
type AgentDrops = {
  kits: Record<string, Array<string>>; // each Agent's three powers, by kit: every kit is used once
  talkerKit: string; // the kit of the Agent who did the talking
  maxLives: number;
  moveSpeed: number;
  firstDropMs: number;
  dropIntervalMs: number;
  catwalkY: number; // in scene pixels
  catwalkLastRow: number; // the catwalk's tile rows end here: the floor is below, out of reach but by the portal
  portalColumns: number; // the portal's top end, this many columns over from where the talker waits
  floorY: number; // where they land, in scene pixels
  drops: Array<{ x: number; isFromLeft: boolean; kit: string }>; // one for each Agent. x is where they drop, in scene pixels.
  headStartMs: [number, number]; // every attempt, the Agents run and hold their powers for a time between these
};

type MapSite = { spot: { x: number; y: number }; color: string; icon?: string; isDetour?: boolean; visitLevelId?: string };

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
  isDepowered?: boolean; // after the Lab trap: the player's side has no glow
  visitLines?: Array<string>; // a battleground visited again: what the teammate says on arrival
  greeting?: { text: string; speechSpot: { x: number; y: number }; repeatMs: number; nearRows: number }; // a scene that opens with the Agent calling the team over
  walkers?: Array<{ id: string; avatar: string; route: Array<{ x: number; y: number; isPass: boolean }>; runSpeed: number; idleSeconds: number }>; // people at work in a walking scene
  getWalkerHeight?: (y: number) => number; // a walker's height at a y, in scene pixels: they shrink up the scene
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
  rival?: Rival;
  exit?: { spot: { x: number; y: number }; afterMs?: number; afterPhase?: string; isShownWhenOpen?: boolean; nearRows?: number }; // opens after a time or a phase. reaching it ends the level.
  walkIn?: { // the opening of a scene: who stands where, and who says what
    teammateSpot?: { x: number; y: number };
    doorTile: { i: number; j: number }; // where recruits walk in from
    standSpots: Array<{ x: number; y: number }>;
    frontSpots?: Array<{ x: number; y: number }>; // where the player and teammate step to before the words
    talkBeatMs?: number; // a quiet moment once all are in, before the words
    isWaitingToBePassed?: boolean; // the recruits and teammate only follow once the player has gone past them
    script: Array<{ who: string; text: string }>; // 'who' is 'teammate', 'player', or 'recruit': a recruit, or the player if there are none
    ending?: { spots: Array<{ x: number; y: number }>; phase: string; climaxMs: number }; // the player and teammate walk to these spots, and the phase ends the level
  };
  showdown?: { // the Agent and the team have words before the fight
    script: Array<{ who: string; text: string }>; // 'who' is 'agent', 'teammate' or 'player'
    speechSpot: { x: number; y: number };
  };
  extras?: Array<{ avatar: string; spot: { x: number; y: number }; facingDir: string }>; // people standing in the scene, drawn as pieces
  trap?: { // the Agent has his say, then his clones chase the player to the door
    // each line, by who says it. 'ray' is the Agent firing his ray. 'ifRecruits': only said with recruits along.
    script: Array<{ who?: 'agent' | 'teammate' | 'player' | 'recruit'; text?: string; phase?: string; ray?: boolean; ifRecruits?: boolean }>;
    speechSpot: { x: number; y: number };
    lineUp: { y: number; spacing: number };
    ray: { from: { x: number; y: number }; color: string; ms: number };
    chaseLines: { agent: string; teammate: string; teammateWithRecruits: string };
    chasers: { xs: Array<number>; startY: number; landingY: number; moveSpeed: number; abilities: Array<string> };
  };
  hasRecruitFollowers?: boolean; // recruited characters walk with the team
  sites?: Array<MapSite>; // places on the map to walk to
  isMapWalk?: boolean; // walked at the close camera, unlike other walking scenes
  goalColor?: string; // the goal tile's color, if not the usual gold light
  agentDrops?: AgentDrops;
  cameraZoom: number; // how close the camera sits during play. at 1, the whole scene fits the frame.
  liveWideShots?: Record<string, number>; // the same, for phases the game keeps running through
  unlock?: { id: string; label: string; image?: string; spot: { x: number; y: number }; afterMs?: number }; // a hidden tile, in scene pixels. 'afterMs': it only unlocks after this long
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
const CHARACTER_HEIGHT = 80; // in pixels, at a 'pieceScale' of 1
export const EXIT_OPEN_PHASE = 'exitOpen';

export const RUN_SPEED_SCALE = 1.25; // everyone's run speed together, so who is faster than who stays the same

// Peninsula sets how large characters look against the tiles, on every level
const CHARACTER_HEIGHT_IN_ROWS = CHARACTER_HEIGHT / PENINSULA_ROW_HEIGHT;

// from the top-left of a character at 'pieceScale' 1 to the center of the tile it stands on
const CHARACTER_TILE_CENTER = { x: 4, y: 7.5 };
const CHARACTER_LEFT_SHIFT = 3.5;
// the same, for a piece placed by where its feet are (a walker)
export const CHARACTER_FEET = { ...CHARACTER_TILE_CENTER, leftShift: CHARACTER_LEFT_SHIFT };
export const CHARACTER_HEIGHT_PX = CHARACTER_HEIGHT;

// the files made by the level editor: /level-editor can import these to change them
const buildLevel = (editorFile, name, accentColor, foregroundLayers = [], isWalkingLevel = false): LevelConfig => {
  const { id, sceneWidth, sceneHeight, grid, tileLinks = [], cameraZoom = 1 } = editorFile;
  const { spawn = [], goal = [], kaijuEntry, ...tileSets } = editorFile.tileSets;
  const pieceScale = (grid.rowStep * CHARACTER_HEIGHT_IN_ROWS) / CHARACTER_HEIGHT;
  return {
    id,
    name,
    accentColor,
    world: { width: sceneWidth, height: sceneHeight },
    contentOffset: { x: 0, y: 0 },
    pieceScale,
    moveSpeedScale: (grid.rowStep / PENINSULA_ROW_HEIGHT) * RUN_SPEED_SCALE,
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

// a character standing in a scene. x is the middle of its feet, and y the ground under them, so it sorts with the pieces.
// the Street's perspective: how tall a worker stands, for how far down the scene their feet are
const getWorkerHeight = y => Math.max(80 + 0.592 * (y - 372), 24); // never smaller than this, far up the street

const standingAgent = (x, y) => ({ avatar: 'agent', spot: { x, y }, facingDir: 'down' });

// a worker who runs between spots beside other workers, and stands at each for a while: a board piece,
// so it faces the way it runs (its back to the camera going up the street), and shrinks with distance.
// a spot marked 'pass' is only run through, to keep them off the Kaiju parts.
const hazmatRunner = (id, route, runSpeed, idleSeconds) => ({
  id, avatar: 'hazmat', route: route.map(([x, y, pass]) => ({ x, y, isPass: pass == 'pass' })), runSpeed, idleSeconds
});
export type Walker = ReturnType<typeof hazmatRunner>;

const hazmatSweeper = (id, pose, x, y) => ({ ...npc(id, pose, x, y, getWorkerHeight(y)), isSweeping: true });

const npc = (id, pose, x, y, height, glowPhase = undefined, glowColor = undefined, sortY = y) => ({
  id, type: 'npc' as const, src: `/levels/npcs/${pose}.png`, x, y, width: 0, height, sortY, glowPhase, glowColor
});

const RIVAL_LOOK = { maxLives: 6, moveSpeed: 5 };

// on once the bystander's piece starts to fight
export const RIVAL_IN_PHASE = 'rivalIn';

const signalLight = (id, x) => [
  { id: `${id}Off`, type: 'sprite' as const, src: '/levels/rapidTransit/lights-spritesheet.png', x, y: 3, width: 48, height: 94, zIndex: -2, firstFrame: 0, frames: 1, fps: 1 },
  { id, type: 'sprite' as const, phase: 'trainLights', src: '/levels/rapidTransit/lights-spritesheet.png', x, y: 3, width: 48, height: 94, zIndex: -2, firstFrame: 1, frames: 2, fps: 2 }
];

// moths circle each lamp. each one flutters on its own timing.
const moths = (id, x, y, flip, flutterSeconds, delaySeconds) => ({
  id, type: 'moth' as const, src: '/levels/rapidTransit/moths-spritesheet.png', x, y, width: 82, height: 88, zIndex: -1, frames: 4, fps: 8, flip, flutterSeconds, delaySeconds
});

const PART_TOUCH_HOLD_MS = 4200; // long enough for the part's whole transformation and flash
const SHATTER_HOLD_MS = 2500;

const RAPID_TRANSIT_SCENE = {
  hasTrainSchedule: true,
  rival: {
    ...RIVAL_LOOK,
    avatar: 'punk',
    abilities: ['wood', 'glass', 'metal'], touchPhase: 'eyeTouched', spot: { x: 1213, y: 530 }, recruitSpot: { x: 690, y: 560 }, pronoun: 'him',
    canTeleportAcross: true, // his Teleport takes him over the tracks to another platform, away from the team
    startFacing: 'up',
    introSortY: 640, // stands in front of the eye
    intro: {
      focus: { x: 1090, y: 430 },
      zoomScale: 1.6,
      lines: getIntroLines('rapidTransit.intro')
    }
  },
  shakePhases: ['train'],
  wideShots: { eyeTouched: PART_TOUCH_HOLD_MS },
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
  rival: {
    ...RIVAL_LOOK,
    avatar: 'black_female',
    abilities: ['death', 'glass', 'metal'], touchPhase: 'headTouched', spot: { x: 733, y: 542 }, recruitSpot: { x: 712, y: 345 }, isStandingBeside: true, pronoun: 'her',
    startFacing: 'up',
    introSortY: 600, // stands in front of the head
    intro: {
      focus: { x: 733, y: 470 },
      zoomScale: 1.5,
      lines: getIntroLines('rooftop.intro'),
      // the touch plays out on the whole Kaiju part, then a beat on her, filled with its power. draft words.
      isTouchWide: true,
      afterTouch: getDialogueLine('rooftop.afterTouch')
    }
  },
  phases: [{ id: 'head', label: 'Kaiju head' }, { id: 'headTouched', label: 'Touch part' }],
  defaultPhases: ['head'],
  sceneElements: [
    { id: 'head', type: 'part' as const, phase: 'head', touchPhase: 'headTouched', src: '/levels/rooftop/head-spritesheet.png', x: 255, y: 233, width: 959, height: 519, sortY: 573, seconds: 4.5, flashColor: '#ff1a0d',
      overFront: { box: [255, 233, 515, 376], sortY: ABOVE_CHARACTERS + 1 } } // the head is in front of the crane where they overlap
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

const TANK_SORT_Y = 650; // the middle of the round tank: characters south of it stand in front of it

const AQUARIUM_SCENE = {
  wideShots: { tongueTouched: PART_TOUCH_HOLD_MS, shattered: SHATTER_HOLD_MS },
  rival: {
    ...RIVAL_LOOK,
    avatar: 'mermaid',
    abilities: ['bubble', 'water', 'charm'], touchPhase: 'tongueTouched', spot: { x: 872, y: 655 }, recruitSpot: { x: 430, y: 700 }, pronoun: 'her',
    startFacing: 'down',
    introSortY: 655,
    intro: {
      focus: { x: 780, y: 590 },
      zoomScale: 1.6,
      lines: getIntroLines('aquarium.intro')
    }
  },
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
    { id: 'tongue', type: 'part' as const, phase: 'tongue', touchPhase: 'tongueTouched', src: '/levels/aquarium/tongue-spritesheet.png', x: 549, y: 516, width: 305, height: 161, sortY: TANK_SORT_Y, seconds: 3.5, flashColor: '#ff1464' }
  ]
};

// a soft colored light over the sewer opening. x and y are its center.
const sewerLight = (id, color, x, y, size, seconds, delaySeconds, highOpacity) => ({
  id, type: 'light' as const, phase: 'glow', color, x: x - size / 2, y: y - size / 2, width: size, height: size, zIndex: -3, seconds, delaySeconds, lowOpacity: 0, highOpacity
});

const SEWER1_WALK_IN = {
  teammateSpot: { x: 640, y: 530 }, // out on the catwalk
  doorTile: { i: 37, j: 11 },
  // the recruits spread out to rest around the sewer, away from the door
  standSpots: [{ x: 1180, y: 540 }, { x: 960, y: 610 }, { x: 820, y: 470 }],
  talkBeatMs: 2500,
  isWaitingToBePassed: true, // the recruits and the teammate wait where they rest until the player goes by, heading left
  script: getDialogueScript('sewer1.walkIn'),
  // then the doorway lights up, someone sees it, and after a beat the way on shows. draft words.
  // the line goes to the log; the camera then looks at the glow for 3 s, the way on shows, 2 s more, and back
  reveal: { glowPhase: 'glow', line: getDialogueScript('sewer1.reveal')[0], beatMs: 2500, shownPhase: 'deeperShown', lookSpot: { x: 315, y: 362 }, lookMs: 3000, labelMs: 2000 }
};

const SEWER1_TALK = [
  { id: 'exit', type: 'door' as const, phase: EXIT_OPEN_PHASE, x: 250, y: 420, width: 0, height: 0, sortY: ABOVE_CHARACTERS, label: 'Deeper' }
];

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

const SEWER_PART_SECONDS = 4; // the shared beat of Sewer 2's glowing parts

const sewerPart = (id, x, y, width, height, seconds, delaySeconds, glowColor) => ({
  id, type: 'part' as const, src: `/levels/sewer2/${id}-spritesheet.png`, x, y, width, height, zIndex: -2, seconds, delaySeconds, brightPhase: 'blinding', glowColor
});

// draft words: the parts have been in the next room all along, and there's no going back from touching them
const SEWER2_WALK_IN = {
  doorTile: { i: 18, j: 4 },
  standSpots: [{ x: 1100, y: 520 }, { x: 1040, y: 590 }, { x: 1170, y: 600 }],
  frontSpots: [{ x: 705, y: 560 }, { x: 772, y: 598 }], // the player and teammate step to the front of the group, on the far left, before they talk
  script: getDialogueScript('sewer2.walkIn'),
  ending: { spots: [{ x: 638, y: 523 }, { x: 705, y: 485 }], phase: 'blinding', climaxMs: 8500 } // the climb to the whiteout, in SceneElements
};

const SEWER2_SCENE = {
  tileTone: 'faint' as const,
  walkIn: SEWER2_WALK_IN,
  phases: [{ id: 'blinding', label: 'Blinding light' }],
  sceneElements: [
    // all on one beat, a little apart: one creature's parts pulsing together
    sewerPart('eye', 601, 133, 284, 369, SEWER_PART_SECONDS, 0, '#e6ff3a'),
    sewerPart('tail', 28, 96, 455, 349, SEWER_PART_SECONDS, 0.35, '#b13cff'),
    sewerPart('tooth', 458, 330, 165, 179, SEWER_PART_SECONDS, 0.15, '#2a9cff'),
    sewerPart('viscera', 320, 191, 219, 157, SEWER_PART_SECONDS, 0.5, '#ff9a1f'),
    sewerPart('bone', 287, 410, 602, 358, SEWER_PART_SECONDS, 0.25, '#ff3d6e'),
    sewerPart('claw', 5, 411, 379, 271, SEWER_PART_SECONDS, 0.6, '#22e08a'),
    { id: 'whiteout', type: 'whiteout' as const, phase: 'blinding', x: 0, y: 0, width: 1408, height: 768, sortY: ABOVE_CHARACTERS * 2 }
  ]
};

const streetGlow = (id, x, y, width, height, seconds, delaySeconds) => ({
  id, type: 'pulse' as const, isUneven: true, blend: 'screen' as const, src: `/levels/street/${id}-glow.png`, x, y, width, height, zIndex: -3, seconds, delaySeconds, lowOpacity: 0.05, highOpacity: 0.9
});

// short, so each bubble is one easy thought
const STREET_LINES = getDialogueTexts('street.talk');

const STREET_TALK_MS = STREET_LINES.reduce((total, line) => total + getSpeechMs(line), 0);

const STREET_SCENE = {
  tileTone: 'dark' as const,
  walkers: [
    // all behind where the team can walk (its tiles start at y 543), so they never cross in front of anyone.
    // across the far street, between the tail's goo and the eye
    hazmatRunner('hazmat2', [[795, 372], [965, 382]], 120, 5),
    // up and down the right sidewalk, from the far end to the mid-ground, beside the lamp post
    hazmatRunner('hazmat4', [[1258, 330], [1262, 505]], 120, 6),
    // out of the far street toward the parked car and back, past the eye's far side
    hazmatRunner('hazmat5', [[1040, 318], [1130, 300], [1175, 400, 'pass'], [1180, 505], [1175, 400, 'pass']], 110, 7)
  ],
  getWalkerHeight: getWorkerHeight, // how tall a worker stands at a spot's y, in scene pixels
  // the whole street, then in on the Agent as he calls the team over, then back to them. his words follow in the log.
  // he calls again every so often, until the team walks over to him. then the rest of his words follow.
  greeting: { text: getDialogueTexts('street.greeting')[0], speechSpot: { x: 335, y: 372 }, repeatMs: 7000, nearRows: 3 },
  extras: [standingAgent(335, 682)],
  sceneElements: [
    hazmatSweeper('hazmat1', 'hazmatBroomLeft', 740, 600),
    hazmatSweeper('hazmat3', 'hazmatBroomRight', 1005, 372),
    // the claw's goo covers about x 785 to 1160, y 380 to 575, and the eye's x 1035 to 1165, y 280 to 375
    { id: 'exit', type: 'door' as const, phase: EXIT_OPEN_PHASE, x: 135, y: 660, width: 0, height: 0, sortY: ABOVE_CHARACTERS, label: 'Go To Peninsula' },
    {
      id: 'agentSpeech', type: 'speech' as const, x: 335, y: 372, width: 0, height: 0, sortY: ABOVE_CHARACTERS,
      lines: STREET_LINES,
      dialogue: 'street.talk' // who says each line, from the dialogue file
    },
    streetGlow('hand', 586, 0, 168, 129, 4.7, 0),
    streetGlow('tail', 571, 126, 348, 266, 6.3, 1.4),
    streetGlow('tentacle', 901, 56, 173, 173, 3.9, 0.6),
    streetGlow('eye', 961, 251, 233, 151, 5.2, 2.1),
    streetGlow('claw', 751, 361, 453, 243, 7.1, 0.3),
    streetGlow('van', 361, 471, 148, 148, 4.3, 1)
  ]
};

// the Agent's clones, stepped out of the tanks behind them
const agentClone = (id, x) => ({ ...npc(id, 'agent', x, 170, 95), phase: 'clones' });

export const LAB_TALK_PHASE = 'labTalk';

const LAB_INTRO_SCENE = {
  // on the back wall at the right, beside the techs' desk: a short reach, so walking right along the floor never takes it
  exit: { spot: { x: 1090, y: 565 }, afterMs: 0, nearRows: 1.2 },
  extras: [standingAgent(720, 660)],
  sceneElements: [
    {
      id: 'agentWelcome', type: 'speech' as const, x: 720, y: 445, width: 0, height: 0, sortY: ABOVE_CHARACTERS, hidePhase: LAB_TALK_PHASE,
      lines: getDialogueTexts('labIntro.welcome'),
      dialogue: 'labIntro.welcome'
    },
    {
      id: 'agentNervous', type: 'speech' as const, phase: LAB_TALK_PHASE, x: 720, y: 445, width: 0, height: 0, sortY: ABOVE_CHARACTERS,
      lines: getDialogueTexts('labIntro.nervous'),
      dialogue: 'labIntro.nervous'
    },
    { id: 'avatarTank', type: 'hotspot' as const, action: 'powers', label: 'Change powers', labelY: 345, outline: '/levels/lab-outline-avatars.png', x: 62, y: 235, width: 175, height: 440, rotate: -24, sortY: ABOVE_CHARACTERS },
    { id: 'specimenTank', type: 'hotspot' as const, action: 'agentTalk', label: 'What is this?', labelY: 300, outline: '/levels/lab-outline-specimen.png', x: 290, y: 310, width: 170, height: 300, rotate: -24, sortY: ABOVE_CHARACTERS, hidePhase: LAB_TALK_PHASE },
    { id: 'colorTank', type: 'hotspot' as const, action: 'colors', label: 'Choose color', labelY: 330, outline: '/levels/lab-outline-colors.png', x: 1225, y: 370, width: 170, height: 340, rotate: 34, sortY: ABOVE_CHARACTERS },
    { id: 'exit', type: 'door' as const, phase: EXIT_OPEN_PHASE, x: 1090, y: 530, width: 0, height: 0, sortY: ABOVE_CHARACTERS, label: 'Exit' }
  ]
};

// draft words: the Agent's reveal, before the fight
const LAB_SHOWDOWN_SCRIPT = getDialogueScript('lab.showdown');

const LAB_SCENE = {
  showdown: { script: LAB_SHOWDOWN_SCRIPT, speechSpot: { x: 700, y: 365 } },
  extras: [standingAgent(700, 480)],
  agentDrops: {
    kits: {
      enforcer: ['fire', 'lightning', 'metal'], // Wildfire, Discharge, Aegis
      frostWarden: ['ice', 'water', 'bubble'], // Ice Slice, Tidal Wave, Dispel
      reaper: ['death', 'wood', 'glass'], // Haunt, Overgrowth, Escape
      handler: ['charm', 'kaijuFire', 'love'] // Charm, Kaiju Fire, Heal
    },
    // the Agent who did the talking: he teleports up to the catwalk, leaving a portal, and comes down once his clones have
    talkerKit: 'reaper',
    maxLives: 4,
    moveSpeed: 5,
    firstDropMs: 1500,
    dropIntervalMs: 7000,
    catwalkY: 130,
    catwalkLastRow: 6,
    portalColumns: 2,
    floorY: 450,
    // four in all, with the talker
    drops: [{ x: 330, isFromLeft: true, kit: 'enforcer' }, { x: 1080, isFromLeft: false, kit: 'frostWarden' }, { x: 470, isFromLeft: true, kit: 'handler' }],
    headStartMs: [3000, 5000] as [number, number]
  },
  phases: [{ id: 'clones', label: 'Agent clones' }],
  sceneElements: [
    agentClone('clone1', 97),
    agentClone('clone2', 233),
    agentClone('clone3', 1053),
    agentClone('clone4', 1172),
    agentClone('clone5', 1310)
  ]
};

// everything about a level that isn't in its file
const LEVEL_BUILDERS: Record<string, (file) => LevelConfig> = {
  peninsula: file => ({
    ...buildLevel(file, 'Peninsula', '#5a8a7a'),
    layers: [
      { src: '/Map.gif', zIndex: -4 },
      { src: '/landDimmer.png', zIndex: -3 }
    ],
    kaijuEntry: {
      perimeterTiles: file.tileSets.kaijuEntry,
      bounds: { minX: -5, minY: 0, maxX: 485, maxY: 770 }
    }
  }),
  rapidTransit: file => ({ ...buildLevel(file, 'Rapid Transit Station', '#57E931'), ...RAPID_TRANSIT_SCENE }),
  rooftop: file => ({
    ...buildLevel(file, 'Rooftop Cemetary', '#880808', [
      { src: '/levels/rooftop-crane.png', x: 0, y: 0, width: 515, height: 376, sortY: ABOVE_CHARACTERS }
    ]),
    ...ROOFTOP_SCENE
  }),
  aquarium: file => ({
    ...buildLevel(file, 'Kaiju City Aquarium', '#C5063F', [
      { src: '/levels/aquarium-railing.png', x: 0, y: 219, width: 1408, height: 161, sortY: 267 },
      { src: '/levels/aquarium-tank.png', x: 549, y: 575, width: 305, height: 145, sortY: TANK_SORT_Y }
    ]),
    ...AQUARIUM_SCENE
  }),
  labIntro: file => ({ ...buildLevel(file, 'Lab', '#4a8fb0', [], true), ...LAB_INTRO_SCENE }),
  lab: file => ({
    ...buildLevel(file, 'Lab Window', '#4a8fb0'),
    ...LAB_SCENE,
    layers: [
      { src: '/levels/lab-window.png', zIndex: -5 }, // seen through the window. a placeholder until there is landscape art.
      { src: '/levels/lab.png', zIndex: -4 }
    ]
  }),
  sewer1: file => {
    const level = { ...buildLevel(file, 'Sewer 1', '#7a8a3a', [], true), ...SEWER1_SCENE, hasRecruitFollowers: true, isDepowered: true };
    return { ...level, sceneElements: [...level.sceneElements, ...SEWER1_TALK], exit: { spot: { x: 250, y: 430 }, afterMs: Infinity, afterPhase: 'deeperShown' }, walkIn: SEWER1_WALK_IN };
  },
  sewer2: file => ({ ...buildLevel(file, 'Sewer 2', '#7a8a3a', [], true), ...SEWER2_SCENE, hasRecruitFollowers: true, isDepowered: true }),
  street: file => ({
    ...buildLevel(file, 'Street', '#7a8a3a', [], true),
    ...STREET_SCENE,
    // on the tile of the hazmat worker sweeping by the van, once the Agent has had his say
    unlock: { id: 'hazmat', label: 'Hazmat worker', image: '/levels/portraits/hazmat.png', spot: { x: 740, y: 600 }, afterMs: STREET_TALK_MS },
    exit: { spot: { x: 112, y: 690 }, afterMs: STREET_TALK_MS, isShownWhenOpen: true } // after the Agent's words, and the camera shows it
  })
};

const getSpotDistance = ({ grid }, tile, { x, y }) => {
  const center = getTileCenter(grid, tile);
  return Math.hypot(center.x - x, center.y - y);
};

// the mist drifting around a site on the map, relative to the site
const MIST_PUFFS = [[0, 0, 120, 3.1], [-34, 18, 90, 4.3], [36, -14, 100, 5.2], [14, 34, 80, 3.7], [-22, -30, 84, 6.1]];

const MAP_ICONS = {
  subway: { width: 74, height: 43 }, // two thirds of the art's size
  rooftop: { width: 62, height: 77 },
  aquarium: { width: 90, height: 72 },
  lab: { width: 104, height: 78 }
};

// the Lab can be visited from the map, and then the walk carries on
const LAB_SPOT = { x: 150, y: 680 };
const LAB_SITE = { spot: LAB_SPOT, color: '#4a8fb0', icon: 'lab', isDetour: true };

// where to go next pulses: a bright ring of its color, in and out, under its icon
const MISSION_PULSE = { size: 190, seconds: 1.3, lowOpacity: 0.1, highOpacity: 0.95 };

const getSiteElements = ({ spot, color, icon, isDetour = false, visitLevelId = undefined }) => [
  ...(isDetour ? [] : [{
    id: `${icon}Pulse`, type: 'light' as const, color, x: spot.x - MISSION_PULSE.size / 2, y: spot.y - MISSION_PULSE.size / 2,
    width: MISSION_PULSE.size, height: MISSION_PULSE.size, zIndex: -1, seconds: MISSION_PULSE.seconds, lowOpacity: MISSION_PULSE.lowOpacity, highOpacity: MISSION_PULSE.highOpacity
  }]),
  // a battleground already won keeps its icon, without the glow
  ...(visitLevelId ? [] : MIST_PUFFS).map(([x, y, size, seconds], n) => ({
    id: `${icon}Mist${n}`, type: 'light' as const, color, x: spot.x + x - size / 2, y: spot.y + y - size / 2, width: size, height: size, zIndex: -2, seconds, delaySeconds: -n, lowOpacity: 0.2, highOpacity: 0.75
  })),
  {
    id: `${icon}Icon`, type: 'image' as const, src: `/levels/map/${icon}.png`, x: spot.x - MAP_ICONS[icon].width / 2, y: spot.y - MAP_ICONS[icon].height / 2, width: MAP_ICONS[icon].width, height: MAP_ICONS[icon].height, zIndex: 5 // above the tiles
  }
];

// walking the map to the next site, from one spot to another, in scene pixels
// 'teammateStart': where the teammate starts, when not just beside the player
const buildMapWalk = (id, name, { start, teammateStart = undefined }, sites) => {
  const level = LEVEL_BUILDERS.peninsula(peninsula);
  const getClosest = target => level.walkableTiles.reduce((closest, tile) => getSpotDistance(level, tile, target) < getSpotDistance(level, closest, target) ? tile : closest);
  return {
    ...level,
    id,
    name,
    isWalkingLevel: true,
    isMapWalk: true,
    kaijuEntry: undefined,
    sites,
    spawnTiles: [start, teammateStart || { x: start.x + 25, y: start.y }].map(getClosest),
    phases: [],
    defaultPhases: [],
    sceneElements: sites.flatMap(getSiteElements)
  };
};

export const LEVEL_FILES = { peninsula, rapidTransit, rooftop, aquarium, labIntro, lab, sewer1, sewer2, street };

export const LEVELS: Record<string, LevelConfig> = Object.fromEntries(
  Object.entries(LEVEL_FILES).map(([id, file]) => [id, LEVEL_BUILDERS[id](file)])
);

// sites are placed as in the mission map mockup
const FOOT = { x: 230, y: 660 };
const BATTLEGROUND_SITES = {
  rapidTransit: { spot: { x: 126, y: 279 }, color: '#57E931', icon: 'subway' },
  rooftop: { spot: { x: 238, y: 122 }, color: '#ff2a2a', icon: 'rooftop' },
  aquarium: { spot: { x: 222, y: 480 }, color: '#C5063F', icon: 'aquarium' } // up the east coast, clear of the Lab
};
// each walk starts where the last fight left off (Jamie's marks on the map)
const MAP_WALKS = [
  ['mapSubway', 'Map to Subway', { start: { x: 250, y: 505 } }, [BATTLEGROUND_SITES.rapidTransit, LAB_SITE]],
  ['mapRooftop', 'Map to Rooftop', { start: FOOT }, [BATTLEGROUND_SITES.rooftop, LAB_SITE]],
  ['mapAquarium', 'Map to Aquarium', { start: { x: 90, y: 345 }, teammateStart: { x: 70, y: 470 } }, [BATTLEGROUND_SITES.aquarium, LAB_SITE]],
  ['mapLab', 'Map to Lab', { start: { x: 143, y: 214 }, teammateStart: { x: 104, y: 131 } }, [{ ...LAB_SITE, isDetour: false }]]
] as const;

// a battleground the player has won on can be visited again from the map: a walk around it, and back
export const getVisitLevelId = (levelId: string) => `visit-${levelId}`;
const VISIT_LINES = getDialogueTexts('visit');

// the map walks show the battlegrounds already won on, as well as where to go next
// only those that come before this walk in the campaign: a battleground not reached yet never shows, even if won in an earlier playthrough
export const updateMapWalkSites = (visitedIds: Array<string>) => {
  const getWalkIndex = levelId => MAP_WALKS.findIndex(([, , , sites]) => sites.includes(BATTLEGROUND_SITES[levelId]));
  MAP_WALKS.forEach(([id, name, start, sites], walkIndex) => {
    const visited = visitedIds
      .filter(levelId => BATTLEGROUND_SITES[levelId] && !sites.includes(BATTLEGROUND_SITES[levelId]) && getWalkIndex(levelId) < walkIndex)
      .map(levelId => ({ ...BATTLEGROUND_SITES[levelId], isDetour: true, visitLevelId: getVisitLevelId(levelId) }));
    LEVELS[id] = buildMapWalk(id, name, start, [...sites, ...visited]);
  });
};
updateMapWalkSites([]);

// the Lab's fight scene, before the fight: where the Agent takes the player's powers back
LEVELS.labTrap = {
  ...LEVELS.lab,
  id: 'labTrap',
  name: 'Lab Trap',
  isWalkingLevel: true,
  cameraZoom: 1,
  agentDrops: undefined,
  exit: { spot: { x: 1290, y: 480 }, afterMs: 0 },
  hasRecruitFollowers: true, // the recruits are here too, and run with the teammate
  trap: {
    // the Agent's four lines are Jamie's. the clones, the teammate's line and the ray are a draft.
    script: getDialogueScript('labTrap.trap'),
    speechSpot: { x: 700, y: 365 },
    lineUp: { y: 610, spacing: 80 }, // the team stands in a row in front of the Agent
    // said as the chase starts, while everyone runs. draft words.
    chaseLines: getKeyedLines('labTrap.chase') as { agent: string; teammate: string; teammateWithRecruits: string },
    ray: { from: { x: 700, y: 440 }, color: '#7dffef', ms: 2200 },
    chasers: { xs: [480, 700, 920], startY: 830, landingY: 640, moveSpeed: 5, abilities: [] }
  },
  extras: [standingAgent(700, 480)],
  phases: [{ id: 'clones', label: 'Agent clones' }],
  sceneElements: [
    ...LAB_SCENE.sceneElements.filter(({ phase }) => phase == 'clones'),
    { id: 'exit', type: 'door' as const, phase: EXIT_OPEN_PHASE, x: 1290, y: 470, width: 0, height: 0, sortY: ABOVE_CHARACTERS, label: 'Escape!' }
  ]
};

// the battleground as a walk: no bystander, no trains, and a door back to the map where the bystander once lay
// on a visit, the way out can be where the team came in: they arrive a little way past it, clear of the door
const VISIT_ENTRANCE_EXITS = {
  rapidTransit: { walkInPx: { x: 40, y: 165 } } // down the left platform from the stairs, past the door's reach (two rows)
};

// where a visit's way out is, and where the team starts, when not the fight's own spots
const VISIT_SPOTS = {
  rooftop: { exit: { x: 958, y: 338 } }, // the stairwell door at the back, on the right
  aquarium: { exit: { x: 270, y: 715 }, start: { x: 470, y: 605 } } // out at the bottom left; the team starts up by the tank
};

Object.keys(BATTLEGROUND_SITES).forEach(levelId => {
  const level = LEVELS[levelId];
  const entranceExit = VISIT_ENTRANCE_EXITS[levelId];
  const entrance = entranceExit && getTileCenter(level.grid, level.spawnTiles[0]);
  const visitSpots = VISIT_SPOTS[levelId] || {};
  const doorSpot = visitSpots.exit || entrance || level.rival.recruitSpot;
  const getClosest = target => level.walkableTiles.reduce((closest, tile) => getSpotDistance(level, tile, target) < getSpotDistance(level, closest, target) ? tile : closest);
  const spawnTiles = visitSpots.start ? [getClosest(visitSpots.start)]
    : entrance ? [getClosest({ x: entrance.x + entranceExit.walkInPx.x, y: entrance.y + entranceExit.walkInPx.y })] : level.spawnTiles;
  LEVELS[getVisitLevelId(levelId)] = {
    ...level,
    id: getVisitLevelId(levelId),
    name: `${level.name} (visit)`,
    isWalkingLevel: true,
    cameraZoom: 1, // walking scenes are seen whole
    rival: undefined,
    hasTrainSchedule: false,
    defaultPhases: [],
    wideShots: {},
    liveWideShots: {},
    visitLines: VISIT_LINES,
    spawnTiles,
    exit: { spot: doorSpot, afterMs: 0 },
    sceneElements: [
      ...level.sceneElements,
      { id: 'exit', type: 'door' as const, phase: EXIT_OPEN_PHASE, x: doorSpot.x, y: doorSpot.y, width: 0, height: 0, sortY: ABOVE_CHARACTERS, label: 'Back to map' }
    ]
  };
});

export const PENINSULA = LEVELS.peninsula;

// the level editor saved a level: the game uses it from now on
export const applyLevelFile = file => {
  LEVEL_FILES[file.id] = file;
  LEVELS[file.id] = LEVEL_BUILDERS[file.id](file);
};
