import { getDialogueLine, getDialogueScript, getDialogueTexts, getIntroLines, getKeyedLines } from 'Game/DataClasses/Dialogue/dialogue';
import { getSpeechMs } from '../speechTiming';
import { getTileCenter, getTileIndexAtLocation } from 'Game/DataClasses/GameBoard/hexGrid';
import { GIANT_KAIJU } from 'Game/DataClasses/GiantKaiju';
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
  type: 'image' | 'sprite' | 'pulse' | 'light' | 'sequence' | 'part' | 'moth' | 'whiteout' | 'npc' | 'speech' | 'walker' | 'door' | 'hotspot' | 'mapLabel';
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
  labelX?: number; // hotspot: its label's middle, if not over its middle
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
  isTraining?: boolean; // a recruit training the player, one on one: no intro, no Kaiju part
  isSparring?: boolean; // the teammate is the one to beat (their look and powers, at the start)
  touchPhase: string; // the phase where they touch the Kaiju part. the fight starts once it plays out.
  spot: { x: number; y: number }; // where the fight starts from, in scene pixels
  recruitSpot: { x: number; y: number }; // where they lie for the player's choice, in scene pixels
  isStandingBeside?: boolean;
  roam?: { everyMs: number; minRows: number; topFloorMinRows?: number }; // she heads somewhere far off this often (the Mermaid, Jamie)
  screamFlashColor?: string; // her scream's screen flash, when the team is teleported (the Rooftop's red if not given)
  linkRestMs?: number; // each link rests this long for her after she takes it, so she takes the other
  canTeleportAcross?: boolean; // a Teleport may land on tiles it can't walk to, like the other platforms // for the choice, the team stands either side of them (the Rooftop, below the RIP stone)
  cooldownScales?: Record<string, number>; // by element: this rival's cooldowns times this (the fight only, not training)
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
  isCatwalkOpenToTeam?: boolean; // the team's NPCs may go up to the catwalk (through the portal)
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
  radarTiles?: Array<TileIndex>; // the Peninsula: land beyond the map, for the radar's outline (Jamie, G13)
  isWalkingLevel: boolean; // a scene to walk through: no powers, and no HUDs
  isDepowered?: boolean; // after the Lab trap: the player's side has no glow
  visitLines?: Array<string>; // a battleground visited again: what the teammate says on arrival
  visitScene?: string; // the dialogue scene of those words ('visit' if not given)
  training?: { recruit: string; spot: { x: number; y: number }; levelId: string; sparringLevelId: string }; // a visit: the recruit's offer of training, and where it starts
  isTraining?: boolean; // a recruit's training fight: one on one, for their power
  visitLevelId?: string; // a training fight: the walking battleground it goes back to
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
  transformScene?: string; // after the fight is won, the teammate transforms (dialogue.json)
  finalTurn?: { scene: string; aloneScene: string; kaijuLives: number; coolDownMs: number; castEveryMs: number; isStartTurned?: boolean }; // the last fight: once its Kaiju are beaten, the teammate turns Kaiju
  linkWalls?: Array<{ tile: TileIndex; point: { x: number; y: number }; behind: { x: number; y: number }; outDir: { x: number; y: number }; outTile?: TileIndex }>; // where a tile link's walk-through goes out of sight (and, maybe, the tile the walk out ends on)
  giantKaiju?: { // the final battle (GiantKaiju.ts): the teammate as a giant Kaiju, marching up the Peninsula
    route: Array<{ x: number; y: number }>; // from the foot of the Peninsula to the city, in the big map's pixels
  };
  aquariumFlood?: { // the Aquarium fight in phases (AquariumFlood.ts)
    panels: Array<{ phase: string; focus: { x: number; y: number }; pour: { x: number; y: number } }>; // the glass, in the order it breaks
    topSpot: { x: number; y: number }; // where she goes up to, to heal
    teamSpot: { x: number; y: number }; // where her scream pulls the team
    groundSpot: { x: number; y: number }; // where she comes back down to
    topFloor: { maxY: number; stairs: { minX: number; maxX: number; minY: number } }; // her ground while the tanks pour: above maxY, less the middle stairs
    screamScene: string;
    creaturesScene: string;
  };
  ghostBoss?: { // the Rooftop fight in phases (GhostBoss.ts)
    ringSpot: { x: number; y: number }; // where the team is pulled to
    ringCenter: { x: number; y: number }; // the ring's middle
    rivalSpot: { x: number; y: number }; // where she goes after each scream
    rivalGround: { maxI: number; beamFromI: number; beamFromJ: number }; // her roof: tiles up to column maxI, less the beam
    screamScene: string; // her words before the scream, in dialogue.json
  };
  exit?: { spot: { x: number; y: number }; afterMs?: number; afterPhase?: string; isShownWhenOpen?: boolean; nearRows?: number }; // opens after a time or a phase. reaching it ends the level.
  walkIn?: { // the opening of a scene: who stands where, and who says what
    teammateSpot?: { x: number; y: number };
    doorTile: { i: number; j: number }; // where recruits walk in from
    standSpots: Array<{ x: number; y: number }>;
    frontSpots?: Array<{ x: number; y: number }>; // where the player and teammate step to before the words
    isTeamInPlace?: boolean; // the recruits are already in their places: no one comes in at the door but the player (and teammate, to frontSpots)
    playerSpot?: { x: number; y: number }; // with isTeamInPlace: where the player walks in to, from the door
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
    chasers: { xs: Array<number>; startY: number; landingY: number; moveSpeed: number; abilities: Array<string>; dropFrom?: { y: number; cloneIds: Array<string>; phase: string } };
  };
  hasRecruitFollowers?: boolean; // recruited characters walk with the team
  sites?: Array<MapSite>; // places on the map to walk to
  isMapWalk?: boolean; // walked at the close camera, unlike other walking scenes
  goalColor?: string; // the goal tile's color, if not the usual gold light
  agentDrops?: AgentDrops;
  cameraZoom: number; // how close the camera sits during play. at 1, the whole scene fits the frame.
  liveWideShots?: Record<string, number>; // the same, for phases the game keeps running through
  skillOnLeave?: string; // a power (its element) that opens once the player leaves the level
  coverPanLeftX?: number; // a walking scene: with the player left of this, the view goes all the way to the scene's left edge
  coverPanRightX?: number; // the same, right of this, to its right edge
  unlock?: { id: string; label: string; image?: string; spot: { x: number; y: number }; afterMs?: number; isRecruit?: boolean }; // a hidden tile, in scene pixels. 'afterMs': it only unlocks after this long
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
  // 'radar': the Peninsula's land on the radar beyond the map (bridges, the Bay), painted in Edit tiles: not walked on
  const { spawn = [], goal = [], kaijuEntry, radar = [], ...tileSets } = editorFile.tileSets;
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
    radarTiles: radar,
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
    cooldownScales: { glass: 0.5 }, // he teleports twice as often, in this fight only: 8 s, not 16 (Jamie, playtest 18)
    startFacing: 'up',
    introSortY: 640, // stands in front of the eye
    intro: {
      focus: { x: 1090, y: 430 },
      zoomScale: 1.6,
      lines: getIntroLines('rapidTransit.intro'),
      afterTouch: getDialogueLine('rapidTransit.afterTouch') // he knows what he is now (Jamie)
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

// the front railing's overlay: where it sits, and what it is in front of (anyone standing above its bottom rail)
const ROOFTOP_RAILING = { x: 280, y: 570, sortY: 604 };

const ROOFTOP_SCENE = {
  wideShots: { headTouched: PART_TOUCH_HOLD_MS },
  // brought to zero, she screams, the team is pulled to the middle of the graveyard roof (where the Kaiju head was),
  // halfway between the graves and the roof's edge, and she goes back to the left building's roof to fight from there
  ghostBoss: {
    ringSpot: { x: 735, y: 466 }, // where the team lands
    ringCenter: { x: 708, y: 390 }, // the ring's middle: the middle of the graveyard roof (Jamie's mockup)
    rivalSpot: { x: 130, y: 300 },
    rivalGround: { maxI: 18, beamFromI: 8, beamFromJ: 20 }, // the crane beam starts at column 8, row 20
    screamScene: 'rooftop.ghostScream'
  },
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
      // the head is in front of the crane, and of the railing, where they overlap
      overFront: [{ box: [255, 233, 515, 376], sortY: ABOVE_CHARACTERS + 1 }, { box: [255, ROOFTOP_RAILING.y, 1214, ROOFTOP_RAILING.y + 36], sortY: ROOFTOP_RAILING.sortY + 1 }] }
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

// each panel breaks on its own phase: the Mermaid's scream breaks them one at a time (startShatter)
const getGlassPhase = id => `glass-${id}`;

const GLASS_PANELS = GLASS_PANEL_PLACES.map(({ id, x, y, width, height }) => ({
  id: `glass-${id}`,
  type: 'sequence' as const,
  phase: getGlassPhase(id),
  x, y, width, height, startDelayMs: 0,
  zIndex: -2,
  fps: 14, // twice as quick as it was (Jamie)
  featherPx: 22, // soft edges, so the broken tank blends into the hall around it rather than showing as a block (Jamie)
  enter: [1, 2, 3, 4, 5].map(n => `/levels/aquarium/glass/${id}-${n}.png`),
  loop: [`/levels/aquarium/glass/${id}-5.png`],
  exit: []
}));

// a fish leaps out of its tank's panel as the glass bursts
const FISH_BURST_DELAY_SECONDS = 0.3;
// over the tile canvas (z 1) and under every character (their sort z is 20001 and up): the fish flop on the tiles (Jamie)
const ABOVE_TILES_Z = 2;

const fish = (id, x, y, width, height, flip, fps, panelId) => {
  const panel = GLASS_PANEL_PLACES.find(({ id }) => id == panelId);
  return {
    id, type: 'sprite' as const, phase: getGlassPhase(panelId), src: '/levels/aquarium/fish-spritesheet.png', x, y, width, height, sheetFrames: 4, frames: 4, zIndex: ABOVE_TILES_Z, flip, fps,
    comesFrom: { x: panel.x + panel.width / 2, y: panel.y + panel.height / 2 },
    appearSeconds: FISH_BURST_DELAY_SECONDS
  };
};

const TANK_SORT_Y = 650; // the middle of the round tank: characters south of it stand in front of it

const AQUARIUM_SCENE = {
  wideShots: { tongueTouched: PART_TOUCH_HOLD_MS, shattered: SHATTER_HOLD_MS },
  // at zero she screams, the glass shatters, and the tanks pour out across the ground floor (below 'flood.top')
  aquariumFlood: {
    // the panels, left to right, as the scream breaks them: where the camera looks, and where each pours out onto the floor
    panels: GLASS_PANEL_PLACES.map(({ id, x, y, width, height }) => ({ phase: getGlassPhase(id), focus: { x: x + width / 2, y: y + height / 2 }, pour: { x: x + width / 2, y: Math.max(y + height, 560) } })),
    topSpot: { x: 704, y: 228 }, // the walkway over the hall, under the sign
    teamSpot: { x: 702, y: 742 }, // the scream pulls the team here: the bottom of the hall, in the middle, below the tank
    groundSpot: { x: 872, y: 655 },
    topFloor: { maxY: 400, stairs: { minX: 555, maxX: 845, minY: 290 } }, // the middle stairs only go up to the teleport links
    screamScene: 'aquarium.stopScream',
    creaturesScene: 'aquarium.toCreatures' // up on the walkway, to the sea creatures
  },
  rival: {
    ...RIVAL_LOOK,
    avatar: 'mermaid',
    abilities: ['love', 'bubble', 'wink'], touchPhase: 'tongueTouched', spot: { x: 872, y: 655 }, recruitSpot: { x: 430, y: 700 }, pronoun: 'her',
    roam: { everyMs: 6000, minRows: 8, topFloorMinRows: 5 }, // all over the hall (Jamie); the top floor in the flood (playtest 18)
    linkRestMs: 15000, // a stairway she took rests: she runs to the other one
    screamFlashColor: '#ff7ad9', // her teleport flash: pink, as her Charm's, not the Rooftop's red (Jamie)
    startFacing: 'down',
    introSortY: 655,
    intro: {
      focus: { x: 780, y: 590 },
      zoomScale: 1.6,
      lines: getIntroLines('aquarium.intro')
    }
  },
  tileTone: 'dark' as const,
  // walking through a link: the stairs go up behind the pillars, so the body goes out of sight at a pillar's edge.
  // 'point' and 'behind': the edge, and its out-of-sight side. 'outDir': the way down the stairs, out from behind it.
  linkWalls: [
    { tile: { i: 25, j: 11 }, point: { x: 582, y: 313 }, behind: { x: -1, y: 0 }, outDir: { x: 0.86, y: 0.5 } }, // the left stairs
    { tile: { i: 36, j: 12 }, point: { x: 827, y: 327 }, behind: { x: 1, y: 0 }, outDir: { x: -0.86, y: 0.5 } }, // the right stairs
    // the links upstairs by the "To 1st floor" doorways: the way down is behind the foreground wall on the balcony side of
    // each doorway. out of sight past its edge (Jamie's red lines), coming out from behind it toward the doorway, onto the
    // tile below and to that side of the link, and going back in the same way (Jamie, 2026-11-06)
    { tile: { i: 4, j: 8 }, point: { x: 92, y: 217 }, behind: { x: 1, y: 0 }, outDir: { x: -0.86, y: 0.51 }, outTile: { i: 3, j: 8 } }, // the left door: the wall starts at x 92
    { tile: { i: 57, j: 8 }, point: { x: 1316, y: 231 }, behind: { x: -1, y: 0 }, outDir: { x: 0.87, y: 0.49 }, outTile: { i: 58, j: 9 } } // the right door: the wall ends at x 1316
  ],
  phaseTileTones: { shattered: 'white' as const }, // the shattered hall is much darker
  flood: { phase: 'shattered', top: 530 }, // pieces below this line, in scene pixels, walk through water
  phases: [
    { id: 'tongue', label: 'Kaiju tongue' },
    { id: 'tongueTouched', label: 'Touch part' },
    { id: 'shards', label: 'Skylight shards' },
    { id: 'shattered', label: 'Shattered glass' },
    ...GLASS_PANEL_PLACES.map(({ id }) => ({ id: getGlassPhase(id), label: `Glass ${id}` })) // each panel, as the scream breaks it
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
  isTeamInPlace: true, // all in their places as the player walks in, the whole sewer in view; then in close for the words (Jamie)
  talkBeatMs: 3000, // the whole sewer a moment, before the words (Jamie)
  // instead of that (Jamie, playtest 19, to try): in close, then a slow pan right along the recruits resting
  introSweep: { from: { x: 760, y: 470 }, to: { x: 1150, y: 520 }, zoomScale: 1.8, moveInMs: 900, panMs: 3200, holdMs: 600 },
  playerSpot: { x: 1150, y: 610 },
  hazmatSpot: { x: 1075, y: 470 }, // the Hazmat Worker: up and left of the player, the scene's upper right (Jamie, playtest 18)
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
    { id: 'glow', type: 'pulse' as const, phase: 'glow', src: '/levels/sewer1/glow.png', x: 193, y: 274, width: 244, height: 176, zIndex: -3, seconds: 1.6, lowOpacity: 0.05, highOpacity: 0.85 }, // quicker, so it's plain to see (Jamie)
    { id: 'glowEcho', type: 'pulse' as const, phase: 'glow', src: '/levels/sewer1/glow.png', x: 193, y: 274, width: 244, height: 176, zIndex: -3, seconds: 2.5, delaySeconds: 0.6, lowOpacity: 0, highOpacity: 0.7 },
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
  isTeamInPlace: true, // the recruits are already there; only the player and teammate run in, to the front (Jamie)
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
  greeting: { text: getDialogueTexts('street.greeting')[0], speechSpot: { x: 335, y: 372 }, repeatMs: 12000, nearRows: 3 }, // calls every 12 s (Jamie)
  extras: [{ ...standingAgent(335, 682), rowsBack: 4 }], // always drawn behind the player and the teammate (Jamie, playtest 18)
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

// the Kaiju's glow (PIECES_INFO.kaiju.color): Agents empowered as the Kaiju are
const KAIJU_GLOW = '#bf40bf';

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
    { id: 'colorTank', type: 'hotspot' as const, action: 'colors', label: 'Choose color', labelY: 330, labelX: 1215, outline: '/levels/lab-outline-colors.png', x: 1225, y: 370, width: 170, height: 340, rotate: 34, sortY: ABOVE_CHARACTERS }, // labelX: in shot, the art ends at the right (Jamie, playtest 19)
    { id: 'exit', type: 'door' as const, phase: EXIT_OPEN_PHASE, x: 1090, y: 530, width: 0, height: 0, sortY: ABOVE_CHARACTERS, label: 'Exit' }
  ]
};

// draft words: the Agent's reveal, before the fight
const LAB_SHOWDOWN_SCRIPT = getDialogueScript('lab.showdown');

const LAB_SCENE = {
  transformScene: 'lab.transformation', // the clones beaten, the teammate turns into the giant Kaiju (the final battle)
  showdown: { script: LAB_SHOWDOWN_SCRIPT, speechSpot: { x: 700, y: 365 } },
  extras: [standingAgent(700, 480)],
  agentDrops: {
    kits: {
      enforcer: ['fire', 'lightning', 'metal'], // Wildfire, Discharge, Aegis
      frostWarden: ['ice', 'metal', 'bubble'], // Ice Slice, Aegis, Dispel
      reaper: ['death', 'wood', 'glass'], // Haunt, Overgrowth, Escape
      handler: ['wink', 'kaijuFire', 'love'] // Charm, Kaiju Fire, Heal
    },
    // the Agent who did the talking: he teleports up to the catwalk, leaving a portal, and comes down once his clones have
    talkerKit: 'reaper',
    isCatwalkOpenToTeam: true, // the teammate and recruits may follow him up through the portal (Jamie, playtest 18)
    maxLives: 4,
    moveSpeed: 5,
    firstDropMs: 1500,
    dropIntervalMs: 7000,
    catwalkY: 130,
    catwalkLastRow: 6,
    portalWallRows: 2, // the Reaper's portal: this many rows out from the floor's back wall (Jamie)
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
      { src: '/levels/rooftop-crane.png', x: 0, y: 0, width: 515, height: 376, sortY: ABOVE_CHARACTERS },
      // the roof's front railing, cut from the scene (Jamie): anyone behind it shows through the gaps between its bars
      { src: '/levels/rooftop-railing.png', x: ROOFTOP_RAILING.x, y: ROOFTOP_RAILING.y, width: 870, height: 36, sortY: ROOFTOP_RAILING.sortY }
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
  // past the girl at the desk's column, the view goes all the way left, "Change powers" and all (Jamie)
  labIntro: file => ({ ...buildLevel(file, 'Lab', '#4a8fb0', [], true), ...LAB_INTRO_SCENE, coverPanLeftX: 450, coverPanRightX: 950 }),
  lab: file => ({
    // the catwalk's front railing, cut from the scene: whoever is up there is behind it (Jamie)
    ...buildLevel(file, 'Lab Window', '#4a8fb0', [{ src: '/levels/lab-catwalk-railing.png', x: 0, y: 124, width: 1408, height: 48, sortY: 200 }]),
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
    // on the tile of the hazmat worker sweeping by the van: there to be found from the start, before the Agent's words too (Jamie)
    unlock: { id: 'hazmat', label: 'Hazmat Worker', image: '/levels/portraits/hazmat.png', spot: { x: 740, y: 600 }, isRecruit: true }, // "recruited!", as the other recruits' cards (Jamie, playtest 19)
    exit: { spot: { x: 112, y: 690 }, afterMs: STREET_TALK_MS, isShownWhenOpen: true }, // after the Agent's words, and the camera shows it
    skillOnLeave: 'glass' // the scientists' new power, Teleport, from the Agent's words: it opens as the team leaves (picked up at the Lab)
  })
};

const getSpotDistance = ({ grid }, tile, { x, y }) => {
  const center = getTileCenter(grid, tile);
  return Math.hypot(center.x - x, center.y - y);
};

// the mist drifting around a site on the map, relative to the site
const MIST_PUFFS = [[0, 0, 120, 3.1], [-34, 18, 90, 4.3], [36, -14, 100, 5.2], [14, 34, 80, 3.7], [-22, -30, 84, 6.1]];

export const MAP_ICONS = {
  subway: { width: 74, height: 43 }, // two thirds of the art's size
  rooftop: { width: 62, height: 77 },
  aquarium: { width: 90, height: 72 },
  lab: { width: 104, height: 78 }
};

// a one-word label for each site, by its icon and by its caret at the screen's edge (Jamie). 'position': under the
// icon ('bottom') or over it ('top'). 'gapPx': between the icon and the label, in scene pixels.
export const MAP_LABEL = { position: 'bottom' as 'top' | 'bottom', gapPx: 2 };
export const MAP_LABELS: Record<string, string> = { lab: 'lab', subway: 'station', rooftop: 'rooftop', aquarium: 'aquarium' };
// these words go over their icon whatever MAP_LABEL says: the Lab's, under it, is off the screen (Jamie, playtest 18)
export const MAP_LABELS_OVER = ['lab'];

// the Lab can be visited from the map, and then the walk carries on
export const LAB_SPOT = { x: 150, y: 680 };
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
  },
  // its word, under (or over) it
  {
    id: `${icon}Label`, type: 'mapLabel' as const, text: MAP_LABELS[icon] || icon, isOver: MAP_LABEL.position == 'top' || MAP_LABELS_OVER.includes(icon),
    x: spot.x, y: MAP_LABEL.position == 'top' || MAP_LABELS_OVER.includes(icon) ? spot.y - MAP_ICONS[icon].height / 2 - MAP_LABEL.gapPx : spot.y + MAP_ICONS[icon].height / 2 + MAP_LABEL.gapPx,
    width: 0, height: 0, zIndex: 6
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
  ['mapAquarium', 'Map to Aquarium', { start: { x: 90, y: 345 } }, [BATTLEGROUND_SITES.aquarium, LAB_SITE]], // the teammate starts beside the player (Jamie, 2026-11-06)
  ['mapLab', 'Map to Lab', { start: { x: 143, y: 214 }, teammateStart: { x: 104, y: 131 } }, [{ ...LAB_SITE, isDetour: false }]]
] as const;

// a battleground the player has won on can be visited again from the map: a walk around it, and back
export const getVisitLevelId = (levelId: string) => `visit-${levelId}`;
// recruit training (Jamie, 2026-11-10): a 1v1 with the battleground's recruit, on its ground, for their power
export const getTrainingLevelId = (levelId: string) => `train-${levelId}`;
// sparring (Jamie, 2026-11-10): with the bystander there terminated, the teammate offers a 1v1 instead, for health
export const getSparringLevelId = (levelId: string) => `spar-${levelId}`;
// each win, one more training point (temporary health) for the player and the teammate both, to maxPoints each (Jamie):
// 4 health and 6 points, 10 in all. points go first when hit, and are lost for good. the glow is shorter, and the player
// stands still through it
export const SPARRING = { maxPlayerLives: 10, maxPoints: 6, bonusPerWin: 1, rewardPulseMs: 2200 };
export const TRAINING_PHASE = 'trainingOpen'; // the visit's "Do Training" spot is open
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
// the Lab before the trap (Jamie, 2026-11-10): the walking Lab, a must on the way, the Agent not there. the teammate says
// to look for him, and to choose powers now: who knows when there'll be another chance. the way out leads to the trap.
LEVELS.labBeforeTrap = {
  ...LEVELS.labIntro,
  id: 'labBeforeTrap',
  name: 'Lab (before the trap)',
  extras: [],
  visitScene: 'lab.beforeTrap',
  visitLines: getDialogueTexts('lab.beforeTrap'),
  sceneElements: LEVELS.labIntro.sceneElements.filter(({ id }) => !['agentWelcome', 'agentNervous', 'specimenTank'].includes(id))
};

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
    // they drop from the catwalk (Jamie, playtest 18): three of the clones up there jump down, and those clones are gone
    chasers: { xs: [480, 700, 920], startY: 830, landingY: 640, moveSpeed: 5, abilities: [], dropFrom: { y: 170, cloneIds: ['clone2', 'clone3', 'clone4'], phase: 'clonesDropped' } }
  },
  extras: [standingAgent(700, 480)],
  phases: [{ id: 'clones', label: 'Agent clones' }],
  sceneElements: [
    // the clones on the catwalk glow the Kaiju's sinister purple, as the Agents who chase do (Jamie, playtest 18)
    ...LAB_SCENE.sceneElements.filter(({ phase }) => phase == 'clones').map(element => ({
      ...element, glowPhase: 'clones', glowColor: KAIJU_GLOW,
      ...(['clone2', 'clone3', 'clone4'].includes(element.id) ? { hidePhase: 'clonesDropped' } : {}) // gone when they drop
    })),
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
  // the card below the door, clear of it (playtest 18); the way out under the card itself, not at the door (playtest 19)
  rooftop: { exit: { x: 958, y: 440 }, exitLabelDrop: 28 }, // the stairwell door at the back, on the right; its sign below the door (Jamie)
  aquarium: { exit: { x: 270, y: 715 }, start: { x: 470, y: 605 } } // out at the bottom left; the team starts up by the tank
};

Object.keys(BATTLEGROUND_SITES).forEach(levelId => {
  const level = LEVELS[levelId];
  const entranceExit = VISIT_ENTRANCE_EXITS[levelId];
  const entrance = entranceExit && getTileCenter(level.grid, level.spawnTiles[0]);
  const visitSpots = VISIT_SPOTS[levelId] || {};
  const doorSpot = visitSpots.exit || entrance || level.rival.recruitSpot;
  const getClosest = target => level.walkableTiles.reduce((closest, tile) => getSpotDistance(level, tile, target) < getSpotDistance(level, closest, target) ? tile : closest);
  const trainingSpot = getTileCenter(level.grid, getClosest({ x: level.world.width / 2, y: level.world.height / 2 })); // the middle of the battlefield
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
    // the recruit's offer: once it is made, the way into the training fight, in the middle of the battlefield
    training: { recruit: level.rival.avatar, spot: trainingSpot, levelId: getTrainingLevelId(levelId), sparringLevelId: getSparringLevelId(levelId) },
    phases: [...level.phases, { id: TRAINING_PHASE, label: 'Training spot' }],
    sceneElements: [
      ...level.sceneElements,
      { id: 'exit', type: 'door' as const, phase: EXIT_OPEN_PHASE, x: doorSpot.x, y: doorSpot.y + (visitSpots.exitLabelDrop || 0), width: 0, height: 0, sortY: ABOVE_CHARACTERS, label: 'Back to map' },
      { id: 'training', type: 'door' as const, phase: TRAINING_PHASE, x: trainingSpot.x, y: trainingSpot.y, width: 0, height: 0, sortY: ABOVE_CHARACTERS, label: 'Do Training' }
    ]
  };
  // the training fight: the battleground as it is to fight on, without its Kaiju part, trains or boss phases, and the
  // recruit as the one to beat, one on one
  LEVELS[getTrainingLevelId(levelId)] = {
    ...level,
    id: getTrainingLevelId(levelId),
    name: `${level.name} (training)`,
    isTraining: true,
    hasTrainSchedule: level.hasTrainSchedule, // the Subway's trains, as often as in the Punk Guy fight (Jamie, playtest 19)
    defaultPhases: [],
    wideShots: {},
    liveWideShots: {},
    ghostBoss: undefined,
    aquariumFlood: undefined,
    rival: { ...level.rival, isTraining: true, cooldownScales: undefined },
    visitLevelId: getVisitLevelId(levelId) // back here after (Jamie): the walking battleground, not the map
  };
  // the same, against the teammate (their look and powers are filled in when it starts: GameManager.addRival)
  LEVELS[getSparringLevelId(levelId)] = {
    ...LEVELS[getTrainingLevelId(levelId)],
    id: getSparringLevelId(levelId),
    name: `${level.name} (sparring)`,
    rival: { ...level.rival, isTraining: true, isSparring: true, maxLives: 4 }
  };
});

export const PENINSULA = LEVELS.peninsula;

/*
  The final battle: the Peninsula, GIANT_KAIJU.mapScale times the size. People and tiles are the size they always are,
  so there is far more ground, and the camera follows the player across it. The tiles are the Peninsula's, scaled up:
  a tile is walkable where the Peninsula's tile under it is (touch them up in the level editor).
*/
const buildFinalBattle = (): LevelConfig => {
  const scale = GIANT_KAIJU.mapScale;
  const { grid, world, walkableTiles, kaijuEntry } = PENINSULA;
  const bigGrid = { ...grid, columns: Math.ceil(grid.columns * scale) + 2, rows: Math.ceil(grid.rows * scale) + 2 };
  const walkable = new Set(walkableTiles.map(({ i, j }) => `${i} ${j}`));
  const tiles = [];
  for (let i = 0; i < bigGrid.columns; i += 1) {
    for (let j = 0; j < bigGrid.rows; j += 1) {
      const center = getTileCenter(bigGrid, { i, j });
      if (center.x < 0 || center.y < 0 || center.x > world.width * scale || center.y > world.height * scale) continue;
      const small = getTileIndexAtLocation(grid, { x: center.x / scale, y: center.y / scale });
      if (!small) continue;
      const key = `${small.i} ${small.j}`;
      if (walkable.has(key)) tiles.push({ i, j });
    }
  }
  // where Kaiju walk on from: the Peninsula's own, moved out to the big map
  const entryTiles = kaijuEntry.perimeterTiles.map(tile => {
    const { x, y } = getTileCenter(grid, tile);
    return getTileIndexAtLocation(bigGrid, { x: x * scale, y: y * scale });
  }).filter(Boolean);
  const getClosest = spot => tiles.reduce((closest, tile) => {
    const a = getTileCenter(bigGrid, tile);
    const b = getTileCenter(bigGrid, closest);
    return Math.hypot(a.x - spot.x, a.y - spot.y) < Math.hypot(b.x - spot.x, b.y - spot.y) ? tile : closest;
  });
  // up the middle of the Peninsula, from its foot (the Lab) to the city at its tip, in the Peninsula's own pixels
  const route = [[230, 712], [205, 600], [170, 470], [160, 380], [185, 260], [200, 170]].map(([x, y]) => ({ x: x * scale, y: y * scale }));
  return {
    ...PENINSULA,
    id: 'finalBattle',
    name: 'Final battle',
    world: { width: world.width * scale, height: world.height * scale },
    grid: bigGrid,
    walkableTiles: tiles,
    tileSets: { base: tiles },
    spawnTiles: [getClosest({ x: 205 * scale, y: 560 * scale }), getClosest({ x: 225 * scale, y: 565 * scale })],
    kaijuEntry: {
      perimeterTiles: entryTiles,
      bounds: { minX: kaijuEntry.bounds.minX * scale, minY: kaijuEntry.bounds.minY * scale, maxX: kaijuEntry.bounds.maxX * scale, maxY: kaijuEntry.bounds.maxY * scale }
    },
    phases: [{ id: GIANT_STOMP_PHASE, label: 'Stomp shake' }],
    shakePhases: [GIANT_STOMP_PHASE],
    giantKaiju: { route }
  };
};
export const GIANT_STOMP_PHASE = 'giantStomp';

// the last fight (Jamie, 2026-11-06): the Peninsula's usual fight. once its Kaiju are beaten, the teammate turns, in the log,
// into a Kaiju with every power, and that is the last of it.
LEVELS.finalPeninsula = {
  ...PENINSULA,
  id: 'finalPeninsula',
  name: 'Final battle (Peninsula)',
  // 'aloneScene': with no teammate left to turn, the player's own words before they turn (startPlayerTurn)
  finalTurn: { scene: 'peninsula.finalTurn', aloneScene: 'peninsula.finalTurnAlone', kaijuLives: 10, coolDownMs: 6000, castEveryMs: 1200 } // each power waits coolDownMs; one of them every castEveryMs
};

// the same last fight from the teammate's turn on (Jamie): what Retry plays after a loss to their Kaiju, and a dev jump.
// no Kaiju come in, and no words: the teammate is a Kaiju from the start.
LEVELS.finalTurnFight = {
  ...LEVELS.finalPeninsula,
  id: 'finalTurnFight',
  name: 'Final battle (the teammate)',
  kaijuEntry: undefined,
  finalTurn: { ...LEVELS.finalPeninsula.finalTurn, isStartTurned: true }
};
LEVELS.finalBattle = buildFinalBattle();

// the level editor saved a level: the game uses it from now on
export const applyLevelFile = file => {
  LEVEL_FILES[file.id] = file;
  LEVELS[file.id] = LEVEL_BUILDERS[file.id](file);
};
