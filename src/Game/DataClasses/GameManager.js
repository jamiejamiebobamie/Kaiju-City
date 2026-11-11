import { fillPronouns, getDialogueLine, getDialogueTexts, getKeyedLines, getRecruitChoiceLines, getSpokenLines } from './Dialogue/dialogue';
import { GameMode, GAME_TICK, PIECES_INFO, TILE_DIR_NORM_VECS, TILE_DIRS, ZoomLvl } from 'Utils/gameState';
import { TimeoutHandler } from './TimeoutHandler';
import { GameManagerProxy } from './GameManagerProxy';
import { PlayerInputHandler } from './PlayerInputHandler';
import { SettingsManager } from './SettingsManager';
import { GameBoardPiecesManager } from './GameBoard/Pieces/GameBoardPiecesManager';
import { KaijuManager } from './KaijuManager';
import { GameBoardManager } from './GameBoard/GameBoardManager';
import { CHARACTER_FEET, CHARACTER_HEIGHT_PX, EXIT_OPEN_PHASE, getSortZIndex, GIANT_STOMP_PHASE, LEVELS, PENINSULA, RIVAL_IN_PHASE, SPARRING, TRAINING_PHASE } from 'Game/DataClasses/Levels/levels';
import { TrainSchedule, TRAIN_HIT } from './TrainSchedule';
import { GameBoardPieceAgent } from './GameBoard/Pieces/GameBoardPieceAgent';
import { GameBoardPieceExtra } from './GameBoard/Pieces/GameBoardPieceExtra';
import { WIDE_SHOT } from './Camera';
import { addUnlock, getRecruitChoices, getUnlocks } from './Unlocks';
import { getIsDetourLevel, getIsSameObjective, KAIJU_OBJECTIVE, MAP_OBJECTIVES, OBJECTIVES } from './Objectives';
import { getIsSkillOpen, getSkillUnlock, ROSTER, SKILL_UNLOCKS } from './Avatars';
import { getSpeechMs } from './speechTiming';
import { getTileCenter, getTileIndexAtLocation } from './GameBoard/hexGrid';
import { GHOST_BOSS, GhostRing } from './GhostBoss';
import { AQUARIUM_FLOOD, AquariumFlood } from './AquariumFlood';
import { GIANT_KAIJU, GiantKaiju } from './GiantKaiju';
import { GameBoardPieceGiant } from './GameBoard/Pieces/GameBoardPieceGiant';
import { GameBoardPieceKaiju } from './GameBoard/Pieces/GameBoardPieceKaiju';
import { NO_CAST } from './GameBoard/Tile/TileContender';
import { getAvatarColor } from './Avatars';
import { getTorsoSpot, startRagdoll, stepRagdoll } from './Ragdoll';
import { DIALOGUE, getIsClickThrough, getIsDialogueLog } from './DialogueLog';
import { getIsSpacing } from './SpacingTest';

export const GameResult = Object.freeze({
    PlayerWon: 0,
    PlayerLost: -1
});

// timing of the moments the game holds still for
const TRIGGER_ROWS = 2; // how close a door or a walk-here spot has to be
const SITE_ROWS = 1.5; // how close a site on the map has to be: the player over its icon (Jamie, playtest 19; was 3)

// the player walking through a portal (startPortalWalk), in milliseconds
// two coming in at one door (Sewer 2's walk-in)
export const WALK_IN = {
  followDelayTicks: 5 // the second sets off this many ticks behind the first
};

// the last fight's other ending: the player turns (startPlayerTurn)
export const FINAL_TURN = {
  playerKaijuHoldMs: 2600 // on their Kaiju a while, before the end
};

// back in the battleground from a training fight won: the card shows this long before anyone speaks (Jamie)
export const TRAINING_RETURN = { cardMs: 2600 };

// the Hazmat Worker, once unlocked, walks and fights with the team like a recruit (Jamie): his powers, an orange outline.
// Aegis (shield), Heal and Dispel (bubble): no attack power (Jamie, playtest 18)
// the Lab trap's sweep along the clones (getClonesSweepSteps): its zoom, pan speeds (scene px a ms) slow within a group
// and quick across the gap between the groups (a step longer than 'gapPx'), the move in, and the holds at either end
const CLONES_SWEEP = { zoomScale: 2.2, pxPerMs: 0.18, gapPxPerMs: 1.4, gapPx: 400, zoomInMs: 800, holdMs: 500 };

// taking over an ally (updateTakeOver): the camera's move in on them, and how long the fight holds there
const TAKE_OVER = { panMs: 600, holdMs: 1800 };

// the Aquarium: within this many rows of the stairs, the player is going up for the Mermaid (getIsAtAquariumStairs)
const AQUARIUM_STAIRS_NEAR_ROWS = 2.5;

export const HAZMAT_RECRUIT = { abilities: ['metal', 'love', 'bubble'], color: '#ff8a1f' }; // orange glow (Jamie, playtest 19; was white)

export const PORTAL_WALK = {
  // all half what they were (Jamie, 2026-11-06)
  zoomInMs: 275, // the camera in close on the way in, or the way out
  walkMs: 550, // walking in, or out
  zoomOutMs: 225, // back to the usual zoom where they went in
  panMs: 650, // across to the other end
  // the body, from where the piece stands, in the piece's own size (a person's sprite box)
  body: [{ x: -16, y: -46 }, { x: 22, y: -46 }, { x: -16, y: 4 }, { x: 22, y: 4 }]
};

// a facing, as a way on the screen
const PORTAL_DIR_VECS = {
  up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, upRight: { x: 0.868, y: -0.496 }, downRight: { x: 0.868, y: 0.496 },
  downLeft: { x: -0.868, y: 0.496 }, upLeft: { x: -0.868, y: -0.496 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 }
};

// the walk's name for a way on the screen (its sprite sheet's rows)
const getDirName = ({ x, y }) => {
  const names = ['upRight', 'downRight', 'down', 'downLeft', 'upLeft', 'up'];
  const angles = [-30, 30, 90, 150, 210, 270];
  const angle = ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
  const closest = angles.reduce((best, each, k) => Math.abs(((angle - each + 540) % 360) - 180) < Math.abs(((angle - angles[best] + 540) % 360) - 180) ? k : best, 0);
  return names[closest];
};

// what else the enemy zoom looks toward (getCameraThreats)
export const CAMERA_THREATS = {
  statuses: ['isGhosted', 'isWooded', 'isCold', 'isCharming', 'isSeaGhost'], // powers that chase their target. not Heal.
  kaijuNearRows: 16, // a Kaiju still walking in counts once it is this close to the player, in tile rows
  ghostDangerRows: 4, // an NPC's defensive powers answer a launched ghost this close (getIsBossThreatNear)
  deathHoldMs: 3500 // whoever the camera follows dies: it stays on them this long (wall time) before it moves on
};

// the final battle's end (onGiantDrained), in milliseconds
export const FINALE = {
  pullMs: 1200,
  rayMs: 3200, // the ray gun on the giant, as it shrinks
  teammateMs: 2600, // on the teammate, back to themselves
  rayZoomShare: 0.6, // the ray's shot, wide enough for the player and the giant
  rayColor: '#b45cff'
};
const GIANT_SHAKE_MS = 450; // a stomp shakes the scene this long

// the Aquarium's scream (startShatter), in milliseconds
export const SHATTER_SCREAM = {
  screamMs: 700, // after her word, the scream
  panMs: 700, // the camera's move to each panel, and back to her
  panelMs: 400, // on each panel as it breaks (quicker again: no waiting for the fish to settle. Jamie)
  panelPanMs: 250, // the camera's move from panel to panel
  restZoomShare: 1.15, // after the team's teleport: back from the extreme zoom, but not all the way out (a share of the usual zoom)
  onHerMs: 600, // on her a moment, before the glass
  creatureEvery: 2, // every second panel lets a sea creature out as it breaks
  portalMs: 700 // the portal opening, her going through, and it closing
};

// the ghost boss's scream (startGhostScream), in milliseconds
export const GHOST_SCREAM = {
  screamMs: 900, // after her words, the scream
  toTeamMs: 900, // the pull to the team
  onTeamMs: 700, // held on them before the flash
  flashInMs: 350, // the flash comes up; they are moved at its peak
  togetherMs: 1300, // side by side on the new roof, still in two halves if they were apart
  mergedMs: 600, // one shot
  toRingMs: 1500, // the pull out to the ring
  ringZoomShare: 0.8, // the ring's shot, as a share of the usual zoom
  besideCols: 1, // the two of them land this many columns either side of the ring's middle
  ringShotZoom: 1.1, // the whole ring, while no ghost is coming for the player: a share of the whole scene's zoom
  ringShotPanMs: 700, // the camera's move out to it, and back
  ringShotRelaxedPanMs: 4000, // after the first time out and back in on a ghost: the slow, relaxed move out
  // after the scream's pull out to the whole ring, the camera stays on the player at a medium zoom, this share of the
  // usual one, instead of on the whole ring (Jamie, playtest 18: with a big team the ghosts rarely come for the player)
  ringMediumZoomShare: 0.7
};

export const CUTSCENE = {
  wideMs: 1800,
  pullInMs: 1500,
  touchMs: 4200, // long enough for the part's whole transformation and flash
  arrivalPanMs: 3200,
  // Peninsula's opening, in scene pixels: the base of the Peninsula is off-shot from the player
  arrivalPlayerSpot: { x: 200, y: 300 },
  arrivalTeammateSpot: { x: 245, y: 325 },
  arrivalTeammateStart: { x: 195, y: 590 },
  slowMotionSpeed: 0.45, // slow, but not so slow that a short sprite sheet (the Kaiju's explosion) looks frozen
  slowMotionDelayMs: 350, // full speed for a moment, so the last explosion or throw gets going
  slowMotionRampMs: 500, // then it eases down to slow motion
  outcomeZoomScale: 2.2, // the end-of-fight shot moves in close on the body, or the exploding Kaiju
  outcomePullMs: 900,
  outcomeFollow: 0.15, // each tick, the end-of-fight shot moves this share of the way to the body
  chaseSlowSpeed: 0.35,
  chaseSlowMs: 2800,
  mapWideMs: 2400,
  revealGlowMs: 1200, // a door lights up before anyone says a word about it
  clonesLookMs: 2200,
  exitLookMs: 1600, // the camera holds on a way out that has just opened
  exitLookFarRows: 6, // further than this from the Agent, it shows the whole scene instead
  choiceShotLiftRows: 1.5,
  besideColumns: 2.5, // standing beside the bystander, this far either side
  besideBodyRows: 0.6, // and the bystander lies this far down from their spot, on the first row of tiles
  besideBodyDropRows: 0.5, // drawn this much lower, so the body lies on the tiles rather than over the graves behind // the Recruit or Terminate shot sits this much higher, so the team stands lower in it // the Lab trap: the camera holds on the clones, stepped out of their tanks
  recruitZoomScale: 1.3,
  recruitSpeechRows: 2.4, // how far above a character their words sit: just over their head
  speechTopY: 200, // words sit no higher than this, or they would go off the top of a wide shot or under the top buttons
  speechLineChars: 15, // about this many letters fit on a balloon's line
  speechShortLines: 3, // a balloon of up to this many lines fits under 'speechTopY'
  speechLinePx: 40, // each line past that sits it this much lower, in scene pixels
  shotHeadRows: 1.5,
  recruitStandRows: 2, // how far north of the beaten bystander they stand
  // the recruits at the choice, round the body (columns, rows from it), clear of the player, the teammate and the body
  recruitSpots: [[3, -2], [-6, -1], [6, -1], [-3, 1.5], [3, 1.5]],
  recruitSpotsBeside: [[-6, 0], [6, 0], [0, -2], [-3, 1.5], [3, 1.5]],
  recruitShotRows: 3, // how far north of the bystander the camera looks
  recruitButtonRows: 3.6 // how far above the player the buttons sit
};

// a playtest: damaging tile statuses take the color of the side that cast them.
// the player's side (recruits too) uses the player's own color: blue for Guy, yellow for Girl.
export const TEAM_COLORS = {
    enemies: '#9b30ff'
};

// the Lab fight's Agents: three of these each, at random

const ARRIVAL_LINE = getDialogueTexts('peninsula.arrival')[0];

// before each Recruit or Terminate: what each choice means, a page at a time.
// the first time is as written. after that the teammate remembers the last choice, and then any pattern.
const POSSESSIVES = { him: 'his', her: 'her' };
const RECRUIT_ORDER = ['punk', 'black_female', 'mermaid']; // as they are met in the campaign
export const getRecruitLines = (pronoun, pastChoices = []) => {
    // the words are in Dialogue/dialogue.json ('recruit.choice'), one set for each way the earlier choices went
    const last = pastChoices[pastChoices.length - 1];
    // 'allSame': recruited everyone; 'allTerminate': terminated everyone (no crew to grow)
    const isAllSame = pastChoices.length >= 2 && pastChoices.every(choice => choice == last);
    const past = isAllSame ? (last == 'terminate' ? 'allTerminate' : 'allSame') : pastChoices.length >= 2 ? 'mixed' : (last || 'none');
    return getRecruitChoiceLines(past, { him: pronoun, his: POSSESSIVES[pronoun] || 'their', last: last || '' });
};

// how much of a sprite frame's height the body fills (the hazmat sheet: about 137 of 200 pixels)
const WALKER_BODY_FRACTION = 0.69;
// what the piece component adds to every piece's z-index, so pieces sort with the scene's own layers
const PIECE_Z_BASE = 20001;

// A*'s extra cost of a tile, in steps: someone standing on it, or someone headed for it
const CROWD_COST = { standing: 3, headedFor: 1.5 };

// a train hit that doesn't kill: down this long as a ragdoll, then up again
const TRAIN_KNOCKDOWN = { downMs: 3000, drift: 0.06 }; // drift: how much of the way to the get-up tile the body moves each tick

// a line's camera, as the dialogue viewer sets it: 'wide' keeps the whole scene in shot, even when the line goes to the log;
// anything else is the scene's own shot for it (usually on the speaker)
const WHOLE_SCENE_SHOT = { isWide: true, isKeptWide: true };
const getLineShot = (line, shot) => line && line.shot == 'wide' ? WHOLE_SCENE_SHOT : shot;

export class GameManager {
    // 'returnSpot': back on a map walk from a site, the team starts beside it.
    // 'isRetry': the match is played again after a loss, so its opening scene is skipped.
    // 'autoRecruits': the recruits called in at the start of every fight, and walking with the team in the scenes the
    // teammate is in (Jamie: a dev toggle, on by default). Empty: they are called with the buttons, as before.
    // 'recruits': who the player has recruited this playthrough (Game.tsx keeps it in React state). Left out: the saved choices.
    // 'carriedObjective': the objective from before a detour (the walking Lab, off a map walk), which carries over
    // 'terminated': the bystanders the player chose to terminate (Game.tsx's state). 'trainingPoints': the temporary health
    // won sparring, the player's and the teammate's each ({ player, teammate }).
    // 'healthReward': health was just won sparring: the player and teammate glow red a while, back in the battleground
    // 'trainingOutcome': just back from a training fight won ({ isSparring, avatar }): what's said is about it.
    // 'sparredHere': sparring has been done in this battleground before: the teammate asks to go again
    constructor({ level = PENINSULA, settingsManager, hasArrival = false, killsToWin = undefined, returnSpot = undefined, isRetry = false, autoRecruits = [], recruits = undefined, carriedObjective = null, terminated = [], trainingPoints = { player: 0, teammate: 0 }, healthReward = false, trainingOutcome = undefined, sparredHere = false, isRevisit = false, isTakeOverOnDeath = false }) {
        this.healthReward = healthReward;
        this.terminated = terminated;
        this.trainingPoints = trainingPoints;
        this.trainingOutcome = trainingOutcome;
        this.sparredHere = sparredHere;
        this.isTakeOverOnDeath = isTakeOverOnDeath; // dev option (Jamie, playtest 18): the player down, they play on as the next of the team
        this.controlledPiece = undefined; // who the player plays as, once taken over (else the player's own piece)
        this.isRevisit = isRevisit; // a scene been to before (the walking Lab): its opening words aren't said again (Jamie, playtest 18)
        this.carriedObjective = carriedObjective;
        this.objective = null; // what the player is to do now (Objectives.ts)
        this.objectiveCount = 0; // goes up with each new one: the screen shows each new one as a title
        // back from training: the objective carried back isn't new, so no title for it over the reward's card (Jamie, playtest 18)
        if (trainingOutcome && carriedObjective) this.objective = carriedObjective;
        this.autoRecruits = autoRecruits;
        this.recruits = recruits;
        this.hasAutoSummoned = false;
        this.killsToWin = killsToWin;
        this.returnSpot = returnSpot;
        this.isRetry = isRetry;
        this.armedSites = new Set(); // a site counts once the player has been away from it: spawning beside one doesn't enter it
        this.zoomLvl = ZoomLvl.NoZoom;
        this.accTime = 0;
        this.score = 0;
        this.isPaused = false;
        this.tutorialIndex = 0;
        this.boardRevision = 0;
        this.hasArrival = hasArrival;
        this.cutscene = undefined; // the game holds still while one plays
        this.speech = null; // { name, text, x, y }
        this.recruitScene = null;
        this.isSlowMotion = false;
        this.resultMs = 0; // how long the fight has been over
        this.timeScale = 1; // the game's speed: below 1 in slow motion
        this.outcomeShot = undefined;
        // the ghost boss (GhostBoss.ts): the Rooftop fight in phases
        this.ghostBossDowns = 0; // how many times she has been brought to zero
        this.ghostRing = undefined;
        this.ghostRingTeammate = undefined;
        this.phaseGhostTiles = []; // where the ring's ghosts are on the board: { tileIndex, isShaking, fade }
        this.isGhostScreaming = false; // from the blow that brings her to zero until the new ring has formed
        this.isGhostScreamPending = false;
        this.ghostFlashCount = 0; // each scream's red flash
        // the Aquarium (AquariumFlood.ts): one shatter, then the flood
        this.isShattered = false;
        this.isShatterPending = false;
        this.aquariumFlood = undefined;
        this.nextMermaidHealAt = 0;
        // the final battle (GiantKaiju.ts)
        this.giant = undefined; // the giant's march and attacks
        this.giantPiece = undefined; // where the board sees it: on its weak spot
        this.giantColor = undefined; // the teammate's color
        this.giantWarnings = []; // stomps and tail sweeps on their way: { type, spot, radiusPx, endsAtMs }, in the giant's time
        this.giantHitAtMs = -Infinity; // the weak spot flashes when hit
        this.stompShakeUntil = 0;
        this.isGiantDraining = false; // the ray gun is on it
        this.giantShrinkAtMs = undefined; // when it began to shrink back into the teammate
        this.isFinaleWon = false;
        this.transformState = undefined; // the Lab fight: 'transforming', then 'done'
        this.finalTurnState = undefined; // the last fight: 'turning', then 'fighting' (the teammate is a Kaiju)
        this.teammateKaiju = undefined;
        this.portalWalk = undefined; // the player going through a portal: see startPortalWalk
        this.portalShot = undefined; // the camera between the two ends, while the fight goes on
        this.enemyPowersAtMs = 0; // before this, the other side can't use powers
        // the dialogue log (DialogueLog.ts): every line said so far, and talk that runs outside of cutscenes
        this.dialogueLog = []; // { key, who, name, text, avatar, chain }
        this.logChain = 0; // a fight in between starts a new chain: the first speaker after it shows their portrait again
        this.isCutsceneLineWaiting = false; // a cutscene's line waits for a key or a click
        this.talks = []; // { lines, index, msLeft, isWaiting, isActive, isPhased }
        this.walkers = []; // people at work in a walking scene (addWalker) // once the fight is decided, the camera stays on the death that decided it
        this.isChaseSlowed = false;
        this.chaseSlowEndsAt = 0;
        this.followers = []; // recruits walking with the team
        this.extras = []; // people standing in the scene
        this.isSceneOver = false; // a scripted scene has played out, and the level ends
        this.agentsDropped = 0;
        this.wideShotMs = 0; // what is left of the current wide shot. the game holds still during it.
        this.liveWideShotMs = 0; // what is left of a wide shot the game keeps running through
        this.holdMs = 0; // the game waits this long, as the log comes apart before a fight
        this.unlockMessage = '';
        this.unlockImage = '';
        this.isEditingTiles = false; // dev: the game holds still and shows the whole level
        this.level = level;
        this.activePhases = new Set(level.defaultPhases);
        this.trainSchedule = level.hasTrainSchedule ? new TrainSchedule({ onStageChange: this.handleTrainStage }) : undefined;
        this.boardListeners = new Set();
        this.settingsManager = !!settingsManager ? settingsManager : new SettingsManager();
        this.timeoutHandler = new TimeoutHandler();
        this.gameManagerProxy = new GameManagerProxy();
        this.playerInputHandler = new PlayerInputHandler({ gameManagerProxy: this.gameManagerProxy });
        this.gameBoardPiecesManager = new GameBoardPiecesManager({ gameManagerProxy: this.gameManagerProxy });
        this.gameBoardManager = new GameBoardManager({ gameManagerProxy: this.gameManagerProxy, level });
        this.kaijuManager = new KaijuManager({ gameManagerProxy: this.gameManagerProxy });
    }

    getIsPaused = () => {
        return this.isPaused;
    }

    getAccTime = () => {
        return this.accTime;
    }

    getPlayerInputHandler() {
        return this.playerInputHandler;
    }

    getTiles() {
        return this.gameBoardManager.getTilesInFlatArray();
    }

    getWalkableRevision() {
        return this.gameBoardManager.getWalkableRevision();
    }

    getIsWalkable = (tileIndex) => {
        return this.gameBoardManager.getIsInBounds(tileIndex);
    }

    getClosestReachableTile(location) {
        return this.gameBoardManager.getClosestReachableTile(this.gameBoardPiecesManager.getPlayerPiece().getTileIndex(), location);
    }

    getHoveredTileIndex() {
        return this.gameBoardManager.getHoveredTileIndex();
    }

    getActivePhases() {
        return [...this.activePhases];
    }

    // no one uses powers while walking a scene, in a cutscene, or once the Agents have taken them
    // with spacing on for this kind of scene, a tile with someone else standing on it
    getIsTileTakenForSpacing = (pieceIndex, { i, j }) => {
        if (!getIsSpacing(this.level.isWalkingLevel ? 'walking' : 'battle')) return false;
        return this.getPieces().some(piece => piece.pieceIndex != pieceIndex && !piece.isDead && piece.isOnTiles && piece.tileIndex.i == i && piece.tileIndex.j == j);
    }

    // A*'s weights for an NPC's path: a tile someone stands on costs more, and one someone is headed for a little more,
    // so they take a free tile beside others rather than walking through or onto them. off with spacing off.
    getCrowdCosts = (pieceIndex) => {
        const costs = new Map();
        if (!getIsSpacing(this.level.isWalkingLevel ? 'walking' : 'battle')) return costs;
        const add = ({ i, j }, cost) => {
            const key = `${i} ${j}`;
            costs.set(key, Math.max(costs.get(key) || 0, cost));
        };
        this.getPieces().forEach(piece => {
            if (piece.pieceIndex == pieceIndex || piece.isDead || !piece.isOnTiles || !piece.tileIndex) return;
            add(piece.tileIndex, CROWD_COST.standing);
            const headedFor = piece.moveToTiles && piece.moveToTiles[piece.moveToTiles.length - 1];
            if (headedFor) add(headedFor, CROWD_COST.headedFor);
        });
        return costs;
    }

    getIsPowersOff = (piece = undefined) => {
        if (this.isRecruitsFighting && !this.cutscene && piece && piece.isRecruit) return false; // the Lab trap: the recruits hold the Agents off
        if (piece && piece.teamIndex != this.gameBoardPiecesManager.getPlayerTeamIndex() && this.accTime < this.enemyPowersAtMs) return true; // the Agents' head start
        if (this.getIsCatwalkAgentWaiting(piece)) return true;
        return !!this.level.isWalkingLevel || !!this.cutscene || !!this.recruitScene || this.getGameResult() !== null;
    }

    // the camera starts its move back in before the game resumes
    getIsWideShot = () => {
        // an Agent coming in doesn't pull the camera out (everything gets too small): its caret's badge shows it instead
        return !!this.cutscene || !!this.recruitScene || this.isEditingTiles || this.wideShotMs > WIDE_SHOT.pullMs || this.liveWideShotMs > 0 || this.getIsApartByTrain();
    }

    holdFor(ms) {
        this.holdMs = Math.max(this.holdMs, ms);
    }

    setIsEditingTiles(isEditingTiles) {
        this.isEditingTiles = isEditingTiles;
    }

    setPhase(id, isActive) {
        const holdMs = this.level.wideShots && this.level.wideShots[id];
        if (isActive && holdMs && !this.activePhases.has(id)) {
            this.wideShotMs = Math.max(this.wideShotMs, WIDE_SHOT.pullMs * 2 + holdMs);
        }
        const liveHoldMs = this.level.liveWideShots && this.level.liveWideShots[id];
        if (isActive && liveHoldMs && !this.activePhases.has(id)) this.liveWideShotMs = WIDE_SHOT.pullMs + liveHoldMs;
        if (isActive) this.activePhases.add(id);
        else this.activePhases.delete(id);
    }

    togglePhase = (id) => {
        const isActive = !this.activePhases.has(id);
        if (id == 'train' && !!this.trainSchedule) this.trainSchedule.setIsTrainIn(isActive, this.accTime);
        else this.setPhase(id, isActive);
    }

    // the tiles change as soon as the lights do, so everyone has time to get off the tracks
    closeTracks() {
        const board = this.gameBoardManager;
        if (board.walkableTiles == this.level.tileSets.train) return;
        board.setWalkableTiles(this.level.tileSets.train);
        this.gameBoardPiecesManager.updatePiecesForWalkableTiles(() => { });
    }

    handleTrainStage = (stage, accTime) => {
        const { walkableTiles } = this.level;
        this.setPhase('trainLights', stage != 'idle');
        this.setPhase('trainWarning', stage == 'warning'); // only before the train: the title says it is coming
        if (stage == 'warning') this.closeTracks();
        const isTrainIn = stage == 'train';
        if (isTrainIn == this.activePhases.has('train')) return;

        this.setPhase('train', isTrainIn);
        if (isTrainIn) {
            this.closeTracks();
            this.gameBoardPiecesManager.updatePiecesForWalkableTiles(piece => {
                const hitAt = { ...piece.charLocation };
                piece.hitByTrain(accTime, TRAIN_HIT, this.gameBoardManager.getClosestWalkableTile(piece.getTileIndex()));
                if (!piece.isDead && piece.avatar != 'kaiju') this.knockDown(piece, hitAt);
            });
        } else {
            this.gameBoardManager.setWalkableTiles(walkableTiles);
        }
    }

    // a status takes the color of the side that cast it, as it was when cast: a charmed piece's powers show the charmer's color.
    // undefined for a status no one is known to have cast: it keeps its power's color
    getStatusTeamColor = (casterIndex, teamIndex) => {
        if (!this.getPieces()[casterIndex]) return undefined;
        if (teamIndex == this.gameBoardPiecesManager.getPlayerTeamIndex()) return this.getPlayerColor();
        // the enemies' side takes its leader's color: the bystander they fight (Ghost Girl's red); else the Kaiju's (Jamie)
        return this.getEnemyLeaderColor();
    }

    getEnemyLeaderColor() {
        return this.rivalPiece && this.rivalPiece.color ? this.rivalPiece.color : TEAM_COLORS.enemies;
    }

    getWormholes() {
        return this.gameBoardManager.getWormholes();
    }

    getActiveTiles() {
        return this.gameBoardManager.getActiveTiles();
    }

    getPieceColorsLookup() {
        return this.gameBoardPiecesManager.getPieceColorsLookup();
    }

    getPieces() {
        return this.gameBoardPiecesManager.getPieces();
    }

    getDeathPieces() {
        return this.gameBoardPiecesManager.getDeathPieces();
    }

    // for React's 'useSyncExternalStore': the board redraws when the revision changes
    subscribeToBoard = (listener) => {
        this.boardListeners.add(listener);
        return () => this.boardListeners.delete(listener);
    }

    getBoardRevision = () => {
        return this.boardRevision;
    }

    notifyBoard() {
        this.boardRevision += 1;
        this.boardListeners.forEach(listener => listener());
    }

    initGame() {

        this.resetGame();

        // SIDE EFFECT: overwrites ability data with user-definded ability edits (if any)
        this.settingsManager.initAbilityStatusData()

        // - what is player's avatar?
        const playerAvatar = this.settingsManager.getPlayerAvatar();

        // - what are player's chosen abilities?
        const playerAbilities = this.settingsManager.getPlayerChosenAbilities();

        // player abilities to input handler to be triggered by keyboard keys
        playerAbilities.forEach(a => this.playerInputHandler.addPlayerAbilities(a));

        // add player
        this.gameBoardPiecesManager.addPlayer({ playerAvatar, playerAbilities });

        const gameMode = this.settingsManager.getGameMode()

        const mandatoryTeammateGamemodes = [
            GameMode.Tutorial,
            GameMode.StoryPlusTutorial,
            GameMode.Story
        ]
        // - does player want a teammate?
        // in the final battle, the teammate is the giant Kaiju
        if (mandatoryTeammateGamemodes.includes(gameMode) && this.settingsManager.getIsTeammate() && !this.level.giantKaiju) {
            const teammateAvatar = this.settingsManager.getTeammateAvatar();
            const teammateAbilities = this.settingsManager.getThreeRandomAbilities();

            // add teammate abilities to input handler to be triggered by keyboard keys
            teammateAbilities.forEach(a => this.playerInputHandler.addPlayerAbilities(a));

            // add teammate
            this.gameBoardPiecesManager.addTeammate({ teammateAvatar, teammateAbilities });
        }

        // training points won sparring (Jamie): the player's and the teammate's each, on top of their health, everywhere.
        // they go first when hit, for good (decrementHealth); a fight starts back at the base health, plus what's left
        this.getTrainingPieces().forEach(([piece, who]) => {
            piece.trainingBase = piece.maxLives;
            piece.maxLives = piece.trainingBase + Math.min(this.trainingPoints[who] || 0, SPARRING.maxPoints);
            piece.lives = piece.maxLives;
            if (this.healthReward) piece.rewardPulseUntil = SPARRING.rewardPulseMs; // their clocks start from 0 here
        });

        // must be set before calling updateBounds
        this.gameBoardManager.setUpdateProxyProps(this.updateProxyProps);

        this.gameBoardManager.updateBounds();

        this.gameBoardManager.initTiles();

        this.gameBoardPiecesManager.initPlayerLocationsOnBoard(this.returnSpot ? this.getReturnTiles(this.returnSpot) : this.getTrainingReturnTiles() || this.level.spawnTiles);

        // a fight: the teammate starts beside the player, on a tile no one else is on, as the recruits do (Jamie). after the spawn, which used to undo it (playtest 19)
        if (!this.level.isWalkingLevel) {
            const [player, teammate] = this.gameBoardPiecesManager.getTeamPieces(this.gameBoardPiecesManager.getPlayerTeamIndex());
            if (player && teammate && !teammate.isRecruit) {
                const beside = this.gameBoardManager.getAdjacentTileIndices(player.getTileIndex()).filter(this.gameBoardManager.getIsInBounds);
                const taken = new Set(this.getPieces().filter(piece => piece !== teammate && piece.isOnTiles).map(piece => `${piece.getTileIndex().i} ${piece.getTileIndex().j}`));
                const free = beside.find(tile => !taken.has(`${tile.i} ${tile.j}`));
                if (free) teammate.initCharLocation(true, free);
            }
        }
        if (this.level.isMapWalk && this.level.sites) this.moveTeamClearOfSites();

        // the recruits walk with the team wherever the teammate is: the walking Lab, the Street, the map walks too (Jamie)
        const isTeammateScene = this.level.isWalkingLevel && this.settingsManager.getIsTeammate && this.settingsManager.getIsTeammate();
        if (this.level.hasRecruitFollowers || (this.autoRecruits.length && isTeammateScene)) this.addRecruitFollowers();
        if (this.level.extras) this.level.extras.forEach(extra => this.addExtra(extra));
        if (this.level.walkers) this.level.walkers.forEach(walker => this.addWalker(walker));
        if (getIsDialogueLog()) this.addSceneTalks();
        if (this.level.isDepowered) this.depowerPlayerTeam();

        // a fight: the recruits are there from its opening scene (Jamie)
        if (!this.level.isWalkingLevel) this.autoSummonRecruits(true);
        if (this.level.giantKaiju) this.startFinalBattle();
        if (this.level.finalTurn && this.level.finalTurn.isStartTurned) this.startTurnedFight();
        if (this.level.ghostBoss) this.setUpGhostGuardian();
        if (this.hasArrival) this.startArrival();
        else if (this.level.rival && this.level.rival.isTraining) this.startTrainingFight();
        else if (this.level.rival) this.startRivalIntro();
        else if (this.level.isMapWalk) this.startMapIntro();
        else if (this.level.trap) this.startTrapScene();
        else if (this.level.showdown) this.startShowdown();
        else if (this.level.walkIn) this.startWalkInScene();
        else if (this.level.visitLines) this.queueVisitScene();
        else if (this.level.greeting) this.startGreeting();
        if (this.isRetry && this.cutscene) this.skipCutscene();
    }

    // just outside a site's reach, toward the middle of the map, so the walk carries on from beside it
    // back from a recruit's training, won (Jamie, playtest 18): the team is where the "Do Training" sign was.
    // (not after sparring: the sign opens there again, and they'd be standing on it)
    getTrainingReturnTiles() {
        const outcome = this.trainingOutcome;
        if (!outcome || outcome.isSparring || !this.level.training) return undefined;
        return [this.gameBoardManager.getClosestWalkableTileToLocation(this.level.training.spot)];
    }

    /*
        A map walk (Jamie, playtest 18): the team never starts by a site's icon. one there can't be gone into until the player
        has walked off and back (armedSites), and it looks odd. the player and the teammate move to the nearest tiles clear
        of every site.
    */
    moveTeamClearOfSites() {
        const board = this.gameBoardManager;
        const { rowStep, scale } = this.level.grid;
        const clearPx = (SITE_ROWS + 1.2) * rowStep * scale; // past where a site is armed (SITE_ROWS + 1)
        const getIsClear = tile => {
            const { x, y } = getTileCenter(this.level.grid, tile);
            return this.level.sites.every(({ spot }) => Math.hypot(x - spot.x, y - spot.y) > clearPx);
        };
        const [player, teammate] = this.gameBoardPiecesManager.getTeamPieces(this.gameBoardPiecesManager.getPlayerTeamIndex());
        if (!player || getIsClear(player.getTileIndex())) return;
        const here = getTileCenter(this.level.grid, player.getTileIndex());
        const byDistance = board.walkableTiles.filter(getIsClear).map(tile => {
            const { x, y } = getTileCenter(this.level.grid, tile);
            return { tile, distance: Math.hypot(x - here.x, y - here.y) };
        }).sort((a, b) => a.distance - b.distance);
        if (!byDistance.length) return;
        const [{ tile }] = byDistance;
        player.initCharLocation(true, tile);
        if (teammate) {
            const besideTile = board.getAdjacentTileIndices(tile).filter(board.getIsInBounds).find(next => board.walkableTiles.some(({ i, j }) => i == next.i && j == next.j) && getIsClear(next));
            teammate.initCharLocation(true, besideTile || tile);
        }
    }

    getReturnTiles(spot) {
        const { rowStep, scale } = this.level.grid;
        const { width, height } = this.level.world;
        const toMiddle = { x: width / 2 - spot.x, y: height / 2 - spot.y };
        const length = Math.hypot(toMiddle.x, toMiddle.y) || 1;
        const reach = (SITE_ROWS + 1.5) * rowStep * scale;
        const start = { x: spot.x + (toMiddle.x / length) * reach, y: spot.y + (toMiddle.y / length) * reach };
        return [start, { x: start.x + 25, y: start.y }].map(spot => this.gameBoardManager.getClosestWalkableTileToLocation(spot));
    }

    // played again: everything the opening scene sets up happens at once, with no words
    skipCutscene() {
        const { steps, index } = this.cutscene;
        steps.slice(Math.max(index, 0)).forEach(step => {
            if (step.phase) this.activePhases.add(step.phase);
            if (step.onStart) step.onStart();
            (step.arrivals || []).forEach(({ piece, toTile }) => {
                if (toTile) piece.initCharLocation(true, toTile);
                piece.isVisible = true;
            });
        });
        this.cutscene = undefined;
        this.speech = null;
        this.getPieces().forEach(piece => {
            piece.isTileHidden = false;
            if (!piece.isDead) piece.isVisible = true; // one who has left the scene, like the Agent who talked, stays gone
        });
    }

    // the Agents' ray only took the player's and teammate's powers: the recruits keep theirs
    getDepoweredPieces() {
        return this.gameBoardPiecesManager.getTeamPieces(this.gameBoardPiecesManager.getPlayerTeamIndex())
            .filter(piece => !piece.isRecruit && !this.followers.includes(piece));
    }

    // the Agents took their powers: no glow, to show it
    depowerPlayerTeam() {
        this.getDepoweredPieces().forEach(piece => { piece.isPlain = true; });
    }

    // the bystander has touched the Kaiju part in the intro, and now the fight starts
    updateRival() {
        if (this.activePhases.has(RIVAL_IN_PHASE)) return;
        this.setPhase(RIVAL_IN_PHASE, true);
        this.rivalPiece.isShowHealthBarOnComponent = true;
        this.rivalPiece.introZIndex = undefined;
    }

    // from the start: the bystander in the scene is the piece they fight
    // the Aquarium's Mermaid (Jamie): she goes all over the hall, and each stairway rests a while once she has used it
    // (so she runs to the other one), the rests staggered by when she used each
    updateRoamingRival() {
        const rival = this.rivalPiece;
        const roam = this.level.rival && this.level.rival.roam;
        if (!roam || !rival || rival.isDead || !rival.isOnTiles || this.cutscene || rival.walkToTile) return;
        if (this.accTime < (this.nextRoamAt || roam.everyMs)) return;
        this.nextRoamAt = this.accTime + roam.everyMs;
        // the flood: she roams the top floor, where she's kept (allowedTile), not standing still (Jamie, playtest 18)
        const minRows = this.isShattered && roam.topFloorMinRows ? roam.topFloorMinRows : roam.minRows;
        const here = this.gameBoardManager.getCharXAndYFromTileIndex(rival.getTileIndex());
        const far = this.gameBoardManager.walkableTiles.filter(tile => {
            const spot = this.gameBoardManager.getCharXAndYFromTileIndex(tile);
            return Math.hypot(spot.x - here.x, spot.y - here.y) > minRows * this.getGhostRowPx() && !this.gameBoardManager.getLinkedTile(tile)
                && rival.getIsAllowedTile(tile);
        });
        if (far.length) rival.walkToTile = far[Math.floor(Math.random() * far.length)];
    }

    // the player and the teammate (not a recruit), with which of the training points are theirs
    getTrainingPieces() {
        const [player, teammate] = this.gameBoardPiecesManager.getTeamPieces(this.gameBoardPiecesManager.getPlayerTeamIndex());
        const isOwn = piece => !!piece && !piece.isRecruit && !this.followers.includes(piece);
        return [[player, 'player'], [teammate, 'teammate']].filter(([piece]) => isOwn(piece));
    }

    // the training points left now, for Game.tsx to keep (one not here, like the teammate in a training fight, keeps theirs)
    getTrainingPoints() {
        const points = { ...this.trainingPoints };
        this.getTrainingPieces().forEach(([piece, who]) => {
            if (piece.trainingBase !== undefined) points[who] = Math.max(0, piece.maxLives - piece.trainingBase);
        });
        return points;
    }

    addRival() {
        const { abilities, maxLives, moveSpeed, spot, startFacing, introSortY, isSparring } = this.level.rival;
        // sparring: the teammate, with powers of their own as in any fight
        const avatar = isSparring ? this.settingsManager.getTeammateAvatar() : this.level.rival.avatar;
        const piece = this.gameBoardPiecesManager.addPiece({
            pieceInfo: {
                ...PIECES_INFO[avatar],
                abilities: isSparring ? this.settingsManager.getThreeRandomAbilities() : this.settingsManager.getAbilitiesFromElements(abilities),
                // the teammate sparring is as tough as they have become (their health won sparring too)
                maxLives: isSparring ? maxLives + Math.min(this.trainingPoints.teammate || 0, SPARRING.maxPoints) : maxLives,
                moveSpeed
            },
            teamIndex: 1
        });
        if (isSparring) piece.color = getAvatarColor(avatar) || piece.color;
        piece.initCharLocation(true, this.gameBoardManager.getClosestWalkableTileToLocation(spot));
        piece.isPlain = true; // no glow until they touch the part
        piece.canTeleportAcross = !!this.level.rival.canTeleportAcross;
        const { cooldownScales } = this.level.rival; // e.g. Punk Guy's Teleport, twice as often in his fight (Jamie, playtest 18)
        if (cooldownScales) piece.abilities.forEach(ability => { ability.cooldownScale = cooldownScales[ability.gameBoardPieceAbilityData.element]; });
        piece.linkRestMs = this.level.rival.linkRestMs; // each stairway rests this long after she takes it (the Mermaid)
        piece.isTileHidden = true;
        piece.facingDir = startFacing;
        piece.introZIndex = getSortZIndex(this.level, introSortY);
        this.rivalPiece = piece;
        if (this.level.ghostBoss) piece.onBeforeDeath = () => this.onGhostBossDown();
        if (this.level.aquariumFlood) piece.onBeforeDeath = () => this.onMermaidDown();
    }

    /*
        The enemy zoom (GameBoard) looks toward the closest enemy on the board, and also toward these, each { key, charLocation }:
        a power chasing the player (Haunt, Overgrowth's leading tiles, Ice Slice, Charm, the Aquarium's sea creatures; not Heal),
        the ghost boss's launched ghosts coming for the player, and Kaiju walking in that are near the player.
    */
    /*
        The ghost boss's ring, while the player is inside it and no launched ghost is coming for them: the camera pulls back
        to the whole ring (Jamie). A ghost coming for them takes the camera back (the enemy zoom follows it).
    */
    getIsGhostRingCameraOn() {
        const ring = this.ghostRing;
        const player = this.gameBoardPiecesManager.getPlayerPiece();
        return !!ring && ring.getIsFormed() && !!player && !player.isDead && !this.cutscene && this.getIsCameraKeptOff(player, this.rivalPiece)
            && !this.getCameraThreats(player).some(({ key }) => key.startsWith('phaseGhost'));
    }

    // the play camera's zoom, as a share of the usual: a medium shot inside the ghost ring (Jamie, playtest 18)
    getPlayZoomShare() {
        return GHOST_SCREAM.ringMediumZoomShare && this.getIsGhostRingCameraOn() ? GHOST_SCREAM.ringMediumZoomShare : 1;
    }

    getGhostRingShot() {
        const ring = this.ghostRing;
        // the medium zoom instead (getPlayZoomShare): the whole ring was seen as the scream's scene ended
        const isOn = !GHOST_SCREAM.ringMediumZoomShare && this.getIsGhostRingCameraOn();
        if (!isOn) {
            if (this.ghostRingShot) this.ghostRingShotsSeen = (this.ghostRingShotsSeen || 0) + 1;
            this.ghostRingShot = undefined;
            return undefined;
        }
        // the same shot while it lasts: a new one would start the camera's pull again.
        // the first time, it pulls out at once; after that, slowly, so the close-up action isn't left behind all at once (Jamie)
        const panMs = this.ghostRingShotsSeen ? GHOST_SCREAM.ringShotRelaxedPanMs : GHOST_SCREAM.ringShotPanMs;
        if (!this.ghostRingShot) this.ghostRingShot = { point: { ...ring.center }, zoomScale: GHOST_SCREAM.ringShotZoom, panMs, ease: 'ease-out' };
        return this.ghostRingShot;
    }

    /*
        For the NPCs' defensive powers (Jamie): a launched ghost of the ring within CAMERA_THREATS.ghostDangerRows of the piece,
        or a sea creature on a tile within two of it. (Sea creatures do harm on their tiles, so the usual check sees them too.)
    */
    getIsBossThreatNear = pieceIndex => {
        const piece = this.getPieces()[pieceIndex];
        if (!piece || piece.isDead || !piece.isOnTiles) return false;
        const rowPx = this.getGhostRowPx();
        if (this.ghostRing) {
            const near = CAMERA_THREATS.ghostDangerRows * rowPx;
            if (this.ghostRing.ghosts.some(ghost => ghost.state == 'launched' && Math.hypot(ghost.x - piece.charLocation.x, ghost.y - piece.charLocation.y) <= near)) return true;
        }
        if (this.aquariumFlood) {
            const board = this.gameBoardManager;
            const here = piece.getTileIndex();
            return board.getAdjacentAdjacentTileIndices(here).some(({ i, j }) => {
                const tile = board.tiles[i] && board.tiles[i][j];
                const status = tile && tile.getTileStatus();
                return !!status && status.getAppliedStatus() == 'isSeaGhost' && tile.teamIndex != piece.getTeamIndex();
            });
        }
        return false;
    };

    // the enemy zoom leaves these out: while the ghost boss's ring is up and the player is inside it, Ghost Girl (Jamie).
    // the ring is the fight then, not her.
    getIsCameraKeptOff = (player, piece) => {
        // the Aquarium: the Mermaid up on the top floor, healing, while the player is down in the water (Jamie). the camera
        // stays the usual one, on the water and the creatures; her caret still shows where she is.
        if (this.level.aquariumFlood && this.isShattered && piece == this.rivalPiece && !!player) {
            return this.getIsTopFloor(piece.getTileIndex()) && !this.getIsTopFloor(player.getTileIndex()) && !this.getIsAtAquariumStairs(player);
        }
        const ring = this.ghostRing;
        if (!ring || piece != this.rivalPiece || !player) return false;
        const dx = player.charLocation.x - ring.center.x;
        const dy = (player.charLocation.y - ring.center.y) / GHOST_BOSS.ringSquash;
        return Math.hypot(dx, dy) <= ring.radiusPx;
    };

    // the Aquarium's flood (Jamie, playtest 18): the player at the stairs (a link's tile, or a couple of rows from one) or up
    // on the top floor is going for the Mermaid: the usual camera, on her, not in close on the sea creatures
    getIsAtAquariumStairs = player => {
        if (!this.level.aquariumFlood || !this.isShattered || !player || !player.getTileIndex()) return false;
        if (this.getIsTopFloor(player.getTileIndex())) return true;
        const near = AQUARIUM_STAIRS_NEAR_ROWS * this.getGhostRowPx();
        return (this.level.tileLinks || []).flat().some(tile => {
            const spot = this.gameBoardManager.getCharXAndYFromTileIndex(tile);
            return Math.hypot(spot.x - player.charLocation.x, spot.y - player.charLocation.y) <= near;
        });
    };

    getCameraThreats = player => {
        if (!player || player.isDead) return [];
        const board = this.gameBoardManager;
        const threats = [];
        const isAtStairs = this.getIsAtAquariumStairs(player);
        // one per cast: its tile closest to the player
        const byCast = new Map();
        board.getActiveTiles().forEach(tile => {
            const status = tile.getTileStatus();
            if (!status || !CAMERA_THREATS.statuses.includes(status.getAppliedStatus())) return;
            if (tile.targetIndex != player.pieceIndex || tile.teamIndex == player.getTeamIndex() || tile.getCurrCount() <= 0) return;
            if (isAtStairs && status.getAppliedStatus() == 'isSeaGhost') return;
            const key = `status ${status.getAppliedStatus()} ${tile.cast.casterIndex} ${tile.cast.seaIcon || ''}`;
            const charLocation = board.getCharXAndYFromTileIndex(tile.tileIndex);
            const distance = Math.hypot(charLocation.x - player.charLocation.x, charLocation.y - player.charLocation.y);
            // a sea creature after the player: the camera goes in tighter and quicker (Jamie)
            const isTense = status.getAppliedStatus() == 'isSeaGhost';
            if (!byCast.has(key) || distance < byCast.get(key).distance) byCast.set(key, { key, charLocation, distance, isTense });
        });
        threats.push(...[...byCast.values()].map(({ key, charLocation, isTense }) => ({ key, charLocation, isChasing: true, isTense })));
        // the ring's launched ghosts, heading for the player (the closest of the team to them)
        if (this.ghostRing) {
            const team = this.gameBoardPiecesManager.getTeamPieces(this.gameBoardPiecesManager.getPlayerTeamIndex()).filter(piece => !piece.isDead && piece.isOnTiles);
            this.ghostRing.ghosts.filter(({ state }) => state == 'launched').forEach(ghost => {
                const getDistance = piece => Math.hypot(piece.charLocation.x - ghost.x, piece.charLocation.y - ghost.y);
                const chased = team.reduce((closest, piece) => !closest || getDistance(piece) < getDistance(closest) ? piece : closest, undefined);
                if (chased == player) threats.push({ key: `phaseGhost ${ghost.id}`, charLocation: { x: ghost.x, y: ghost.y }, isChasing: true });
            });
        }
        // Kaiju not on the board yet, but near
        const nearPx = CAMERA_THREATS.kaijuNearRows * this.getGhostRowPx();
        this.getPieces().forEach(piece => {
            if (piece.avatar != 'kaiju' || piece.isGiant || piece.isDead || piece.isOnTiles || !piece.charLocation) return;
            if (Math.hypot(piece.charLocation.x - player.charLocation.x, piece.charLocation.y - player.charLocation.y) <= nearPx) {
                threats.push({ key: `piece ${piece.pieceIndex}`, charLocation: piece.charLocation });
            }
        });
        return threats;
    };

    /*
        The player going through a portal (a Teleport's wormhole, or a level's tile link such as the Aquarium's stairs).
        In: the fight holds, the camera goes in close on the way in, and the player walks into it, the body gone past its
        edge, as through a door. Across: the camera pulls back to the usual zoom and pans to the other end while the fight
        goes on (the player is nowhere). Out: the fight holds again, in close, and the player walks out the same way.
        A level can say where a link's edge is ('linkWalls'): the Aquarium's stairs go behind a pillar.
    */
    startPortalWalk = (piece, toTile) => {
        if (this.portalWalk || this.cutscene || piece != this.gameBoardPiecesManager.getPlayerPiece()) return false;
        const board = this.gameBoardManager;
        const fromTile = piece.getTileIndex();
        const rowPx = this.getGhostRowPx();
        const scale = this.level.pieceScale;
        const unit = ({ x, y }) => { const length = Math.hypot(x, y) || 1; return { x: x / length, y: y / length }; };
        // which way they were going: their last step, or up
        const moving = { x: piece.charLocation.x - piece.moveFromLocation.x, y: piece.charLocation.y - piece.moveFromLocation.y };
        const stepDir = TILE_DIRS.indexOf(piece.dir) >= 0 ? TILE_DIR_NORM_VECS[TILE_DIRS.indexOf(piece.dir)] : undefined;
        const fallback = PORTAL_DIR_VECS[piece.dir] || PORTAL_DIR_VECS[piece.getFacingDir()] || { x: 0, y: -1 };
        let inDir = Math.hypot(moving.x, moving.y) > 0.5 ? unit(moving) : (stepDir || fallback);
        const getWall = tile => (this.level.linkWalls || []).find(({ tile: wallTile }) => wallTile.i == tile.i && wallTile.j == tile.j);
        const fromWall = getWall(fromTile);
        const toWall = getWall(toTile);
        if (fromWall) inDir = { x: -fromWall.outDir.x, y: -fromWall.outDir.y };
        // the way out: the link's own, or on the way they were going if there is room, or toward the nearest open tile
        const toSpot = board.getCharXAndYFromTileIndex(toTile);
        const neighbors = board.getAdjacentTileIndices(toTile).filter(board.getIsInBounds);
        const toward = tile => { const spot = board.getCharXAndYFromTileIndex(tile); return unit({ x: spot.x - toSpot.x, y: spot.y - toSpot.y }); };
        const outDir = toWall ? toWall.outDir
            : neighbors.length ? toward(neighbors.reduce((best, tile) => { const a = toward(tile); const b = toward(best); return a.x * inDir.x + a.y * inDir.y > b.x * inDir.x + b.y * inDir.y ? tile : best; }))
            : inDir;
        // the body, from where the piece stands (its feet), in the level's pixels
        const body = PORTAL_WALK.body.map(({ x, y }) => ({ x: x * scale, y: y * scale }));
        // in: the edge it goes through, and where it walks to, all of it past the edge
        const fromSpot = { ...piece.charLocation };
        const inEdge = fromWall ? { point: fromWall.point, behind: fromWall.behind } : { point: { ...fromSpot }, behind: inDir }; // into the portal itself
        const getThrough = (start, dir, { point, behind }) => {
            const along = dir.x * behind.x + dir.y * behind.y;
            if (along <= 0.05) return { x: start.x + dir.x * rowPx * 2, y: start.y + dir.y * rowPx * 2 };
            const t = Math.max(...body.map(({ x, y }) => -((start.x + x - point.x) * behind.x + (start.y + y - point.y) * behind.y) / along)) + 2;
            return { x: start.x + dir.x * Math.max(t, 0), y: start.y + dir.y * Math.max(t, 0) };
        };
        const inEnd = getThrough(fromSpot, inDir, inEdge);
        // the walk in starts with all of them in view: where a link's tile is already past the edge (the stairs), a step back
        const along = inDir.x * inEdge.behind.x + inDir.y * inEdge.behind.y;
        const pastEdge = Math.max(...body.map(({ x, y }) => (fromSpot.x + x - inEdge.point.x) * inEdge.behind.x + (fromSpot.y + y - inEdge.point.y) * inEdge.behind.y));
        const backBy = along > 0.05 && pastEdge > -1 ? (pastEdge + 2) / along : 0;
        const inStart = { x: fromSpot.x - inDir.x * backBy, y: fromSpot.y - inDir.y * backBy };
        // out: it walks from all behind the edge to the far tile, all of it in view by then
        const outEdge = toWall ? { point: toWall.point, behind: toWall.behind } : { point: { ...toSpot }, behind: { x: -outDir.x, y: -outDir.y } }; // out of the portal itself
        // where the walk out ends: on from the far tile until all of them is in view (a link's tile can be behind its edge)
        const outAlong = -(outDir.x * outEdge.behind.x + outDir.y * outEdge.behind.y);
        const stillBehind = Math.max(...body.map(({ x, y }) => (toSpot.x + x - outEdge.point.x) * outEdge.behind.x + (toSpot.y + y - outEdge.point.y) * outEdge.behind.y));
        const onBy = outAlong > 0.05 && stillBehind > -1 ? (stillBehind + 2) / outAlong : 0;
        const outEndSpot = { x: toSpot.x + outDir.x * onBy, y: toSpot.y + outDir.y * onBy };
        // a link may name the tile the walk out ends on (the Aquarium's doors: the one below and to the doorway's side)
        const outTile = toWall && toWall.outTile && board.getIsInBounds(toWall.outTile) ? toWall.outTile
            : onBy > 0 ? board.getClosestWalkableTileToLocation(outEndSpot) : toTile;
        const outSpot = board.getCharXAndYFromTileIndex(outTile);
        const back = getThrough(outSpot, { x: -outDir.x, y: -outDir.y }, outEdge);
        const extreme = { zoomScale: PENINSULA.cameraZoom * CUTSCENE.outcomeZoomScale, isPeninsulaSized: true };
        const headOf = spot => ({ x: spot.x, y: spot.y - CUTSCENE.shotHeadRows * rowPx * 0.5 });
        const inShot = { point: headOf(inEdge.point), ...extreme, panMs: PORTAL_WALK.zoomInMs };
        const walkTo = (from, to, dir) => share => {
            piece.charLocation = { x: from.x + (to.x - from.x) * share, y: from.y + (to.y - from.y) * share };
            piece.moveFromLocation = piece.charLocation;
            piece.moveToLocation = piece.charLocation;
            piece.dir = getDirName(dir);
        };
        piece.stopMoving();
        this.portalWalk = { piece, toTile, toSpot: outSpot, outTile, back, outDir, outEdge, extreme, headOf, walkTo, stage: 'in' };
        this.startCutscene([
            { shot: inShot, ms: PORTAL_WALK.zoomInMs, onStart: () => { piece.portalMask = inEdge; walkTo(inStart, inStart, inDir)(0); } },
            { shot: inShot, ms: PORTAL_WALK.walkMs, onTick: walkTo(inStart, inEnd, inDir) },
            { shot: inShot, ms: 0, onStart: () => {
                // gone through: nowhere, while the camera goes across and the fight goes on
                piece.portalMask = undefined;
                piece.isVisible = false;
                piece.isOnTiles = false;
                piece.isInPortal = true;
                piece.dir = 'idle';
                this.portalWalk.stage = 'across';
                this.portalWalk.acrossMs = 0;
                this.portalShot = { point: headOf(inEdge.point), isPlayZoom: true, panMs: PORTAL_WALK.zoomOutMs };
            } }
        ], { isMidFight: true, isPortalWalk: true });
        return true;
    };

    /*
        A scene starting while the player is walking through a portal, or about to teleport (Jamie: they went missing from
        the recruit choice, and from the Rooftop's team teleport): the walk ends at once, the player there at its far end,
        and any Teleport still to happen is called off, for everyone. The scene can then put them where they belong.
    */
    endTravelForScene() {
        this.getPieces().forEach(piece => { piece.shouldTeleport = false; });
        const walk = this.portalWalk;
        if (!walk) return;
        const { piece, outTile, toSpot } = walk;
        this.portalWalk = undefined;
        this.portalShot = undefined;
        piece.portalMask = undefined;
        piece.isInPortal = false;
        piece.isVisible = true;
        piece.isOnTiles = true;
        piece.setTileIndex(outTile);
        piece.charLocation = { ...toSpot };
        piece.moveFromLocation = piece.charLocation;
        piece.moveToLocation = piece.charLocation;
        piece.moveToTiles = [];
        piece.isThere = true;
        piece.dir = 'idle';
        piece.linkArrivalTile = outTile;
    }

    // across: back to the usual zoom where they went in, then over to the other end, the fight going on below
    updatePortalTransit() {
        const walk = this.portalWalk;
        if (walk.stage != 'across') return;
        walk.acrossMs += GAME_TICK.pieceMs;
        if (walk.acrossMs >= PORTAL_WALK.zoomOutMs && !walk.isPanning) {
            walk.isPanning = true;
            this.portalShot = { point: walk.headOf(walk.outEdge.point), isPlayZoom: true, panMs: PORTAL_WALK.panMs };
        }
        if (walk.acrossMs < PORTAL_WALK.zoomOutMs + PORTAL_WALK.panMs) return;
        // out: the fight holds, in close, and they walk out of it
        const { piece, toTile, toSpot, outTile, back, outDir, outEdge, extreme, headOf, walkTo } = walk;
        walk.stage = 'out';
        this.portalShot = undefined;
        const outShot = { point: headOf(outEdge.point), ...extreme, panMs: PORTAL_WALK.zoomInMs };
        piece.setTileIndex(outTile);
        piece.charLocation = { ...back };
        piece.isOnTiles = true;
        piece.isVisible = true;
        piece.isInPortal = false;
        piece.portalMask = outEdge;
        piece.linkArrivalTile = toTile; // standing on the far end doesn't send them straight back
        this.startCutscene([
            { shot: outShot, ms: PORTAL_WALK.zoomInMs },
            { shot: outShot, ms: PORTAL_WALK.walkMs, onTick: walkTo(back, toSpot, outDir) },
            { shot: outShot, ms: 0, onStart: () => {
                piece.portalMask = undefined;
                piece.charLocation = { ...toSpot };
                piece.moveFromLocation = piece.charLocation;
                piece.moveToLocation = piece.charLocation;
                piece.isThere = true;
                piece.dir = 'idle';
                this.portalWalk = undefined;
            } }
        ], { isMidFight: true, isPortalWalk: true });
    }

    /*
        The player's Teleport, on ground of their own apart from the rival's (Jamie): the Subway's platforms with a train
        between, the Rooftop's two buildings, the Aquarium's two floors. Pressed toward the rival, the line of tiles goes on
        across the gaps, onto the rival's ground, and to its far edge, never past it onto other ground beyond.
        Otherwise (same ground, or away from them), undefined: the Teleport goes as it always does.
    */
    getTeleportRegion = tile => {
        if (this.level.ghostBoss) return this.getIsRivalGround(tile) ? 'theirRoof' : 'graveyardRoof';
        if (this.level.aquariumFlood) return this.getIsTopFloor(tile) ? 'top' : 'ground';
        // otherwise, the tiles that can be walked to from it, as things stand (a train in closes the tracks)
        const board = this.gameBoardManager;
        const key = `${board.walkableRevision}`;
        if (!this.regionCache || this.regionCache.key != key) this.regionCache = { key, regions: new Map() };
        const { regions } = this.regionCache;
        const tileKey = `${tile.i} ${tile.j}`;
        if (!regions.has(tileKey)) {
            const reachable = [tile];
            const seen = new Set([tileKey]);
            for (const each of reachable) {
                board.getAdjacentTileIndices(each).forEach(next => {
                    const nextKey = `${next.i} ${next.j}`;
                    if (seen.has(nextKey)) return;
                    seen.add(nextKey);
                    reachable.push(next);
                });
            }
            const region = [...seen].sort()[0];
            seen.forEach(each => regions.set(each, region));
        }
        return regions.get(tileKey);
    };

    getTeleportAcross = (fromTile, pressedDir, playerInputHandler) => {
        const rival = this.rivalPiece;
        if (!this.level.rival || !rival || rival.isDead || !rival.isOnTiles) return undefined;
        const board = this.gameBoardManager;
        const rivalRegion = this.getTeleportRegion(rival.getTileIndex());
        if (this.getTeleportRegion(fromTile) == rivalRegion) return undefined;
        // the straight line of tiles the way pressed, across gaps, to the edge of the grid
        const line = [];
        let tile = fromTile;
        for (let step = 0; step < 300; step += 1) {
            const [dir] = playerInputHandler.getTileDirsFromPressedDir(pressedDir, tile);
            if (!dir) break;
            const offset = board.getTileOffsetFromDir(dir, tile);
            tile = { i: tile.i + offset.i, j: tile.j + offset.j };
            if (tile.i < 0 || tile.j < 0 || tile.i >= board.numTileColumns || tile.j >= board.numTileRows) break;
            line.push(tile);
        }
        const isTheirs = each => board.getIsInBounds(each) && this.getTeleportRegion(each) == rivalRegion;
        const first = line.findIndex(isTheirs);
        if (first < 0) return undefined; // not toward them
        let last = first;
        while (last + 1 < line.length && isTheirs(line[last + 1])) last += 1;
        return line.slice(0, last + 1);
    };

    // - - - the final battle (GiantKaiju.ts) - - -

    // the teammate is a giant Kaiju at the foot of the Peninsula, heading for the city. the recruits are with the player.
    startFinalBattle() {
        const { grid } = this.level;
        this.giant = new GiantKaiju({ route: this.level.giantKaiju.route, rowPx: grid.rowStep * grid.scale });
        const teammateAvatar = this.settingsManager.getTeammateAvatar();
        this.giantColor = getAvatarColor(teammateAvatar) || (PIECES_INFO[teammateAvatar] || {}).color || '#7fff7f';
        this.giantPiece = this.gameBoardPiecesManager.addPiece({
            pieceClass: GameBoardPieceGiant,
            pieceInfo: { ...PIECES_INFO.kaiju, abilities: [], maxLives: GIANT_KAIJU.drainHits, moveSpeed: 0 },
            teamIndex: 1
        });
        this.giantPiece.color = this.giantColor;
        this.giantPiece.onBeforeDeath = () => this.onGiantDrained();
        this.moveGiantPiece();
        this.giantVoices = getKeyedLines('finalBattle.voices');
        // everyone recruited fights beside the player, from the start
        const recruited = this.getRecruitedAvatars();
        const player = this.gameBoardPiecesManager.getPlayerPiece();
        recruited.forEach((avatar, k) => {
            const rivalLevel = Object.values(LEVELS).find(({ rival }) => rival && rival.avatar == avatar);
            if (!rivalLevel) return;
            const piece = this.gameBoardPiecesManager.addRecruit(avatar, this.settingsManager.getAbilitiesFromElements(rivalLevel.rival.abilities));
            const near = this.gameBoardManager.getAdjacentTileIndices(player.getTileIndex()).filter(this.gameBoardManager.getIsInBounds);
            piece.initCharLocation(true, near[k % Math.max(near.length, 1)] || player.getTileIndex());
        });
        if (!this.isRetry) this.startFinalBattleIntro();
    }

    // a scene's lines as cutscene steps, each over its speaker ('getSpeaker' can place a speaker with no piece)
    getSceneSteps(sceneId, getShot, getSpeaker = () => undefined) {
        return getSpokenLines(sceneId).map(({ speaker, text }) => {
            const { name, piece } = this.getLineSpeaker(speaker);
            const over = piece || getSpeaker(speaker);
            const speech = over ? this.getSpeechOver(over, name, text) : { name, text };
            return { shot: getShot(over), ms: getSpeechMs(text), speech: { ...speech, avatar: speaker == 'agent' ? 'agent' : speech.avatar } };
        });
    }

    // the Lab fight ends with the teammate transforming, when the final battle is the giant
    getIsTransforming() {
        return !!this.level.transformScene && GIANT_KAIJU.isFinalBattle;
    }

    // the clones are down, and the teammate turns: their words, the scream, a flash, and they are gone (the final battle comes next)
    startTransformation() {
        const { player, teammate } = this.getGhostTeam();
        if (!teammate || teammate.isDead) {
            this.transformState = 'done';
            return;
        }
        this.transformState = 'transforming';
        const rowPx = this.getGhostRowPx();
        const closeOn = piece => ({ point: { x: piece.charLocation.x, y: piece.charLocation.y - CUTSCENE.shotHeadRows * rowPx * 0.5 }, zoomScale: PENINSULA.cameraZoom * CUTSCENE.outcomeZoomScale * 0.8, isPeninsulaSized: true, panMs: CUTSCENE.outcomePullMs });
        const steps = this.getSceneSteps(this.level.transformScene, over => closeOn(over || teammate));
        const lastLine = steps.pop();
        this.startCutscene([
            { shot: closeOn(teammate), ms: CUTSCENE.outcomePullMs },
            ...steps,
            { shot: closeOn(teammate), ms: GHOST_SCREAM.flashInMs, onStart: () => { this.ghostFlashCount += 1; } },
            { shot: closeOn(teammate), ms: GHOST_SCREAM.togetherMs, onStart: () => {
                teammate.isVisible = false;
                teammate.isOnTiles = false;
            } },
            { ...lastLine, shot: closeOn(player) },
            { shot: closeOn(player), ms: 0, onStart: () => { this.transformState = 'done'; } }
        ]);
    }

    /*
        The last fight's end (Jamie, 2026-11-06): its Kaiju beaten, the team talks (in the log), and the teammate turns:
        a flash, and in their place a Kaiju with every power, 10 health, in their color. It is the last fight.
        No ray, no rescue. Without a teammate, the fight is simply won.
    */
    startFinalTurn() {
        const { player, teammate } = this.getGhostTeam();
        // the player fell, and the one they played on as finished it (the teammate or a recruit): no one turns, the city
        // is saved (Jamie, playtest 19)
        if (!player || player.isDead) {
            this.finalTurnState = 'saved';
            return;
        }
        // no teammate to turn (they fell, or there never was one): the player turns instead (Jamie)
        if (!teammate || teammate.isDead) {
            this.startPlayerTurn(player);
            return;
        }
        this.finalTurnState = 'turning';
        const rowPx = this.getGhostRowPx();
        const closeOn = piece => ({ point: { x: piece.charLocation.x, y: piece.charLocation.y - CUTSCENE.shotHeadRows * rowPx * 0.5 }, zoomScale: PENINSULA.cameraZoom * 1.4, isPeninsulaSized: true, panMs: CUTSCENE.outcomePullMs });
        const lines = this.getSceneSteps(this.level.finalTurn.scene, over => closeOn(over || teammate));
        this.startCutscene([
            { shot: closeOn(teammate), ms: CUTSCENE.outcomePullMs },
            ...lines,
            { shot: closeOn(teammate), ms: GHOST_SCREAM.flashInMs, onStart: () => { this.ghostFlashCount += 1; } },
            { shot: closeOn(teammate), ms: GHOST_SCREAM.togetherMs, onStart: () => this.turnTeammateKaiju(teammate) },
            { shot: closeOn(player), ms: 0, onStart: () => { this.finalTurnState = 'fighting'; } }
        ]);
    }

    /*
        The other ending (Jamie, 2026-11-10): with no teammate left to turn, the player hears the Kaiju calling, and turns:
        a flash, and a Kaiju stands where they were. It is the end: "You destroyed the city!", then the credits.
    */
    startPlayerTurn(player) {
        this.finalTurnState = 'turning';
        const rowPx = this.getGhostRowPx();
        const closeOn = piece => ({ point: { x: piece.charLocation.x, y: piece.charLocation.y - CUTSCENE.shotHeadRows * rowPx * 0.5 }, zoomScale: PENINSULA.cameraZoom * 1.4, isPeninsulaSized: true, panMs: CUTSCENE.outcomePullMs });
        const lines = this.getSceneSteps(this.level.finalTurn.aloneScene, over => closeOn(over || player));
        this.startCutscene([
            { shot: closeOn(player), ms: CUTSCENE.outcomePullMs },
            ...lines,
            { shot: closeOn(player), ms: GHOST_SCREAM.flashInMs, onStart: () => { this.ghostFlashCount += 1; } },
            { shot: closeOn(player), ms: FINAL_TURN.playerKaijuHoldMs, onStart: () => this.turnPlayerKaiju(player) },
            { shot: closeOn(player), ms: 0, onStart: () => { this.finalTurnState = 'destroyed'; } }
        ]);
    }

    // the player gone, and in their place their Kaiju: it stands there (the city's end follows)
    turnPlayerKaiju(player) {
        const tile = player.getTileIndex();
        const location = { ...player.charLocation };
        player.isVisible = false;
        player.isUnhurtable = true;
        const kaiju = this.gameBoardPiecesManager.addPiece({
            pieceClass: GameBoardPieceKaiju,
            pieceInfo: { ...PIECES_INFO.kaiju, abilities: [], spewFireCoolDown: Infinity, maxLives: 99, moveSpeed: 0, isDoAvoidEnemy: false, color: player.color },
            teamIndex: 1
        });
        kaiju.initCharLocation(true, tile);
        kaiju.charLocation = location;
        kaiju.isUnhurtable = true;
        kaiju.isPlayerKaiju = true;
        this.playerKaiju = kaiju;
    }

    // the fight with the teammate's Kaiju from its start: they have already turned (no words, no Kaiju waves before it)
    startTurnedFight() {
        const { player, teammate } = this.getGhostTeam();
        this.score = this.getKillsToWin();
        if (!teammate) {
            this.startPlayerTurn(player);
            return;
        }
        this.turnTeammateKaiju(teammate);
        this.finalTurnState = 'fighting';
    }

    turnTeammateKaiju(teammate) {
        const { kaijuLives, coolDownMs, castEveryMs } = this.level.finalTurn;
        const tile = teammate.getTileIndex();
        // they are gone (not a death: nothing to count), and a Kaiju stands where they were
        teammate.isVisible = false;
        teammate.isOnTiles = false;
        teammate.setIsDead(true);
        const elements = Object.values(this.settingsManager.getAbilityAndTileStatusData())
            .map(({ element }) => element)
            .filter((element, index, all) => element && !['water', 'phaseGhost', 'seaGhost', 'flood'].includes(element) && all.indexOf(element) == index);
        const kaiju = this.gameBoardPiecesManager.addPiece({
            pieceClass: GameBoardPieceKaiju,
            pieceInfo: {
                ...PIECES_INFO.kaiju,
                abilities: this.settingsManager.getAbilitiesFromElements(elements),
                spewFireCoolDown: coolDownMs,
                maxLives: kaijuLives,
                moveSpeed: 2,
                isDoAvoidEnemy: false,
                color: teammate.color
            },
            teamIndex: 1
        });
        kaiju.initCharLocation(true, tile);
        kaiju.isTeammateKaiju = true;
        kaiju.castEveryMs = castEveryMs; // one power at a time, often
        this.teammateKaiju = kaiju;
    }

    // the final battle opens on the whole Peninsula, then the giant, then the player
    startFinalBattleIntro() {
        const giant = this.giant;
        const player = this.gameBoardPiecesManager.getPlayerPiece();
        const feet = giant.getFeet();
        const onGiant = { point: { x: feet.x, y: feet.y - giant.getSizePx().height * 0.5 }, zoomScale: PENINSULA.cameraZoom * 0.7, isPeninsulaSized: true, panMs: FINALE.pullMs };
        const onPlayer = { point: { ...player.charLocation }, zoomScale: PENINSULA.cameraZoom, isPeninsulaSized: true, panMs: FINALE.pullMs };
        const lines = this.getSceneSteps('finalBattle.intro', over => over ? onPlayer : onGiant, speaker => speaker == 'agent' ? player : undefined);
        this.startCutscene([
            { shot: { isWide: true }, ms: CUTSCENE.wideMs },
            { shot: onGiant, ms: FINALE.pullMs + 600 },
            ...lines
        ]);
    }

    // the teammate's name in the final battle, where they are the giant (the team's second piece may be a recruit)
    getFinaleTeammateName() {
        const entry = ROSTER.find(({ id }) => id == this.settingsManager.getTeammateAvatar());
        return entry ? entry.name : 'Teammate';
    }

    // the board's piece for the giant stands on the walkable tile nearest its weak spot
    moveGiantPiece() {
        const { center } = this.giant.getPartBox();
        this.giantPiece.standAt(this.gameBoardManager.getClosestWalkableTileToLocation(center));
    }

    // the tiles under a box of the giant, by their middles
    getTilesInBox({ left, top, width, height }) {
        const { grid } = this.level;
        const from = getTileIndexAtLocation(grid, { x: left, y: top });
        const to = getTileIndexAtLocation(grid, { x: left + width, y: top + height });
        if (!from || !to) return [];
        const tiles = [];
        for (let i = Math.min(from.i, to.i) - 1; i <= Math.max(from.i, to.i) + 1; i += 1) {
            for (let j = Math.min(from.j, to.j) - 1; j <= Math.max(from.j, to.j) + 1; j += 1) {
                const tile = this.gameBoardManager.tiles[i] && this.gameBoardManager.tiles[i][j];
                if (!tile) continue;
                const { x, y } = getTileCenter(grid, { i, j });
                if (x >= left && x <= left + width && y >= top && y <= top + height) tiles.push(tile);
            }
        }
        return tiles;
    }

    updateFinalBattle() {
        const giant = this.giant;
        const piece = this.giantPiece;
        if (this.isGiantDraining) return;
        const playerTeam = this.gameBoardPiecesManager.getPlayerTeamIndex();
        const team = this.gameBoardPiecesManager.getTeamPieces(playerTeam).filter(member => !member.isDead && member.isOnTiles);
        const events = giant.step(GAME_TICK.pieceMs, team.map(member => member.charLocation));
        const hurtWithin = (spot, radiusPx) => team.forEach(member => {
            const dx = member.charLocation.x - spot.x;
            const dy = member.charLocation.y - spot.y;
            if (Math.hypot(dx, dy) > radiusPx) return;
            member.lastHitDirs = [Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up')];
            member.lastHitBy = piece.pieceIndex;
            member.decrementHealth(this.accTime, 1);
        });
        events.forEach(event => {
            if (event.type == 'stompWarn') this.giantWarnings.push({ type: 'stomp', spot: event.spot, radiusPx: GIANT_KAIJU.stomp.radiusRows * giant.rowPx, endsAtMs: event.endsAtMs, startMs: giant.ms });
            if (event.type == 'tailWarn') this.giantWarnings.push({ type: 'tail', spot: event.spot, radiusPx: GIANT_KAIJU.tail.radiusRows * giant.rowPx, endsAtMs: event.endsAtMs, startMs: giant.ms });
            if (event.type == 'stomp' || event.type == 'tail') {
                hurtWithin(event.spot, event.radiusPx);
                this.stompShakeUntil = this.accTime + GIANT_SHAKE_MS;
                this.setPhase(GIANT_STOMP_PHASE, true);
            }
            if (event.type == 'breath') {
                // Kaiju Fire, from its head, at the closest of the team
                const weakTile = piece.getTileIndex();
                piece.setTileIndex(this.gameBoardManager.getClosestWalkableTileToLocation(giant.getHead()));
                this.gameBoardManager.updateTileWithAbilityStatus({ accTime: this.accTime, pieceIndex: piece.pieceIndex, appliedStatus: 'isOnKaijuFire' });
                piece.setTileIndex(weakTile);
            }
        });
        this.giantWarnings = this.giantWarnings.filter(({ endsAtMs }) => endsAtMs > giant.ms);
        if (this.stompShakeUntil && this.accTime >= this.stompShakeUntil) {
            this.stompShakeUntil = 0;
            this.setPhase(GIANT_STOMP_PHASE, false);
        }

        // the team's powers on the tiles under the weak spot drain it, and stagger its march
        const isHit = this.getTilesInBox(giant.getPartBox()).some(tile => {
            const status = tile.getTileStatus();
            return !!status && status.getDmgAmt() > 0 && tile.teamIndex == playerTeam;
        });
        if (isHit && piece.getIsDamageable(this.accTime)) {
            piece.decrementHealth(this.accTime, 1);
            if (!this.isGiantDraining) {
                giant.hit();
                this.giantHitAtMs = giant.ms;
            }
        }
        // the Kaiju come to protect it, a wave as each share of its power goes
        giant.takeWaves(piece.lives / piece.maxLives).forEach(({ count }) => {
            for (let k = 0; k < count; k += 1) this.kaijuManager.addKaijuPiece(this.accTime);
            // the teammate's voice, from inside it, as each wave comes (to the log: the fight goes on)
            const text = this.giantVoices && this.giantVoices[`wave${giant.wavesSent}`];
            if (text) this.addTalk([{ name: this.getFinaleTeammateName(), text, avatar: this.settingsManager.getTeammateAvatar() }]);
        });
        this.moveGiantPiece();
    }

    // drained: the ray gun pulls out the last of its power, and it is the teammate again
    onGiantDrained() {
        if (this.isGiantDraining) return true;
        this.isGiantDraining = true;
        const giant = this.giant;
        const player = this.gameBoardPiecesManager.getPlayerPiece();
        const feet = giant.getFeet();
        const { height } = giant.getSizePx();
        const bodyMiddle = { x: feet.x, y: feet.y - height * 0.5 };
        const rowPx = giant.rowPx;
        const between = { x: (player.charLocation.x + bodyMiddle.x) / 2, y: (player.charLocation.y + bodyMiddle.y) / 2 };
        const wideShot = { point: between, zoomScale: PENINSULA.cameraZoom * FINALE.rayZoomShare, isPeninsulaSized: true, panMs: FINALE.pullMs };
        const onTeammate = { point: { x: feet.x, y: feet.y - rowPx }, zoomScale: PENINSULA.cameraZoom * CUTSCENE.outcomeZoomScale, isPeninsulaSized: true, panMs: FINALE.pullMs };
        this.giantWarnings = [];
        const [rayLine] = getSpokenLines('finalBattle.ray');
        const reunion = getSpokenLines('finalBattle.reunion');
        this.startCutscene([
            { shot: wideShot, ms: FINALE.pullMs, speech: rayLine ? this.getSpeechOver(player, this.getLineSpeaker('player').name, rayLine.text) : undefined },
            { shot: wideShot, ms: FINALE.rayMs, onStart: () => {
                this.rayBeam = { from: { x: player.charLocation.x, y: player.charLocation.y - rowPx }, color: FINALE.rayColor, targets: [bodyMiddle] };
                this.giantShrinkAtMs = performance.now();
            } },
            { shot: onTeammate, ms: FINALE.teammateMs, onStart: () => {
                this.rayBeam = undefined; // (not endRay: that takes the team's powers)
                this.restoreTeammate(feet);
            } },
            // their words, each over its speaker: the teammate is standing again by now
            ...reunion.map(({ speaker, text }) => ({ shot: onTeammate, ms: getSpeechMs(text), speech: () => {
                const isTeammate = speaker == 'teammate';
                return this.getSpeechOver(isTeammate ? this.restoredTeammate : player, isTeammate ? this.getFinaleTeammateName() : this.getLineSpeaker('player').name, text);
            } })),
            { shot: onTeammate, ms: 0, onStart: () => { this.isFinaleWon = true; } }
        ]);
        return true;
    }

    // the giant is gone, and the teammate is lying where it stood
    restoreTeammate(feet) {
        const piece = this.giantPiece;
        piece.isOnTiles = false;
        piece.setIsDead(true); // not a kill: it is the teammate
        this.giantIsGone = true;
        const avatar = this.settingsManager.getTeammateAvatar();
        const teammate = this.gameBoardPiecesManager.addPiece({ pieceInfo: { ...PIECES_INFO[avatar], abilities: [], color: this.giantColor }, teamIndex: this.gameBoardPiecesManager.getPlayerTeamIndex() });
        teammate.initCharLocation(true, this.gameBoardManager.getClosestWalkableTileToLocation(feet));
        teammate.facingDir = 'down';
        this.restoredTeammate = teammate;
    }

    // dev: drain it, to see the end
    devDrainGiant = () => {
        if (!this.giantPiece || this.cutscene || this.isGiantDraining) return;
        this.giantPiece.lives = 1;
        this.giantPiece.lastDmgAccTime = 0;
        this.giantPiece.decrementHealth(this.accTime, 1);
    };

    // - - - the Aquarium (AquariumFlood.ts) - - -

    // the first time she is brought to zero, she screams and the glass shatters. the second time, she is down.
    onMermaidDown() {
        if (this.isShattered) return false;
        this.isShattered = true;
        this.isShatterPending = true;
        const rival = this.rivalPiece;
        rival.lives = 1;
        rival.isUnhurtable = true;
        return true;
    }

    // while the tanks pour, she keeps to the top floor: above the hall, less the middle stairs (they only reach the links)
    getIsTopFloor = tile => {
        const { maxY, stairs } = this.level.aquariumFlood.topFloor;
        const { x, y } = this.gameBoardManager.getCharXAndYFromTileIndex(tile);
        return y < maxY && !(x > stairs.minX && x < stairs.maxX && y > stairs.minY);
    };

    // the floor the water covers
    getIsFloodTile = tile => this.gameBoardManager.getCharXAndYFromTileIndex(tile).y >= this.level.flood.top;

    /*
        "Stop!!!": the battle holds. Still holding, the camera goes to each panel of glass in turn: it breaks, its water
        pours out, and now and then a sea creature with it. Back on her: a portal, she is up on the walkway, it closes,
        and she calls to her creatures. In the steps marked 'isLive', the water and the creatures move (no one is hurt).
    */
    startShatter() {
        this.isShatterPending = false;
        const rival = this.rivalPiece;
        const rowPx = this.getGhostRowPx();
        const { panels, topSpot, screamScene, creaturesScene } = this.level.aquariumFlood;
        const scream = getDialogueLine(screamScene);
        const toCreatures = getDialogueLine(creaturesScene);
        const extreme = { zoomScale: PENINSULA.cameraZoom * CUTSCENE.outcomeZoomScale, isPeninsulaSized: true };
        // after the team's teleport, the rest is a step back from the extreme zoom (Jamie)
        const nearer = { zoomScale: PENINSULA.cameraZoom * SHATTER_SCREAM.restZoomShare, isPeninsulaSized: true };
        const onHer = (zoom = nearer) => ({ point: { x: rival.charLocation.x, y: rival.charLocation.y - CUTSCENE.shotHeadRows * rowPx * 0.5 }, ...zoom, panMs: SHATTER_SCREAM.panMs });
        const herShot = onHer(extreme);
        const herAfter = onHer();
        const { recruits } = this.getGhostTeam();
        const backOnHer = onHer();
        const topShot = {}; // on her up on the walkway: filled in once she is there
        const topTile = this.gameBoardManager.getClosestWalkableTileToLocation(topSpot);
        this.startAquariumFlood();
        const panelSteps = panels.flatMap((panel, k) => {
            const shot = { point: panel.focus, ...nearer, panMs: SHATTER_SCREAM.panelPanMs };
            return [
                { shot, ms: SHATTER_SCREAM.panelPanMs, isLive: true },
                { shot, ms: SHATTER_SCREAM.panelMs, isLive: true, phase: panel.phase, onStart: () => this.breakPanel(panel, k % SHATTER_SCREAM.creatureEvery == 0) }
            ];
        });
        this.startCutscene([
            { shot: herShot, ms: CUTSCENE.outcomePullMs },
            { shot: herShot, ms: getSpeechMs(scream.text) + SHATTER_SCREAM.screamMs, speech: { ...this.getSpeechOver(rival, scream.name, scream.text, { isAboveHead: true }), isShout: true } },
            // the scream pulls the team to the bottom of the hall, below the tank, as the Rooftop's does
            ...this.getTeamTeleportSteps(this.level.aquariumFlood.teamSpot, team => this.placeTeam(team, recruits, this.level.aquariumFlood.teamSpot)),
            // then (Jamie): the camera on her; her portal up to the top floor; her words up there; and only then the glass
            { shot: herAfter, ms: SHATTER_SCREAM.panMs + SHATTER_SCREAM.onHerMs },
            { shot: backOnHer, ms: SHATTER_SCREAM.portalMs, isLive: true, onStart: () => this.gameBoardManager.addWormhole(rival.getTileIndex(), topTile, this.accTime, Infinity) },
            { shot: topShot, ms: SHATTER_SCREAM.portalMs, isLive: true, onStart: () => {
                rival.stopMoving();
                rival.initCharLocation(true, topTile);
                rival.isTeleported = !rival.isTeleported;
                rival.allowedTile = this.getIsTopFloor;
                Object.assign(topShot, onHer());
            } },
            { shot: topShot, ms: SHATTER_SCREAM.portalMs, isLive: true, onStart: () => this.gameBoardManager.closeWormholes() },
            // she looks down at the hall as she calls to them (Jamie)
            { shot: topShot, ms: getSpeechMs(toCreatures.text), isLive: true, speech: () => ({ ...this.getSpeechOver(rival, toCreatures.name, toCreatures.text, { isAboveHead: true }), isShout: true }), onStart: () => { rival.stopMoving(); rival.facingDir = 'down'; rival.dir = 'idle'; } },
            ...panelSteps,
            // the whole hall darkens, and the camera is back on her, up top
            { shot: topShot, ms: SHATTER_SCREAM.panMs, isLive: true, phase: this.level.flood.phase },
            { shot: topShot, ms: 0, onStart: () => { this.nextMermaidHealAt = this.accTime + AQUARIUM_FLOOD.healEveryMs; } }
        ], { isMidFight: true });
    }

    // a panel breaks: its water pours from here on, and maybe a sea creature comes out with it
    breakPanel(panel, isCreature) {
        const flood = this.aquariumFlood;
        if (!flood) return;
        const source = this.getClosestFloodTile(panel.pour);
        if (!source) return;
        flood.sources.push(source);
        // a gush out of it, running off the glass, its edges curling back in (Jamie)
        const from = panel.focus;
        const to = this.gameBoardManager.getCharXAndYFromTileIndex(source);
        const length = Math.hypot(to.x - from.x, to.y - from.y) || 1;
        flood.burst(source, { x: (to.x - from.x) / length, y: (to.y - from.y) / length });
        if (isCreature) {
            const icons = Object.keys(AQUARIUM_FLOOD.ghostIcons);
            const icon = icons[Math.floor(Math.random() * icons.length)];
            this.spawnSeaGhost({ source, icon, color: AQUARIUM_FLOOD.ghostIcons[icon] });
        }
    }

    getClosestFloodTile(spot) {
        const board = this.gameBoardManager;
        return board.walkableTiles.filter(this.getIsFloodTile).reduce((closest, tile) => {
            const a = board.getCharXAndYFromTileIndex(tile);
            const b = closest && board.getCharXAndYFromTileIndex(closest);
            return !closest || Math.hypot(a.x - spot.x, a.y - spot.y) < Math.hypot(b.x - spot.x, b.y - spot.y) ? tile : closest;
        }, undefined);
    }

    // in a cutscene that lets the board move ('isLive'): the water pours and the creatures swim, and no one is hurt
    getIsLiveCutscene() {
        const step = this.cutscene && this.cutscene.steps[this.cutscene.index];
        return !!step && !!step.isLive;
    }

    startAquariumFlood() {
        const rival = this.rivalPiece;
        const board = this.gameBoardManager;
        rival.walkToTile = undefined;
        this.nextMermaidHealAt = Infinity; // she heals once she is up on the walkway
        const { grid } = this.level;
        // the floor's lowest tiles, where the water drains away
        const bottomY = Math.max(...board.walkableTiles.filter(this.getIsFloodTile).map(tile => board.getCharXAndYFromTileIndex(tile).y));
        this.aquariumFlood = new AquariumFlood({
            sources: [], // each panel pours once it breaks (breakPanel)
            rowPx: grid.rowStep * grid.scale,
            bottomY,
            board: {
                getSpot: board.getCharXAndYFromTileIndex,
                getNeighbors: tile => board.getAdjacentTileIndices(tile),
                getIsWaterTile: this.getIsFloodTile,
                // any power but the flood's own water, and the sea creatures that swim in it
                getIsPowerOnTile: ({ i, j }) => {
                    const tile = board.tiles[i] && board.tiles[i][j];
                    const status = tile && tile.getTileStatus();
                    return !!status && !['isFlood', 'isSeaGhost'].includes(status.getAppliedStatus());
                },
                getTileAt: spot => getTileIndexAtLocation(grid, { x: spot.x - grid.charOffsetX * grid.scale, y: spot.y - grid.charOffsetY * grid.scale })
            }
        });
    }

    updateAquariumFlood() {
        const flood = this.aquariumFlood;
        const rival = this.rivalPiece;
        const team = this.gameBoardPiecesManager.getTeamPieces(this.gameBoardPiecesManager.getPlayerTeamIndex()).filter(piece => !piece.isDead && piece.isOnTiles);
        this.stepFloodWater();
        // wading: a step slower for each touch of the water, up to three, each wearing off after a second
        const { stackMs, everyMs, maxStacks } = AQUARIUM_FLOOD.slow;
        team.forEach(piece => {
            if (!flood.getIsWet(piece.getTileIndex()) || (piece.nextWaterSlowAt || 0) > this.accTime) return;
            piece.nextWaterSlowAt = this.accTime + everyMs;
            piece.waterSlowEnds = [...piece.waterSlowEnds.filter(endsAt => endsAt > this.accTime), this.accTime + stackMs].slice(-maxStacks);
        });
        // up there, she heals herself until she is whole: then she can be hurt again
        if (rival.isUnhurtable && !rival.isDead && this.accTime >= this.nextMermaidHealAt) {
            this.nextMermaidHealAt = this.accTime + AQUARIUM_FLOOD.healEveryMs;
            this.gameBoardManager.updateTileWithAbilityStatus({ accTime: this.accTime, pieceIndex: rival.pieceIndex, appliedStatus: 'isHealing' });
            rival.lives = Math.min(rival.lives + 1, rival.maxLives);
            rival.isHealed = !rival.isHealed;
            if (rival.lives >= rival.maxLives) rival.isUnhurtable = false;
        }
        // the water is gone: she comes back down to the hall
        if (flood.getIsOver()) {
            this.aquariumFlood = undefined;
            this.syncFloodStatuses();
            rival.allowedTile = undefined;
            rival.isUnhurtable = false;
            if (!rival.isDead) rival.walkToTile = this.gameBoardManager.getClosestWalkableTileToLocation(this.level.aquariumFlood.groundSpot);
        }
    }

    // the water pours and flows, and the creatures come out of the tanks
    stepFloodWater() {
        const spawns = this.aquariumFlood.step(GAME_TICK.pieceMs);
        this.syncFloodStatuses();
        spawns.forEach(spawn => this.spawnSeaGhost(spawn));
    }

    // a sea creature out of a broken tank: Haunt's ghost on the tiles, after the closest of the team
    spawnSeaGhost({ source, icon, color }) {
        const rival = this.rivalPiece;
        const board = this.gameBoardManager;
        const team = this.gameBoardPiecesManager.getTeamPieces(this.gameBoardPiecesManager.getPlayerTeamIndex()).filter(piece => !piece.isDead && piece.isOnTiles);
        const getSteps = piece => board.getPathFromTileToTile({ fromTile: source, toTile: piece.getTileIndex() }).length;
        const target = team.reduce((closest, piece) => !closest || getSteps(piece) < getSteps(closest) ? piece : closest, undefined);
        if (!target) return;
        const { isSeaGhost } = this.settingsManager.getAbilityAndTileStatusData();
        const [, dirs] = board.getNumAdjacentTilesInDirectionFromTileToTile({ fromTileIndex: source, toTileIndex: target.getTileIndex() });
        const tile = board.tiles[source.i][source.j];
        if (!tile.getCanApplyStatus(isSeaGhost)) return;
        tile.updateTileStatus({
            updateKey: this.accTime, tileStatus: isSeaGhost, currCount: isSeaGhost.range, dirs: dirs.length ? [dirs[0]] : ['up'],
            teamIndex: rival.teamIndex, targetIndex: target.pieceIndex,
            cast: { ...NO_CAST, casterIndex: rival.pieceIndex, seaIcon: icon, seaColor: color }
        });
    }

    // the flood's water, onto the board as the lowest status of all: where a tile has anything else, the water isn't put there
    syncFloodStatuses() {
        const board = this.gameBoardManager;
        const { isFlood } = this.settingsManager.getAbilityAndTileStatusData();
        const wet = new Set(this.aquariumFlood ? this.aquariumFlood.getWaterTiles().map(({ i, j }) => `${i} ${j}`) : []);
        (this.floodTileKeys || []).forEach(key => {
            if (wet.has(key)) return;
            const [i, j] = key.split(' ').map(Number);
            const tile = board.tiles[i][j];
            const status = tile.getTileStatus();
            if (status && status.getAppliedStatus() == 'isFlood') tile.clearTileStatus();
        });
        // the way the water runs, as one of the six tile directions: its drop points that way (Jamie)
        const steps = new Map((this.aquariumFlood ? this.aquariumFlood.getWaterFlows() : []).map(({ tile, step }) => [`${tile.i} ${tile.j}`, step]));
        const getDirOf = step => {
            if (!step) return undefined;
            const length = Math.hypot(step.x, step.y) || 1;
            const best = TILE_DIR_NORM_VECS.reduce((bestK, vec, k) => vec.x * step.x + vec.y * step.y > TILE_DIR_NORM_VECS[bestK].x * step.x + TILE_DIR_NORM_VECS[bestK].y * step.y ? k : bestK, 0);
            return length > 0 ? TILE_DIRS[best] : undefined;
        };
        wet.forEach(key => {
            const [i, j] = key.split(' ').map(Number);
            const tile = board.tiles[i][j];
            const dir = getDirOf(steps.get(key));
            if (!tile.getTileStatus()) tile.updateTileStatus({ updateKey: this.accTime, tileStatus: isFlood, currCount: 1, dirs: dir ? [dir] : [], teamIndex: -1, targetIndex: -1 });
            else if (dir && tile.getTileStatus().getAppliedStatus() == 'isFlood') tile.dirs = [dir];
        });
        this.floodTileKeys = [...wet];
    }

    // - - - the ghost boss (GhostBoss.ts) - - -

    // brought to zero, she doesn't die: she screams, and a ring of ghosts comes. after the last ring, she is a ghost, and the next blow kills her.
    onGhostBossDown() {
        if (this.isGhostScreaming) return true;
        if (this.ghostBossDowns >= GHOST_BOSS.rings.length) return false;
        this.ghostBossDowns += 1;
        this.isGhostScreaming = true;
        this.isGhostScreamPending = true; // it starts on the next tick, once the blow is done
        return true;
    }

    getGhostRowPx() {
        const { rowStep, scale } = this.level.grid;
        return rowStep * scale;
    }

    // her own roof, after the first scream: the left building, less the crane beam
    getIsRivalGround = tileIndex => {
        const { maxI, beamFromI, beamFromJ } = this.level.ghostBoss.rivalGround;
        return tileIndex.i <= maxI && !(tileIndex.i >= beamFromI && tileIndex.j >= beamFromJ);
    };

    // the player, the teammate (not recruits called in) and any recruits, still standing
    getGhostTeam() {
        const team = this.gameBoardPiecesManager.getTeamPieces(this.gameBoardPiecesManager.getPlayerTeamIndex()).filter(piece => !piece.isDead);
        const player = this.gameBoardPiecesManager.getPlayerPiece();
        const teammate = team.find(piece => piece != player && !piece.isRecruit);
        return { player, teammate, recruits: team.filter(piece => piece.isRecruit) };
    }

    // the scream: her words, the scream, the camera on the team (side by side if they are apart), a red flash,
    // and they are on the graveyard roof, standing together. then the camera pulls out as the ghosts fade in around them.
    // the keys are off only for this.
    startGhostScream() {
        this.isGhostScreamPending = false;
        this.isGhostPhase = true; // until the ring is spent
        const rival = this.rivalPiece;
        const { player, teammate, recruits } = this.getGhostTeam();
        const rowPx = this.getGhostRowPx();
        const count = GHOST_BOSS.rings[this.ghostBossDowns - 1];
        const isLast = this.ghostBossDowns == GHOST_BOSS.rings.length;
        const { name, text } = getDialogueLine(this.level.ghostBoss.screamScene, this.ghostBossDowns - 1); // a line for each phase (Jamie)
        const extreme = { zoomScale: PENINSULA.cameraZoom * CUTSCENE.outcomeZoomScale, isPeninsulaSized: true };
        const headOf = piece => ({ x: piece.charLocation.x, y: piece.charLocation.y - CUTSCENE.shotHeadRows * rowPx * 0.5 });
        const onHer = { point: headOf(rival), ...extreme, panMs: CUTSCENE.outcomePullMs };
        // the ring goes round the whole roof: the camera pulls out to all of it
        const ringShot = { isWide: true, panMs: GHOST_SCREAM.toRingMs };
        this.startCutscene([
            { shot: onHer, ms: CUTSCENE.outcomePullMs },
            { shot: onHer, ms: getSpeechMs(text) + GHOST_SCREAM.screamMs, speech: { ...this.getSpeechOver(rival, name, text), isShout: true } },
            ...this.getTeamTeleportSteps(this.level.ghostBoss.ringSpot, team => this.ghostTeleport(team, recruits, isLast)),
            { shot: ringShot, ms: Math.max(GHOST_SCREAM.toRingMs, GHOST_BOSS.fadeInMs), onStart: () => this.startGhostRing(count, teammate) },
            { shot: ringShot, ms: 0, onStart: () => { this.isGhostScreaming = false; } }
        ], { isMidFight: true });
    }

    /*
        The bosses' scream pulls the team somewhere (the Rooftop, the Aquarium): in close on the two of them (side by side
        if they are apart), a red flash, and they are standing together at 'spot', at the same zoom, so it looks as if the
        level changed under them. 'onTeleport(team)' moves everyone. Returns the steps, to put in the boss's cutscene.
    */
    getTeamTeleportSteps(spot, onTeleport) {
        const { player, teammate } = this.getGhostTeam();
        const rowPx = this.getGhostRowPx();
        const extreme = { zoomScale: PENINSULA.cameraZoom * CUTSCENE.outcomeZoomScale, isPeninsulaSized: true };
        const headOf = piece => ({ x: piece.charLocation.x, y: piece.charLocation.y - CUTSCENE.shotHeadRows * rowPx * 0.5 });
        // the two of them, left to right. 'pair': in one shot if they fit at this zoom, side by side if not (GameBoard)
        const team = teammate ? [player, teammate].sort((a, b) => a.charLocation.x - b.charLocation.x) : [player];
        const teamShot = team.length > 1 ? { pair: team.map(headOf), ...extreme, panMs: GHOST_SCREAM.toTeamMs } : { point: headOf(player), ...extreme, panMs: GHOST_SCREAM.toTeamMs };
        const together = { shot: { ...teamShot, isCut: true }, ms: GHOST_SCREAM.togetherMs };
        const merged = { shot: { point: headOf(player), ...extreme, isCut: true }, ms: GHOST_SCREAM.mergedMs };
        return [
            { shot: teamShot, ms: GHOST_SCREAM.toTeamMs + GHOST_SCREAM.onTeamMs },
            { shot: teamShot, ms: GHOST_SCREAM.flashInMs, onStart: () => { this.ghostFlashCount += 1; } },
            Object.assign(together, { onStart: () => {
                onTeleport(team);
                // the same shot as before, now on the two of them side by side: the halves meet in the middle
                const heads = team.map(headOf);
                together.shot = heads.length > 1 ? { pair: heads, isSeam: true, ...extreme, isCut: true } : { point: heads[0], ...extreme, isCut: true };
                const middle = { x: (heads[0].x + heads[heads.length - 1].x) / 2, y: heads[0].y };
                merged.shot = { point: middle, ...extreme, isCut: true };
            } }),
            merged
        ];
    }

    // no portals: the powers in play are gone with the flash, and the team stands together at 'spot' (recruits a row below)
    placeTeam(team, recruits, spot) {
        const { colStep, scale } = this.level.grid;
        const board = this.gameBoardManager;
        board.getTilesInFlatArray().forEach(tile => tile.clearTileStatus());
        board.closeWormholes();
        const besideCols = team.length > 1 ? GHOST_SCREAM.besideCols : 0;
        const taken = new Set();
        const place = (piece, at) => {
            let tile = board.getClosestWalkableTileToLocation(at);
            if (taken.has(`${tile.i} ${tile.j}`)) tile = board.getAdjacentTileIndices(tile).filter(board.getIsInBounds).find(next => !taken.has(`${next.i} ${next.j}`)) || tile;
            taken.add(`${tile.i} ${tile.j}`);
            piece.initCharLocation(true, tile);
            piece.stopMoving();
            piece.shouldTeleport = false;
        };
        team.forEach((piece, k) => place(piece, { x: spot.x + (k == 0 ? -1 : 1) * besideCols * colStep * scale, y: spot.y }));
        recruits.forEach((piece, k) => place(piece, { x: spot.x + (k - (recruits.length - 1) / 2) * colStep * scale * 2, y: spot.y + this.getGhostRowPx() }));
        return place;
    }

    // the Rooftop's teleport: the team onto the graveyard roof, and she is back on her own roof
    ghostTeleport(team, recruits, isLast) {
        const rival = this.rivalPiece;
        const { ringSpot, rivalSpot } = this.level.ghostBoss;
        const place = this.placeTeam(team, recruits, ringSpot);
        this.endGhostRing();

        // she is back on her own roof, whole again, and stays there while the ghosts fly (endGhostRing lets her roam again)
        rival.respawn(this.accTime);
        rival.allowedTile = this.getIsRivalGround;
        place(rival, rivalSpot);
        rival.isGhostForm = isLast;
        if (isLast) rival.lives = GHOST_BOSS.ghostLives;
    }

    startGhostRing(count, teammate) {
        const ring = new GhostRing({ center: this.level.ghostBoss.ringCenter, count, rowPx: this.getGhostRowPx(), radiusRows: GHOST_BOSS.ringRadiusRows });
        this.ghostRing = ring;
        // the teammate stays in the ring until it is spent, whatever the player does
        if (teammate) teammate.allowedTile = tile => ring.getIsWellInside(this.gameBoardManager.getCharXAndYFromTileIndex(tile));
        this.ghostRingTeammate = teammate;
    }

    updateGhostRing() {
        const ring = this.ghostRing;
        const team = this.gameBoardPiecesManager.getTeamPieces(this.gameBoardPiecesManager.getPlayerTeamIndex()).filter(piece => !piece.isDead && piece.isOnTiles);
        const hits = ring.step(GAME_TICK.pieceMs, team.map(piece => ({ key: piece.pieceIndex, spot: piece.charLocation })), this.getIsDispelledByTeam);
        hits.forEach(({ key, dirs }) => {
            const piece = this.gameBoardPiecesManager.getPiece(key);
            piece.lastHitDirs = dirs;
            piece.lastHitBy = this.rivalPiece.pieceIndex;
            piece.decrementHealth(this.accTime, 1);
        });
        if (ring.getIsSpent()) {
            this.isGhostPhase = false;
            this.endGhostRing();
        }
        else this.syncPhaseGhostTiles();
    }

    /*
        The ring's ghosts are tile statuses: each is on the tile under it, even where there is no tile to walk on
        (over the sea, down the building's face). Such a tile shows only while a ghost is on it, and nothing else can use it.
        On a tile of the board, a ghost has Haunt's rank: a stronger power there keeps it off.
    */
    syncPhaseGhostTiles() {
        const ring = this.ghostRing;
        const board = this.gameBoardManager;
        const { grid } = this.level;
        const phaseGhost = this.settingsManager.getAbilityAndTileStatusData().isPhaseGhost;
        this.clearPhaseGhostStatuses();
        if (!ring) return;
        const shaking = ring.getShakingGhost();
        const fade = ring.getFade();
        this.phaseGhostTiles = ring.getLiveGhosts().map(ghost => {
            const tileIndex = getTileIndexAtLocation(grid, { x: ghost.x - grid.charOffsetX * grid.scale, y: ghost.y - grid.charOffsetY * grid.scale });
            if (!tileIndex) return undefined;
            const tile = board.tiles[tileIndex.i] && board.tiles[tileIndex.i][tileIndex.j];
            if (!tile) return undefined;
            if (tile.getIsVisible()) {
                if (!tile.getCanApplyStatus(phaseGhost)) return undefined; // a stronger power holds the tile
                tile.updateTileStatus({ updateKey: this.accTime, tileStatus: phaseGhost, currCount: 1, dirs: [], teamIndex: this.rivalPiece.teamIndex, targetIndex: -1 });
            }
            // turned the way it goes, as Haunt's ghost is (down is 0 degrees, as the tiles' own icons; then the same half turn)
            const dx = ghost.state == 'launched' ? ghost.vx : ghost.x - ghost.lastX;
            const dy = ghost.state == 'launched' ? ghost.vy : ghost.y - ghost.lastY;
            const rotation = dx || dy ? -Math.atan2(dx, dy) * 180 / Math.PI + 180 : 0;
            return { tileIndex, isOffBoard: !tile.getIsVisible(), isShaking: !!shaking && shaking.id == ghost.id, fade, rotation };
        }).filter(Boolean);
    }

    clearPhaseGhostStatuses() {
        const board = this.gameBoardManager;
        this.phaseGhostTiles.forEach(({ tileIndex: { i, j } }) => {
            const tile = board.tiles[i] && board.tiles[i][j];
            const status = tile && tile.getTileStatus();
            if (status && status.getAppliedStatus() == 'isPhaseGhost') tile.clearTileStatus();
        });
        this.phaseGhostTiles = [];
    }

    getPhaseGhostTiles = () => this.phaseGhostTiles;

    endGhostRing() {
        this.clearPhaseGhostStatuses();
        this.ghostRing = undefined;
        // the ghosts gone, she roams the whole battlefield again (Jamie): her own roof was only while they flew
        const rival = this.rivalPiece;
        if (rival && rival.allowedTile == this.getIsRivalGround) rival.allowedTile = undefined;
        if (this.ghostRingTeammate) this.ghostRingTeammate.allowedTile = undefined;
        this.ghostRingTeammate = undefined;
    }

    // over the team's Dispel: only the players' Bubble counts
    /*
        The Rooftop without the player's Dispel (Jamie): the fight can't be won without one. Then the teammate brings it
        (Dispel, Heal, Discharge), keeps with the player rather than going after her, and attacks only what comes in range.
        The first time their Dispel stops one of her ghosts, they say so.
    */
    setUpGhostGuardian() {
        const { player, teammate } = this.getGhostTeam();
        if (!player || !teammate || this.followers.includes(teammate)) return;
        const hasDispel = player.abilities.some(ability => ability.gameBoardPieceAbilityData.element == 'bubble');
        if (hasDispel) return;
        teammate.abilities = this.settingsManager.getAbilitiesFromElements(GHOST_BOSS.guardianKit);
        teammate.isGuardian = true;
        this.ghostGuardian = teammate;
    }

    // a ghost on a tile of the team's Dispel. the guardian's first: their line (once)
    getIsDispelledByTeam = spot => {
        if (!this.getIsDispelledAt(spot)) return false;
        const guardian = this.ghostGuardian;
        if (guardian && !guardian.isDead && !this.hasGuardianSpoken && this.getDispelCasterAt(spot) == guardian.pieceIndex) {
            this.hasGuardianSpoken = true;
            const { text } = getDialogueLine('rooftop.guardian');
            this.speech = this.fillSpeech({ ...this.getSpeechOver(guardian, this.getTeammateName(), text), isShout: true });
            this.timeoutHandler.registerTimeout(() => { if (this.speech && this.speech.text == text) this.speech = null; }, getSpeechMs(text));
        }
        return true;
    };

    getDispelCasterAt = spot => {
        const { grid } = this.level;
        const { i, j } = getTileIndexAtLocation(grid, { x: spot.x - grid.charOffsetX * grid.scale, y: spot.y - grid.charOffsetY * grid.scale }) || {};
        const tile = this.gameBoardManager.tiles[i] && this.gameBoardManager.tiles[i][j];
        return tile && tile.cast ? tile.cast.casterIndex : undefined;
    };

    getIsDispelledAt = spot => {
        const { grid } = this.level;
        const { i, j } = getTileIndexAtLocation(grid, { x: spot.x - grid.charOffsetX * grid.scale, y: spot.y - grid.charOffsetY * grid.scale }) || {};
        const tile = this.gameBoardManager.tiles[i] && this.gameBoardManager.tiles[i][j];
        const status = tile && tile.getTileStatus();
        return !!status && status.getAppliedStatus() == 'isBubble' && tile.teamIndex == this.gameBoardPiecesManager.getPlayerTeamIndex();
    };

    // the teammate in the ring: stays well inside it, and steps away from the ghost about to launch, or flying in
    getGhostRingMove = piece => {
        const ring = this.ghostRing;
        if (!ring || this.cutscene || piece != this.ghostRingTeammate || piece.isDead) return undefined;
        const board = this.gameBoardManager;
        const here = piece.getTileIndex();
        const getSpot = tile => board.getCharXAndYFromTileIndex(tile);
        const getFromMiddle = tile => Math.hypot(getSpot(tile).x - ring.center.x, getSpot(tile).y - ring.center.y);
        const near = board.getAdjacentTileIndices(here).filter(board.getIsInBounds);
        if (!ring.getIsWellInside(getSpot(here))) {
            // outside the safe middle: back toward it
            const best = near.reduce((closest, tile) => getFromMiddle(tile) < getFromMiddle(closest) ? tile : closest, here);
            return best != here ? [best] : [];
        }
        const threats = ring.getThreats();
        if (!threats.length) return [];
        const getSafety = tile => Math.min(...threats.map(threat => Math.hypot(getSpot(tile).x - threat.x, getSpot(tile).y - threat.y)));
        const best = near.filter(tile => ring.getIsWellInside(getSpot(tile))).reduce((safest, tile) => getSafety(tile) > getSafety(safest) + 1 ? tile : safest, here);
        return best != here ? [best] : [];
    };

    // dev: bring her straight to zero, to try the next phase
    devDownRival = () => {
        const rival = this.rivalPiece;
        if (!rival || rival.isDead || this.cutscene) return;
        rival.lastDmgAccTime = 0;
        rival.isUnhurtable = false; // dev: even while she heals upstairs
        rival.decrementHealth(this.accTime, rival.lives + rival.livesModifier);
    };

    // once a fight's opening is over: every recruit in at once (Jamie), but not the one this fight is against
    // 'isOpening': called as the level is set up, before its opening scene (they stand there through it)
    autoSummonRecruits(isOpening = false) {
        if (this.level.isTraining) return; // one on one
        if (this.hasAutoSummoned || !this.autoRecruits.length || (this.cutscene && !isOpening) || this.level.isWalkingLevel || this.level.hasRecruitFollowers) return;
        if (!isOpening && this.getGameResult() !== null) return;
        this.hasAutoSummoned = true;
        const onBoard = new Set(this.getPieces().filter(piece => piece.isRecruit && !piece.isDead).map(({ avatar }) => avatar));
        const rivalAvatar = this.level.rival && this.level.rival.avatar;
        this.autoRecruits.filter(avatar => avatar != rivalAvatar && !onBoard.has(avatar)).forEach(avatar => this.callRecruit(avatar, isOpening));
    }

    // a recruit's powers: the ones they had as a rival; the Hazmat Worker's own (Heal, Ice Slice, Dispel: Jamie)
    getRecruitAbilityElements(avatar) {
        if (avatar == 'hazmat') return HAZMAT_RECRUIT.abilities;
        const rivalLevel = Object.values(LEVELS).find(({ rival }) => rival && rival.avatar == avatar);
        return rivalLevel ? rivalLevel.rival.abilities : undefined;
    }

    // the recruits who have lines in scenes: not the Hazmat Worker, who never speaks (Jamie)
    getSpeakingFollowers() {
        return this.followers.filter(piece => piece.avatar != 'hazmat');
    }

    // a recruit called in to help: they fight beside the team with the powers they had as a rival
    callRecruit = (avatar, isOpening = false) => {
        if (!isOpening && (this.isPaused || this.cutscene || this.recruitScene || this.getGameResult() !== null)) return false;
        const elements = this.getRecruitAbilityElements(avatar);
        if (!elements) return false;
        const piece = this.gameBoardPiecesManager.addRecruit(avatar, this.settingsManager.getAbilitiesFromElements(elements));
        if (avatar == 'hazmat') piece.color = HAZMAT_RECRUIT.color;
        const player = this.gameBoardPiecesManager.getPlayerPiece();
        // beside the player, on a tile no one else is on (several come in at once).
        // the Hazmat Worker: on the right of the group (Jamie, playtest 18)
        const tile = this.getFreeTileNear(player.getTileIndex(), { except: piece, isRightmost: avatar == 'hazmat' });
        piece.initCharLocation(true, tile || player.getTileIndex());
        return true;
    }

    // a free tile beside 'tile' (or one further out, if those are all taken). 'isRightmost': the one furthest right, near its row
    getFreeTileNear(tile, { except = undefined, isRightmost = false } = {}) {
        const board = this.gameBoardManager;
        const key = ({ i, j }) => `${i} ${j}`;
        const taken = new Set(this.getPieces().filter(other => other != except && !other.isDead && other.isOnTiles && other.getTileIndex()).map(other => key(other.getTileIndex())));
        taken.add(key(tile));
        const near = board.getAdjacentTileIndices(tile).filter(board.getIsInBounds);
        const far = near.flatMap(next => board.getAdjacentTileIndices(next).filter(board.getIsInBounds));
        const seen = new Set();
        const rings = [near, far].map(ring => ring.filter(next => !taken.has(key(next)) && !seen.has(key(next)) && seen.add(key(next))));
        if (isRightmost) {
            const { rowStep, scale } = this.level.grid;
            const here = board.getCharXAndYFromTileIndex(tile);
            const level = [...rings[0], ...rings[1]].filter(next => Math.abs(board.getCharXAndYFromTileIndex(next).y - here.y) <= rowStep * scale);
            return level.sort((a, b) => board.getCharXAndYFromTileIndex(b).x - board.getCharXAndYFromTileIndex(a).x)[0] || rings[0][0] || rings[1][0];
        }
        return rings[0][0] || rings[1][0];
    }

    // placed by their feet, wherever they stand, tile or no tile
    // 'rowsBack': sorted as if this many rows further back, so the team is drawn over them (the Street's Agent, Jamie, playtest 18)
    addExtra({ avatar, spot, facingDir, rowsBack = 0 }) {
        const piece = this.gameBoardPiecesManager.addPiece({
            pieceClass: GameBoardPieceExtra,
            pieceInfo: { ...PIECES_INFO[avatar], abilities: [] },
            teamIndex: 1
        });
        const tileIndex = this.gameBoardManager.getClosestWalkableTileToLocation(spot);
        const center = getTileCenter(this.level.grid, tileIndex);
        const { x, y } = this.gameBoardManager.getCharXAndYFromTileIndex(tileIndex);
        piece.place({ charLocation: { x: x + spot.x - center.x, y: y + spot.y - center.y }, tileIndex, facingDir });
        piece.zIndexOffset = -rowsBack * this.gameBoardManager.numTileColumns;
        this.extras.push(piece);
    }

    // a person at work in a walking scene (the Street's hazmat workers): runs from spot to spot, off the tiles, and stands a while
    addWalker({ avatar, route, runSpeed, idleSeconds }) {
        const piece = this.gameBoardPiecesManager.addPiece({
            pieceClass: GameBoardPieceExtra,
            pieceInfo: { ...PIECES_INFO[avatar], abilities: [] },
            teamIndex: 1
        });
        const [first] = route;
        piece.place({ charLocation: this.getWalkerCharLocation(first), tileIndex: this.gameBoardManager.getClosestWalkableTileToLocation(first), facingDir: 'down' });
        piece.walk = { route, runSpeed, idleMs: idleSeconds * 1000, legIndex: 0, idleMsLeft: Math.random() * idleSeconds * 1000, isRunning: false };
        this.placeWalker(piece, first.y);
        this.walkers.push(piece);
    }

    // from where the feet are to the piece's own spot, its top left: it is drawn smaller further up the scene.
    // the body fills only part of its sprite frame, so the frame is drawn bigger: the body stands as tall as a sweeper there.
    getWalkerScale(y) {
        return this.level.getWalkerHeight(y) / (CHARACTER_HEIGHT_PX * WALKER_BODY_FRACTION * this.level.pieceScale);
    }

    getWalkerCharLocation({ x, y }) {
        const scale = this.level.pieceScale * this.getWalkerScale(y);
        return { x: x - CHARACTER_FEET.x * scale - CHARACTER_FEET.leftShift, y: y - CHARACTER_FEET.y * scale };
    }

    // its size and its place in front of or behind the scene, from where its feet are
    placeWalker(piece, feetY) {
        piece.perspectiveScale = this.getWalkerScale(feetY);
        piece.introZIndex = getSortZIndex(this.level, feetY) - PIECE_Z_BASE;
    }

    updateWalkers() {
        this.walkers.forEach(piece => {
            const walk = piece.walk;
            if (walk.isRunning) {
                piece.moveSpeed = walk.runSpeed * GAME_TICK.pieceMs / 1000 / this.gameBoardManager.moveSpeedScale;
                const hasArrived = piece.stepArrival();
                this.placeWalker(piece, piece.charLocation.y + CHARACTER_FEET.y * this.level.pieceScale * piece.perspectiveScale);
                if (hasArrived) {
                    walk.isRunning = false;
                    walk.idleMsLeft = walk.route[walk.legIndex].isPass ? 0 : walk.idleMs;
                }
                return;
            }
            walk.idleMsLeft -= GAME_TICK.pieceMs;
            if (walk.idleMsLeft > 0) return;
            walk.legIndex = (walk.legIndex + 1) % walk.route.length;
            const from = piece.charLocation;
            piece.charLocation = this.getWalkerCharLocation(walk.route[walk.legIndex]);
            piece.startArrival(from);
            walk.isRunning = true;
        });
    }

    // who has been recruited: this playthrough's (React state), or else the saved choices
    getRecruitedAvatars() {
        if (this.recruits) return [...this.recruits];
        return Object.entries(getRecruitChoices()).filter(([, choice]) => choice == 'recruit').map(([avatar]) => avatar);
    }

    addRecruitFollowers() {
        const playerTile = this.gameBoardPiecesManager.getPlayerPiece().getTileIndex();
        this.getRecruitedAvatars().forEach(avatar => {
            // each on a free tile near the player, not on theirs: one would hide the other (Jamie, playtest 18)
            const piece = this.gameBoardPiecesManager.addFollower(avatar, this.getFreeTileNear(playerTile) || playerTile);
            if (avatar == 'hazmat') piece.color = HAZMAT_RECRUIT.color; // his outline (orange: Jamie, playtest 19)
            this.followers.push(piece);
        });
    }

    getCameraShot() {
        if (this.recruitScene) return this.recruitScene.shot;
        if (this.cutscene) return this.cutscene.steps[this.cutscene.index].shot;
        return this.outcomeShot || this.knockShot || this.portalShot || this.getGhostRingShot(); // the player knocked down by the train: in close on them
    }

    getTimeScale = () => {
        return this.timeScale;
    }

    // the Subway: a train is through, and the player and Punk Guy are on platforms it cuts apart. there is nothing to do but wait,
    // so the camera shows them both, until the train goes or a Teleport puts them on the same platform
    getIsApartByTrain = () => {
        if (!this.trainSchedule || !this.activePhases.has('train') || !this.rivalPiece || this.rivalPiece.isDead || !this.rivalPiece.isOnTiles) return false;
        const player = this.gameBoardPiecesManager.getPlayerPiece();
        if (!player || player.isDead) return false;
        const from = player.getTileIndex();
        const to = this.rivalPiece.getTileIndex();
        const key = `${from.i} ${from.j} ${to.i} ${to.j} ${this.gameBoardManager.walkableRevision}`;
        if (this.apartKey != key) {
            this.apartKey = key;
            this.isApart = !this.gameBoardManager.getReachableTiles(from).some(({ i, j }) => i == to.i && j == to.j);
        }
        return this.isApart;
    }

    // hit by the train and still standing: thrown as a ragdoll, down a moment, then up where they landed and on with the fight
    knockDown(piece, hitAt) {
        const side = piece.charLocation.x >= hitAt.x ? 1 : -1; // flung the way they were pushed off the tracks
        const knock = {
            key: `knock ${piece.pieceIndex} ${this.accTime}`, charLocation: hitAt, avatar: piece.avatar, zIndex: piece.getZIndex(), color: piece.color,
            pieceIndex: piece.pieceIndex, throwVec: { x: side, y: -0.35 }, spriteSheetSrc: piece.spriteSheetSrc, body: undefined,
            isKnockdown: true, upAt: this.accTime + TRAIN_KNOCKDOWN.downMs,
            upTile: piece.getTileIndex() // off the tracks, where they get up: the body tumbles there as it falls
        };
        this.gameBoardPiecesManager.deathPieces.push(knock);
        piece.knockedUntil = knock.upAt;
        piece.isVisible = false;
        piece.moveToTiles = [];
        if (piece == this.gameBoardPiecesManager.getPlayerPiece()) {
            this.knockShot = { point: { ...hitAt }, zoomScale: PENINSULA.cameraZoom * CUTSCENE.outcomeZoomScale, panMs: CUTSCENE.outcomePullMs, isPeninsulaSized: true };
            this.knockShotDeath = knock;
        }
    }

    // the body drifts toward where they will get up as it tumbles, and they get up there
    updateKnockdowns() {
        const deaths = this.gameBoardPiecesManager.deathPieces;
        deaths.filter(({ isKnockdown, body }) => isKnockdown && body).forEach(({ body, upTile }) => {
            const target = this.gameBoardManager.getCharXAndYFromTileIndex(upTile);
            body.x += (target.x - body.x) * TRAIN_KNOCKDOWN.drift;
            body.y += (target.y - body.y) * TRAIN_KNOCKDOWN.drift;
        });
        deaths.filter(({ isKnockdown, upAt }) => isKnockdown && this.accTime >= upAt).forEach(knock => {
            const piece = this.gameBoardPiecesManager.getPiece(knock.pieceIndex);
            if (piece && !piece.isDead) {
                piece.initCharLocation(true, knock.upTile);
                piece.isVisible = true;
            }
            if (this.knockShotDeath == knock) {
                this.knockShot = undefined;
                this.knockShotDeath = undefined;
            }
        });
        this.gameBoardPiecesManager.deathPieces = deaths.filter(({ isKnockdown, upAt }) => !isKnockdown || this.accTime < upAt);
        if (this.knockShot) {
            const target = this.getDeathLocation(this.knockShotDeath);
            this.knockShot.point.x += (target.x - this.knockShot.point.x) * CUTSCENE.outcomeFollow;
            this.knockShot.point.y += (target.y - this.knockShot.point.y) * CUTSCENE.outcomeFollow;
        }
    }

    // bodies fly on game time, so slow motion slows them too
    stepRagdolls() {
        const rowPx = this.level.grid.rowStep * this.level.grid.scale;
        const seconds = GAME_TICK.pieceMs / 1000 * this.timeScale;
        this.getDeathPieces().filter(death => death.throwVec && death.avatar != 'kaiju').forEach(death => {
            death.body = death.body ? stepRagdoll(death.body, seconds, rowPx, this.getRagdollBounds()) : startRagdoll(death.charLocation, death.throwVec, rowPx);
        });
    }

    // a thrown body stays over the walkable tiles, so it stays in the shot
    getRagdollBounds() {
        if (!this.ragdollBounds) {
            const centers = this.level.walkableTiles.map(this.gameBoardManager.getCharXAndYFromTileIndex);
            this.ragdollBounds = {
                left: Math.min(...centers.map(({ x }) => x)),
                right: Math.max(...centers.map(({ x }) => x)),
                top: Math.min(...centers.map(({ y }) => y)),
                bottom: Math.max(...centers.map(({ y }) => y))
            };
        }
        return this.ragdollBounds;
    }

    // where a death is now: a thrown body moves, an exploding Kaiju stays put
    getDeathLocation({ body, charLocation }) {
        return body ? getTorsoSpot(body, this.level.pieceScale) : charLocation;
    }

    // the shot holds on whoever's death ended the fight, and follows their body

    // 'isMidFight': a scene in the middle of a fight (a boss's scream, a walk through a portal): it holds the fight,
    // but the HUDs stay up and the log stays closed
    startCutscene(steps, { isMidFight = false, isPortalWalk = false } = {}) {
        if (!isPortalWalk) this.endTravelForScene();
        if (!isMidFight && !isPortalWalk) this.spreadOutForScene();
        // in the log, a conversation in a wide shot cuts to each speaker: first it holds on the whole scene
        const [first] = steps;
        if (getIsDialogueLog() && first && first.speech && first.shot && first.shot.isWide) steps = [{ shot: { isWide: true }, ms: DIALOGUE.establishMs }, ...steps];
        this.cutscene = { steps, index: -1, msLeft: 0, isMidFight };
        this.nextCutsceneStep();
    }

    /*
        A scene starting (Jamie): two people standing one over the other (the same tile, or just above or below each other)
        would hide one behind the other as they talk. the later one steps to a free tile beside.
    */
    spreadOutForScene() {
        const board = this.gameBoardManager;
        const { colStep, rowStep, scale } = this.level.grid;
        const people = this.getPieces().filter(piece => piece.isOnTiles && piece.isVisible !== false && !piece.isDead && !piece.isGiant && piece.avatar != 'kaiju');
        const taken = new Set(people.map(piece => `${piece.getTileIndex().i} ${piece.getTileIndex().j}`));
        const getIsOver = (a, b) => Math.abs(a.charLocation.x - b.charLocation.x) < colStep * scale * 0.9 && Math.abs(a.charLocation.y - b.charLocation.y) < rowStep * scale * 1.2;
        people.forEach((piece, k) => {
            if (!people.slice(0, k).some(other => getIsOver(piece, other))) return;
            const here = piece.getTileIndex();
            const beside = board.getAdjacentTileIndices(here).filter(board.getIsInBounds)
                .filter(tile => !taken.has(`${tile.i} ${tile.j}`) && tile.i != here.i) // to the side, not just up or down
                .find(tile => {
                    const spot = board.getCharXAndYFromTileIndex(tile);
                    return !people.some(other => other !== piece && getIsOver({ charLocation: spot }, other));
                });
            if (!beside) return;
            taken.add(`${beside.i} ${beside.j}`);
            piece.initCharLocation(true, beside);
        });
    }

    nextCutsceneStep() {
        const { cutscene } = this;
        cutscene.index += 1;
        const step = cutscene.steps[cutscene.index];
        if (!step) {
            this.cutscene = undefined;
            this.speech = null;
            if (!this.level.isWalkingLevel) this.logChain += 1; // the fight is on
            this.getPieces().forEach(piece => { piece.isTileHidden = false; });
            return;
        }
        cutscene.msLeft = step.ms;
        this.isCutsceneLineWaiting = false;
        // words can be placed when they are said, over wherever the speaker has walked to
        this.speech = this.fillSpeech((typeof step.speech == 'function' ? step.speech() : step.speech) || null);
        if (this.speech && getIsDialogueLog() && !this.speech.isShout) {
            // the line goes to the log, not a balloon. the shot goes to the speaker, if it was the whole scene.
            this.speech = { ...this.speech, isLogged: true };
            this.addToLog(this.speech);
            // 'isCover': the zoom is from the screen filled, not from the whole scene fitted in it
            if (step.shot && step.shot.isWide && !step.shot.isKeptWide && this.speech.focus) step.shot = { point: this.speech.focus, zoomScale: DIALOGUE.speakerZoomScale, isCover: true };
            if (getIsClickThrough()) {
                cutscene.msLeft = Infinity;
                this.isCutsceneLineWaiting = true;
            }
        }
        if (step.onStart) step.onStart();
        if (step.arrivals) step.arrivals.forEach(arrival => this.startPieceArrival(arrival));
        if (step.phase) this.activePhases.add(step.phase);
    }

    // with spacing on, no two pieces stop on one tile: a taken one gives way to the nearest free tile beside it
    getUnclaimedTile(piece, tile) {
        if (!this.getIsTileTakenForSpacing(piece.pieceIndex, tile)) return tile;
        const free = this.gameBoardManager.getAdjacentTileIndices(tile)
            .filter(this.gameBoardManager.getIsInBounds)
            .find(next => !this.getIsTileTakenForSpacing(piece.pieceIndex, next));
        return free || tile;
    }

    // a piece walks to where it stands, from a tile, or from where it is to a new tile
    // it follows the tiles, so it goes round walls and water. off the tiles, it walks straight.
    // 'delayTicks': it waits that many ticks before it sets off. 'avoidPathOf': another piece arriving with it, whose way it
    // keeps off where it can (two from the same door would otherwise walk one inside the other, Jamie)
    startPieceArrival({ piece, startTile, toTile, dir, delayTicks = 0, avoidPathOf = undefined }) {
        const start = startTile ? this.gameBoardManager.getCharXAndYFromTileIndex(startTile) : piece.charLocation;
        const fromTile = startTile || piece.getTileIndex();
        if (toTile) piece.initCharLocation(true, this.getUnclaimedTile(piece, toTile));
        const isOnTiles = fromTile && this.gameBoardManager.getIsInBounds(fromTile) && this.gameBoardManager.getIsInBounds(piece.getTileIndex());
        const goal = piece.getTileIndex();
        const getKey = ({ i, j }) => `${i} ${j}`;
        const avoid = avoidPathOf && avoidPathOf.arrivalPathTiles
            ? avoidPathOf.arrivalPathTiles.filter(tile => getKey(tile) != getKey(fromTile) && getKey(tile) != getKey(goal))
            : undefined;
        const path = isOnTiles ? this.gameBoardManager.findPathFromTo(fromTile, goal, avoid && avoid.length ? avoid : undefined, false, piece.pieceIndex) : [];
        piece.arrivalPathTiles = path;
        piece.arrivalWaitTicks = delayTicks;
        piece.startArrival(start, dir, path.slice(0, -1).map(this.gameBoardManager.getCharXAndYFromTileIndex));
    }

    // Enter (or, for a waiting line, any key or a click) moves the words on: the next line comes on the next tick
    advanceDialogue() {
        if (this.isPaused) return false;
        const talk = this.talks.find(({ isWaiting }) => isWaiting);
        if (talk) {
            talk.isWaiting = false;
            return true;
        }
        const step = this.cutscene && this.cutscene.steps[this.cutscene.index];
        if (step && step.isSkippable) {
            this.cutscene.msLeft = 0; // a hold the player can move on from
            return true;
        }
        if (!step || !step.speech) return false;
        this.cutscene.msLeft = 0;
        this.isCutsceneLineWaiting = false;
        return true;
    }

    getIsDialogueWaiting() {
        return (!!this.cutscene && this.isCutsceneLineWaiting) || this.talks.some(({ isWaiting }) => isWaiting);
    }

    // whose piece shakes as they talk: the speaker of the cutscene's line, or of the talk's latest line while it is up
    getSpeakingPieceIndex() {
        if (this.cutscene) return this.speech ? this.speech.speakerIndex : undefined;
        const talk = this.talks.find(({ isWaiting, msLeft, index }) => index > 0 && (isWaiting || msLeft > 0));
        return talk ? talk.lines[talk.index - 1].speakerIndex : undefined;
    }

    // the teammate has said all there is to say over the bystander: the choice can be made
    getIsRecruitTalkDone() {
        return !!this.recruitScene && this.talks.every(({ lines, index, isWaiting, isActive }) => !isActive() || (index >= lines.length && !isWaiting));
    }

    // talk is going on outside of cutscenes, so the log stays open for it
    getIsTalking() {
        return this.talks.some(({ lines, index, isWaiting, msLeft, isActive }) => isActive() && (index < lines.length || isWaiting || msLeft > 0));
    }

    // the teammate goes by their own name in what is said: Guy or Girl
    getTeammateName() {
        const [, teammate] = this.gameBoardPiecesManager.getTeamPieces(this.gameBoardPiecesManager.getPlayerTeamIndex());
        const entry = teammate && ROSTER.find(({ id }) => id == teammate.avatar);
        return entry ? entry.name : 'Teammate';
    }

    // a new conversation: the log starts empty, and the next speaker shows with their face and name
    startNewLog() {
        this.logChain += 1;
        this.dialogueLog = [];
    }

    // who says a line from the dialogue file: a role ('player', 'teammate', 'agent', 'recruit') or a name, as a piece in the scene if there is one
    getLineSpeaker(speaker) {
        const [player, teammate] = this.gameBoardPiecesManager.getTeamPieces(this.gameBoardPiecesManager.getPlayerTeamIndex());
        const byName = name => ROSTER.find(({ name: rosterName }) => rosterName == name);
        if (speaker == 'player' && player) return { name: ROSTER.find(({ id }) => id == player.avatar).name, avatar: player.avatar, piece: player };
        if (speaker == 'teammate' && teammate) return { name: this.getTeammateName(), avatar: teammate.avatar, piece: teammate };
        if (speaker == 'agent') return { name: 'Agent', avatar: 'agent', piece: this.extras.find(extra => extra.avatar == 'agent') };
        if (speaker == 'recruit' && this.followers && this.followers[0]) {
            const recruit = this.followers[0];
            return { name: ROSTER.find(({ id }) => id == recruit.avatar).name, avatar: recruit.avatar, piece: recruit };
        }
        const entry = byName(speaker);
        const piece = entry && this.getPieces().find(({ avatar }) => avatar == entry.id);
        return { name: speaker, avatar: entry && entry.id, piece };
    }

    // a line's pronoun words ({you:he}, {teammate:his}) fit whoever is playing
    fillSpeech(speech) {
        if (!speech) return speech;
        const player = this.gameBoardPiecesManager.getPlayerPiece();
        const avatar = player && player.avatar;
        return { ...speech, ...(speech.text ? { text: fillPronouns(speech.text, avatar) } : {}), ...(speech.lines ? { lines: speech.lines.map(line => fillPronouns(line, avatar)) } : {}) };
    }

    // who said it, for the log's color and portrait
    addToLog({ name, text, avatar }) {
        const player = this.gameBoardPiecesManager.getPlayerPiece();
        const who = avatar == 'agent' ? 'agent' : name == this.getTeammateName() ? 'teammate' : player && avatar == player.avatar ? 'player' : 'other';
        this.dialogueLog = [...this.dialogueLog, { key: this.dialogueLog.length, who, name, text: fillPronouns(text, player && player.avatar), avatar, chain: this.logChain }];
    }

    // a scene's speech elements go to the log, while their phase is on (and before their 'hidePhase')
    addSceneTalks() {
        // back in a scene from one of its screens (the Lab's power picker), what was said on the way in isn't said again
        this.level.sceneElements.filter(({ type, phase }) => type == 'speech' && !((this.returnSpot || this.isRevisit) && !phase)).forEach(({ name = 'Agent', lines, phase, hidePhase, dialogue }) => {
            // a scene that opens with a call waits for the team to come over
            const isActive = () => !this.cutscene && (!this.level.greeting || this.isGreetingAnswered) && (!phase || this.activePhases.has(phase)) && !(hidePhase && this.activePhases.has(hidePhase));
            // from the dialogue file, each line by whoever says it; otherwise all of them by the element's speaker
            const spoken = dialogue ? getSpokenLines(dialogue) : lines.map(text => ({ speaker: name == 'Agent' ? 'agent' : name, text }));
            this.addTalk(spoken.map(({ speaker, text }) => {
                const { name: speakerName, avatar, piece } = this.getLineSpeaker(speaker);
                return { name: speakerName, text, avatar, speakerIndex: piece && piece.pieceIndex };
            }), isActive, !!phase || !!hidePhase);
        });
    }

    // talk outside of cutscenes, for the log: a scene's words (the Street Agent), and the teammate over the downed bystander.
    // one talk at a time, each line once. with Click through, each line waits for a key or a click.
    addTalk(lines, isActive = () => true, isPhased = false) {
        this.talks.push({ lines, index: 0, msLeft: 0, isWaiting: false, isActive, isPhased });
    }

    updateTalks() {
        const talk = this.talks.find(({ lines, index, isActive }) => index < lines.length && isActive());
        if (!talk || talk.isWaiting) return;
        talk.msLeft -= GAME_TICK.pieceMs;
        if (talk.msLeft > 0) return;
        const line = talk.lines[talk.index];
        talk.index += 1;
        this.addToLog(line);
        if (getIsClickThrough()) talk.isWaiting = true;
        else talk.msLeft = getSpeechMs(line.text);
    }

    // a scene's own talk, not tied to a phase, has all been said
    getIsSceneTalkDone() {
        return this.talks.every(({ lines, index, isWaiting, isPhased }) => isPhased || (index >= lines.length && !isWaiting));
    }

    updateCutscene() {
        const { cutscene } = this;
        if (this.ghostRing && !this.ghostRing.getIsFormed()) {
            this.ghostRing.stepForming(GAME_TICK.pieceMs);
            this.syncPhaseGhostTiles();
        }
        if (this.aquariumFlood && this.getIsLiveCutscene()) this.stepFloodWater();
        const step = cutscene.steps[cutscene.index];
        if (step.arrivals) {
            step.arrivals = step.arrivals.filter(({ piece }) => !piece.stepArrival());
            if (!step.arrivals.length) this.nextCutsceneStep();
            return;
        }
        // a step can move things along as it goes: 0 at its start, 1 at its end
        if (step.onTick) step.onTick(Math.min(1 - (cutscene.msLeft - GAME_TICK.pieceMs) / Math.max(step.ms, 1), 1));
        cutscene.msLeft -= GAME_TICK.pieceMs;
        if (cutscene.msLeft <= 0) this.nextCutsceneStep();
    }

    // the whole map, a slow pull in on the player that speeds up, then the teammate runs up from the base of the Peninsula
    startArrival() {
        const [player, teammate] = this.getPieces();
        const getTile = spot => this.gameBoardManager.getClosestWalkableTileToLocation(spot);
        player.initCharLocation(true, getTile(CUTSCENE.arrivalPlayerSpot));

        const closeShot = { point: player.charLocation, zoomScale: this.level.cameraZoom, panMs: CUTSCENE.arrivalPanMs, ease: 'cubic-bezier(0.8, 0, 1, 0.6)' };
        const steps = [{ shot: { isWide: true }, ms: CUTSCENE.wideMs }, { shot: closeShot, ms: CUTSCENE.arrivalPanMs }];
        if (teammate) {
            teammate.initCharLocation(true, getTile(CUTSCENE.arrivalTeammateSpot));
            teammate.isVisible = false; // off-shot until the camera has pulled in
            teammate.isTileHidden = true;
            const { x, y } = teammate.charLocation;
            const { rowStep, scale } = this.level.grid;
            const heldShot = { ...closeShot, panMs: undefined };
            steps.push(
                { shot: heldShot, arrivals: [{ piece: teammate, startTile: getTile(CUTSCENE.arrivalTeammateStart) }] },
                { shot: heldShot, ms: getSpeechMs(ARRIVAL_LINE), speech: { name: this.getTeammateName(), text: ARRIVAL_LINE, x, y: y - CUTSCENE.recruitSpeechRows * rowStep * scale, isShout: true, speakerIndex: teammate.pieceIndex } }
            );
        }
        this.startCutscene(steps);
    }

    // the whole level, a pull in on the bystander and the part, their words, then the touch
    startRivalIntro() {
        const { touchPhase, intro: { focus, zoomScale, lines, isTouchWide, afterTouch } } = this.level.rival;
        this.addRival();
        const rival = this.rivalPiece;
        const [, teammate] = this.gameBoardPiecesManager.getTeamPieces(this.gameBoardPiecesManager.getPlayerTeamIndex());
        const { rowStep, scale } = this.level.grid;
        // with the log, no balloon needs room: the shots move in close
        const closeShot = point => getIsDialogueLog() ? { point, zoomScale: DIALOGUE.introZoomScale, isCover: true } : { point, zoomScale };
        const shot = closeShot(focus);

        // the camera goes to the teammate for their line, then back to the part
        const getTeammateSteps = text => {
            if (!teammate) return [];
            const { x, y } = teammate.charLocation;
            const teammateShot = closeShot({ x, y: y - CUTSCENE.shotHeadRows * rowStep * scale });
            const speech = { name: this.getTeammateName(), text, x, y: y - CUTSCENE.recruitSpeechRows * rowStep * scale, avatar: teammate.avatar, speakerIndex: teammate.pieceIndex };
            return [
                { shot: teammateShot, ms: CUTSCENE.pullInMs },
                { shot: teammateShot, ms: getSpeechMs(text), speech },
                { shot, ms: CUTSCENE.pullInMs }
            ];
        };

        this.startCutscene([
            { shot: { isWide: true }, ms: CUTSCENE.wideMs },
            { shot, ms: CUTSCENE.pullInMs },
            ...lines.flatMap(({ isTeammate, name, text, isFlipped, shot: lineShot }) => lineShot == 'wide'
                ? [{ shot: WHOLE_SCENE_SHOT, ms: getSpeechMs(text), speech: isTeammate ? this.getSpeechOver(teammate, this.getTeammateName(), text) : { ...this.getSpeechOver(rival, name, text), isFlipped } }]
                : isTeammate ? getTeammateSteps(text) : [
                    // the bystander, by name; or anyone else the dialogue file gives a line (the player, the Agent)
                    { shot, ms: getSpeechMs(text), speech: ['player', 'agent', 'recruit'].includes(name)
                        ? (() => { const { piece, name: who } = this.getLineSpeaker(name); return piece ? this.getSpeechOver(piece, who, text) : { ...this.getSpeechOver(rival, who, text), isFlipped }; })()
                        : { ...this.getSpeechOver(rival, name, text), isFlipped } }
                ]),
            { shot: isTouchWide ? { isWide: true } : shot, ms: CUTSCENE.touchMs, phase: touchPhase, onStart: () => { rival.isPlain = false; } },
            ...(afterTouch ? [
                { shot: closeShot({ x: rival.charLocation.x, y: rival.charLocation.y }), ms: CUTSCENE.pullInMs },
                { shot: closeShot({ x: rival.charLocation.x, y: rival.charLocation.y }), ms: getSpeechMs(afterTouch.text), speech: () => this.getSpeechOver(rival, afterTouch.name, afterTouch.text) }
            ] : [])
        ]);
    }

    /*
        The Subway (Jamie): a train in, and Punk Guy on a platform with the player or the teammate, he's trapped there:
        he uses his Teleport to get to a platform with none of them on it, when it's ready.
    */
    updateTrappedRival() {
        const rival = this.rivalPiece;
        if (!this.level.hasTrainSchedule || !this.activePhases.has('train') || this.cutscene || !rival || rival.isDead || !rival.isOnTiles || rival.shouldTeleport) return;
        const teleport = rival.abilities.find(ability => ability.gameBoardPieceAbilityData.element == 'glass');
        if (!teleport || teleport.getIsOnCooldown(this.accTime, true)) return;
        const team = this.gameBoardPiecesManager.getTeamPieces(this.gameBoardPiecesManager.getPlayerTeamIndex()).filter(piece => !piece.isDead && piece.isOnTiles);
        const region = this.getTeleportRegion(rival.getTileIndex());
        if (!team.some(piece => this.getTeleportRegion(piece.getTileIndex()) == region)) return;
        const teamRegions = new Set(team.map(piece => this.getTeleportRegion(piece.getTileIndex())));
        const clear = this.gameBoardManager.walkableTiles.filter(tile => !teamRegions.has(this.getTeleportRegion(tile)));
        if (!clear.length) return;
        rival.teleportTarget = clear[Math.floor(Math.random() * clear.length)];
        teleport.useAbility({ accTime: this.accTime, piece: rival, registerTimeout: this.gameManagerProxy.registerTimeout, updateTileWithAbilityStatus: this.gameManagerProxy.updateTileWithAbilityStatus });
    }

    // - - - objectives (Objectives.ts, Jamie 2026-11-10) - - -

    // what the player is to do, as things stand. held while a scene plays (not one mid-fight): a new one shows after it
    getCurrentObjective() {
        const level = this.level;
        if (this.recruitScene) return null;
        if (level.finalTurn) {
            if (this.finalTurnState == 'fighting' && this.teammateKaiju && !this.teammateKaiju.isDead) return { text: OBJECTIVES.stopTeammate(this.getTeammateName()) };
            if (this.finalTurnState) return null;
            return KAIJU_OBJECTIVE;
        }
        if (level.kaijuEntry) return KAIJU_OBJECTIVE;
        if (level.isMapWalk) return MAP_OBJECTIVES[level.id] ? { text: MAP_OBJECTIVES[level.id] } : null;
        if (getIsDetourLevel(level.id)) return this.carriedObjective;
        if (level.greeting) {
            if (this.activePhases.has(EXIT_OPEN_PHASE)) return { text: OBJECTIVES.street.leave };
            return this.hasGreeted ? { text: OBJECTIVES.street.talk } : null;
        }
        if (level.ghostBoss) {
            // from her scream on, till the ring is spent: not her ghost form's objective before the ghosts (Jamie)
            if (this.ghostRing || this.isGhostPhase) return { text: OBJECTIVES.ghosts };
            return { text: this.rivalPiece && this.rivalPiece.isGhostForm ? OBJECTIVES.ghostForm : OBJECTIVES.rivals.black_female };
        }
        // while the water runs only: not when she climbs back up after it (Jamie, playtest 19)
        if (level.aquariumFlood && this.isShattered && this.aquariumFlood && this.rivalPiece && this.getIsTopFloor(this.rivalPiece.getTileIndex())) return { text: OBJECTIVES.flood };
        if (level.rival && level.rival.isSparring) return { text: `Defeat ${this.getTeammateName()}` }; // sparring with the teammate
        if (level.rival) return OBJECTIVES.rivals[level.rival.avatar] ? { text: OBJECTIVES.rivals[level.rival.avatar] } : null;
        if (level.trap) return this.getPieces().some(piece => piece.isChaser) ? { text: OBJECTIVES.escape } : null;
        if (level.walkIn && level.walkIn.reveal) return this.activePhases.has(level.walkIn.reveal.glowPhase) ? { text: OBJECTIVES.glow } : null;
        if (level.agentDrops) return { text: OBJECTIVES.agents };
        return null;
    }

    updateObjective() {
        // only once the player can act again: not over a scene's words, even one in mid-fight (Jamie, playtest 18)
        if (this.cutscene || this.recruitScene) return;
        const objective = this.getCurrentObjective();
        if (getIsSameObjective(objective, this.objective)) return;
        this.objective = objective;
        if (objective) this.objectiveCount += 1;
    }

    // the whole scene, in on the Agent for his call, then back to the team, as at the train.
    // he calls again ('repeatMs' later) until the team is near him: each call takes the camera and the controls for a moment.
    startGreeting(isRepeat = false) {
        const { text, speechSpot, repeatMs } = this.level.greeting;
        const speech = { ...this.getAgentSpeech(text, speechSpot), isShout: true }; // a call across the street: a balloon, not the log
        this.hasGreeted = true; // from his first call on, the objective is to go and talk to him
        const player = this.gameBoardPiecesManager.getPlayerPiece();
        const { rowStep, scale } = this.level.grid;
        const agentShot = { point: speech.focus || speechSpot, zoomScale: DIALOGUE.speakerZoomScale, isCover: true };
        const teamShot = { point: { x: player.charLocation.x, y: player.charLocation.y - CUTSCENE.shotHeadRows * rowStep * scale }, zoomScale: 1, isCover: true };
        this.startCutscene([
            ...(isRepeat ? [] : [{ shot: { isWide: true }, ms: CUTSCENE.mapWideMs }]),
            { shot: agentShot, ms: CUTSCENE.pullInMs },
            { shot: agentShot, ms: getSpeechMs(text), speech },
            { shot: teamShot, ms: CUTSCENE.pullInMs }
        ]);
        this.nextGreetingAtMs = this.accTime + repeatMs; // game time stands still in a cutscene: this counts from its end
    }

    // the team has come over to the Agent: his talk can start
    updateGreeting() {
        if (this.isGreetingAnswered) return;
        const agent = (this.level.extras || []).find(({ avatar }) => avatar == 'agent');
        if (agent && this.getIsPlayerNear(agent.spot, this.level.greeting.nearRows)) {
            this.isGreetingAnswered = true;
            return;
        }
        if (this.accTime >= this.nextGreetingAtMs) this.startGreeting(true);
    }

    // back from a training fight won (Jamie): the card first, and the glow if it was health; the player holds still,
    // then the words. any other visit: the words at once
    queueVisitScene() {
        if (!this.trainingOutcome) {
            this.startVisitScene();
            return;
        }
        this.visitSceneAt = TRAINING_RETURN.cardMs;
        const [player] = this.getTrainingPieces().map(([piece]) => piece);
        if (player) player.isHeld = true;
    }

    updateQueuedVisitScene() {
        if (this.visitSceneAt === undefined || this.accTime < this.visitSceneAt) return;
        this.visitSceneAt = undefined;
        this.getPieces().forEach(piece => { piece.isHeld = false; });
        this.startVisitScene();
    }

    /*
        A battleground won on before, visited from the map: the teammate has a word, then it's a walk (Jamie, 2026-11-10):
        - back from sparring won: "Good job..." and Do Training again, if there's more to win; else "Not much to do here..."
        - back from a recruit's training won: the recruit's word on the power; nothing more to do here
        - sparred here before: "Want to go again?" and Do Training
        - nothing to train: "Not much to do here..." only
        - else the visit lines, and the recruit's (or the teammate's) offer
    */
    startVisitScene() {
        const [, teammate] = this.gameBoardPiecesManager.getTeamPieces(this.gameBoardPiecesManager.getPlayerTeamIndex());
        if (!teammate) return;
        const teammateSays = text => ({ shot: { isWide: true }, ms: getSpeechMs(text), speech: this.getSpeechOver(teammate, this.getTeammateName(), text) });
        const outcome = this.trainingOutcome;
        const sparring = this.getSparringOffer();
        const openSparring = { shot: { isWide: true }, ms: 0, onStart: () => { this.trainingLevelId = this.level.training.sparringLevelId; this.setPhase(TRAINING_PHASE, true); } };
        const nothingHere = getDialogueLine(this.level.visitScene || 'visit').text;
        if (outcome && outcome.isSparring) {
            this.startCutscene(sparring ? [teammateSays(getDialogueLine('sparring.again').text), openSparring] : [teammateSays(nothingHere)]);
            return;
        }
        if (outcome) {
            const recruit = this.followers.find(piece => piece.avatar == outcome.avatar && !piece.isDead);
            const text = getKeyedLines('training.won')[outcome.avatar];
            const name = (ROSTER.find(({ id }) => id == outcome.avatar) || {}).name;
            // then the teammate: the new power is theirs to pick at the Lab (Jamie, playtest 19)
            const labNote = getDialogueLine('training.labNote').text;
            this.startCutscene(recruit && text ? [{ shot: { isWide: true }, ms: getSpeechMs(text), speech: this.getSpeechOver(recruit, name, text) }, teammateSays(labNote)] : [teammateSays(nothingHere)]);
            return;
        }
        if (sparring && this.sparredHere) {
            this.startCutscene([teammateSays(getDialogueLine('sparring.goAgain').text), openSparring]);
            return;
        }
        if (this.level.training && !sparring && !this.getTrainingOffer()) {
            this.startCutscene([teammateSays(nothingHere)]);
            return;
        }
        // each visit line by whoever the dialogue file says (the teammate, as written)
        const visitSteps = getSpokenLines(this.level.visitScene || 'visit').map(({ speaker, text }) => {
            const { name, piece } = this.getLineSpeaker(speaker);
            const over = piece || teammate;
            return { shot: { isWide: true }, ms: getSpeechMs(text), speech: over ? this.getSpeechOver(over, name, text) : { name, text } };
        });
        this.startCutscene([...visitSteps, ...this.getTrainingOfferSteps()]);
    }

    /*
        Recruit training (Jamie, 2026-11-10), another way to a recruit's power: on a visit to their battleground, the recruit
        (if recruited, walking with the team, and their power still closed) offers to train the player, one on one.
        Then a "Do Training" spot opens in the middle of the battlefield: walking to it starts the fight (Game.tsx).
    */
    getTrainingOffer() {
        const training = this.level.training;
        if (!training) return undefined;
        const recruit = this.followers.find(piece => piece.avatar == training.recruit && !piece.isDead);
        const skill = getSkillUnlock(SKILL_UNLOCKS.find(({ recruit: id }) => id == training.recruit)?.element);
        if (!recruit || !skill || getIsSkillOpen(skill.element)) return undefined;
        return { recruit, skill };
    }

    /*
        Sparring (Jamie, 2026-11-10): with the bystander of this battleground terminated, the teammate offers a fight with
        each other instead: each win is one more health for the player, to SPARRING.maxPlayerLives. As often as they like.
    */
    getSparringOffer() {
        const training = this.level.training;
        const { teammate, player } = this.getGhostTeam();
        if (!training || !teammate || !player || !this.terminated.includes(training.recruit)) return undefined;
        if (player.maxLives >= SPARRING.maxPlayerLives) return undefined;
        return { teammate };
    }

    getTrainingOfferSteps() {
        const sparring = this.getSparringOffer();
        if (sparring) {
            const { text } = getDialogueLine('sparring.offer');
            return [
                { shot: { isWide: true }, ms: getSpeechMs(text), speech: this.getSpeechOver(sparring.teammate, this.getTeammateName(), text) },
                { shot: { isWide: true }, ms: 0, onStart: () => { this.trainingLevelId = this.level.training.sparringLevelId; this.setPhase(TRAINING_PHASE, true); } }
            ];
        }
        const offer = this.getTrainingOffer();
        if (!offer) return [];
        const { recruit } = offer;
        const name = ROSTER.find(({ id }) => id == recruit.avatar).name;
        const text = getKeyedLines('training.offer')[recruit.avatar];
        return [
            { shot: { isWide: true }, ms: getSpeechMs(text), speech: this.getSpeechOver(recruit, name, text) },
            { shot: { isWide: true }, ms: 0, onStart: () => { this.trainingLevelId = this.level.training.levelId; this.setPhase(TRAINING_PHASE, true); } }
        ];
    }

    // the training fight: the recruit, with their powers, one on one; a word from them, and it's on
    startTrainingFight() {
        this.addRival();
        const rival = this.rivalPiece;
        rival.isPlain = false;
        rival.isTileHidden = false;
        const isSparring = !!this.level.rival.isSparring;
        const name = isSparring ? this.getTeammateName() : ROSTER.find(({ id }) => id == rival.avatar).name;
        const text = isSparring ? getDialogueLine('sparring.start').text : getKeyedLines('training.start')[rival.avatar];
        this.startCutscene([
            { shot: { isWide: true }, ms: CUTSCENE.pullInMs },
            { shot: { isWide: true }, ms: getSpeechMs(text), speech: { ...this.getSpeechOver(rival, name, text), isShout: true } },
            { shot: { isWide: true }, ms: 0, onStart: () => this.updateRival() }
        ]);
    }

    // the whole map, to show where to go, then in on the player as in a battle
    startMapIntro() {
        const [player] = this.getPieces();
        this.startCutscene([
            { shot: { isWide: true }, ms: CUTSCENE.mapWideMs },
            { shot: { point: player.charLocation, zoomScale: this.level.cameraZoom }, ms: CUTSCENE.pullInMs }
        ]);
    }

    // back in the Lab: the Agent's reveal, each line once, and then he is gone and the fight is on
    startShowdown() {
        const { script, speechSpot } = this.level.showdown;
        const [player, teammate] = this.gameBoardPiecesManager.getTeamPieces(this.gameBoardPiecesManager.getPlayerTeamIndex());
        const playerName = ROSTER.find(({ id }) => id == player.avatar).name;
        const getSpeech = ({ who, text }) => {
            if (who == 'agent') return this.getAgentSpeech(text, speechSpot);
            return who == 'teammate' ? this.getSpeechOver(teammate, this.getTeammateName(), text) : this.getSpeechOver(player, playerName, text);
        };
        this.getPieces().forEach(piece => { piece.facingDir = 'up'; });
        const shot = { isWide: true };
        this.startCutscene([
            ...script
                .filter(({ who }) => who != 'teammate' || !!teammate)
                .map(line => ({ shot: getLineShot(line, shot), ms: getSpeechMs(line.text), speech: getSpeech(line) })),
            { shot, ms: 0, onStart: this.startShowdownFight }
        ]);
    }

    // the Agent who did the talking teleports up to the catwalk, leaving a portal where he stood, and waits there for his clones.
    // whoever follows him through it fights him up there. the rest drop in from the catwalk.
    startShowdownFight = () => {
        const { talkerKit, catwalkY, portalColumns, headStartMs: [fewestMs, mostMs] } = this.level.agentDrops;
        // every attempt: the Agents scatter and hold their powers a moment, so the team isn't hit the instant it starts
        this.enemyPowersAtMs = this.accTime + fewestMs + Math.random() * (mostMs - fewestMs);
        this.extras.forEach(extra => {
            extra.leave();
            const floorTile = this.getLabPortalFloorTile(extra.getTileIndex());
            const catwalkTile = this.gameBoardManager.getClosestWalkableTileToLocation({ x: extra.charLocation.x, y: catwalkY });
            const agent = this.addAgent({ standTile: catwalkTile, kit: talkerKit });
            agent.isHeldOnCatwalk = true;
            agent.getIsWaitingOnCatwalk = () => this.getIsCatwalkAgentWaiting(agent);
            // the portal's top end is beside him, so whoever comes up lands next to him; it stays open, so they can go back down
            const portalTop = this.gameBoardManager.getClosestWalkableTileToLocation({ x: extra.charLocation.x + portalColumns * this.level.grid.colStep * this.level.grid.scale, y: catwalkY });
            this.gameBoardManager.addWormhole(floorTile, portalTop, this.accTime, Infinity);
            this.catwalkAgent = agent;
        });
    }

    // the portal's floor end (Jamie): back against the floor's back wall, toward the window on the Peninsula, 'portalWallRows'
    // rows out from it, in the column the Agent stood in
    getLabPortalFloorTile(standTile) {
        const { catwalkLastRow, portalWallRows = 2 } = this.level.agentDrops;
        const board = this.gameBoardManager;
        const floorRows = board.walkableTiles.filter(({ i, j }) => i == standTile.i && j > catwalkLastRow).map(({ j }) => j);
        if (!floorRows.length) return standTile;
        const tile = { i: standTile.i, j: Math.min(...floorRows) + portalWallRows };
        return board.getIsInBounds(tile) ? tile : standTile;
    }

    // the kit's three powers
    getAgentAbilities(kit) {
        return this.settingsManager.getAbilitiesFromElements(this.level.agentDrops.kits[kit]);
    }

    // the Lab fight (Jamie): the player's NPCs (teammate, recruits) stay down on the floor. the portal up is the player's,
    // to follow the Agent; the clones come down from the catwalk on their own.
    // (playtest 18: the walk up through the air was a path through a portal that had shut, now fixed in getNextDestination.
    // with 'isCatwalkOpenToTeam', the team's NPCs may go up through the portal too)
    getIsTileOpenTo = (piece, tileIndex) => {
        if (!this.level.agentDrops || this.level.agentDrops.isCatwalkOpenToTeam || !piece.isNpc || piece.getTeamIndex() != this.gameBoardPiecesManager.getPlayerTeamIndex()) return true;
        return !this.getIsOnCatwalk(tileIndex);
    };

    getIsOnCatwalk = ({ j }) => {
        return !!this.level.agentDrops && j <= this.level.agentDrops.catwalkLastRow;
    }

    // the Agent on the catwalk holds his powers unless someone came up after him
    getIsCatwalkAgentWaiting(piece) {
        if (!piece || !piece.isHeldOnCatwalk) return false;
        return !this.gameBoardPiecesManager.getTeamPieces(this.gameBoardPiecesManager.getPlayerTeamIndex())
            .some(other => !other.isDead && other.isOnTiles && this.getIsOnCatwalk(other.getTileIndex()));
    }

    // once every clone has come down from the catwalk, he drops down after them
    updateCatwalkAgent() {
        const agent = this.catwalkAgent;
        if (!agent || !agent.isHeldOnCatwalk) return;
        const { drops, floorY } = this.level.agentDrops;
        const isAllDown = this.agentsDropped >= drops.length && this.getPieces().every(piece => !piece.isEntering || piece.isDead);
        if (!isAllDown || agent.isDead) return;
        agent.isHeldOnCatwalk = false;
        // down for good (Jamie, playtest 18): the portal stays open for the team, but he never goes back up through it.
        // before, his paths took it, and he went up and down between the floor and the catwalk all fight
        agent.allowedTile = tile => !this.getIsOnCatwalk(tile);
        agent.dropDown(this.gameBoardManager.getClosestWalkableTileToLocation({ x: agent.charLocation.x, y: floorY }));
    }

    // everyone stands facing the Agent while he has his say, each line once, and then the chase is on
    // the team in a row before the Agent, each on their own tile, all facing him
    lineUpTeam({ y, spacing }) {
        const { x } = this.level.trap.speechSpot;
        const wholeTeam = this.gameBoardPiecesManager.getTeamPieces(this.gameBoardPiecesManager.getPlayerTeamIndex());
        // the player in the middle of the row, the rest either side of them (Jamie)
        const player = this.gameBoardPiecesManager.getPlayerPiece();
        const team = wholeTeam.filter(piece => piece != player);
        if (wholeTeam.includes(player)) team.splice(Math.floor((wholeTeam.length - 1) / 2), 0, player);
        const usedTiles = new Set();
        team.forEach((piece, k) => {
            const spot = { x: x + (k - (team.length - 1) / 2) * spacing, y };
            let tile = this.gameBoardManager.getClosestWalkableTileToLocation(spot);
            if (usedTiles.has(`${tile.i} ${tile.j}`)) {
                tile = this.gameBoardManager.getAdjacentTileIndices(tile).filter(this.gameBoardManager.getIsInBounds).find(next => !usedTiles.has(`${next.i} ${next.j}`)) || tile;
            }
            usedTiles.add(`${tile.i} ${tile.j}`);
            piece.initCharLocation(true, tile);
            piece.facingDir = 'up';
        });
    }

    // the Agent's ray drains the team: a beam to each of them, and their glow goes out
    fireRay() {
        const { from, color } = this.level.trap.ray;
        // it hits the recruits too, but their powers came from the Kaiju parts, and stay
        const team = this.gameBoardPiecesManager.getTeamPieces(this.gameBoardPiecesManager.getPlayerTeamIndex());
        this.rayBeam = { from, color, targets: team.map(piece => ({ x: piece.charLocation.x, y: piece.charLocation.y - this.level.grid.rowStep * this.level.grid.scale })) };
    }

    endRay = () => {
        this.rayBeam = undefined;
        this.depowerPlayerTeam();
    }

    getRayBeam() {
        return this.rayBeam;
    }

    /*
        The Lab trap's clones (Jamie, playtest 19): after the whole lab, in close on the far right one, then a slow pan left
        along the right group, a quick one across the gap, and slow again along the left group. then the scene's own shot.
    */
    getClonesSweepSteps() {
        const { zoomScale, pxPerMs, gapPxPerMs, gapPx, zoomInMs, holdMs } = CLONES_SWEEP;
        const clones = this.level.sceneElements.filter(({ phase, type }) => phase == 'clones' && type == 'npc').sort((a, b) => b.x - a.x);
        if (!clones.length) return [];
        const pointOf = ({ x, y, height }) => ({ x, y: y - height / 2 });
        const ease = 'linear';
        const steps = [{ shot: { point: pointOf(clones[0]), zoomScale, panMs: zoomInMs }, ms: zoomInMs + holdMs }];
        clones.slice(1).forEach((clone, k) => {
            const distance = clones[k].x - clone.x;
            const panMs = Math.round(distance / (distance > gapPx ? gapPxPerMs : pxPerMs));
            steps.push({ shot: { point: pointOf(clone), zoomScale, panMs, ease }, ms: panMs });
        });
        steps[steps.length - 1].ms += holdMs;
        return steps;
    }

    startTrapScene() {
        const { script, speechSpot, lineUp, ray } = this.level.trap;
        this.extras.forEach(extra => { if (extra.avatar == 'agent') extra.color = PIECES_INFO.kaiju.color; }); // the Agent glows purple (Jamie)
        this.lineUpTeam(lineUp);
        const [player, teammate] = this.getPieces();
        const [recruit] = this.getSpeakingFollowers();
        const shot = { isWide: true };
        const getName = ({ avatar }) => ROSTER.find(({ id }) => id == avatar).name;
        const getSpeaker = who => ({ player, teammate, recruit })[who];
        // with the log, the shots are on each speaker: the ray keeps the last one, rather than pull out
        let lastShot = shot;
        const clonesShot = { isWide: true }; // the clones stand by their tanks, along both sides: the whole lab shows them all
        const getStep = line => {
            const { who, text, phase, ray: isRay } = line;
            if (isRay) {
                const rayStep = { shot, ms: ray.ms, onStart: () => { if (getIsDialogueLog()) rayStep.shot = lastShot; this.fireRay(); } };
                return [rayStep];
            }
            const speaker = getSpeaker(who);
            const name = who == 'teammate' ? this.getTeammateName() : speaker && getName(speaker);
            const speech = speaker ? this.getSpeechOver(speaker, name, text) : this.getAgentSpeech(text, speechSpot);
            // once the beam has done its work, the glow is gone
            const step = { shot: getLineShot(line, { ...shot }), ms: getSpeechMs(text), phase, speech, onStart: () => { if (this.rayBeam) this.endRay(); lastShot = step.shot; } };
            // the clones step out: the camera goes up to them before anyone remarks on it
            return phase == 'clones' && getIsDialogueLog() ? [step, { shot: clonesShot, ms: CUTSCENE.clonesLookMs }, ...this.getClonesSweepSteps()] : [step];
        };
        this.startCutscene([
            ...script.filter(({ who, ifRecruits }) => (who != 'teammate' || !!teammate) && (!ifRecruits || !!recruit)).flatMap(getStep),
            { shot, ms: 0, onStart: this.startChase }
        ]);
    }

    // words over someone's head, with the balloon opening toward the middle of the scene
    // 'isAboveHead': over their head wherever they are, even near the top of the scene (in a close shot of them, the
    // whole scene isn't in view to be kept to: the Mermaid up on the Aquarium's top floor, Jamie)
    getSpeechOver(piece, name, text, { isAboveHead = false } = {}) {
        const { x, y } = piece.charLocation;
        const { rowStep, scale } = this.level.grid;
        // a longer balloon is taller, so it sits lower to stay in the shot
        const lineCount = Math.ceil(text.length / CUTSCENE.speechLineChars);
        const topY = isAboveHead ? -Infinity : CUTSCENE.speechTopY + Math.max(lineCount - CUTSCENE.speechShortLines, 0) * CUTSCENE.speechLinePx;
        return {
            name, text, x, y: Math.max(y - CUTSCENE.recruitSpeechRows * rowStep * scale, topY), isFlipped: x > this.level.world.width / 2,
            avatar: piece.avatar,
            speakerIndex: piece.pieceIndex, // their piece shakes while they talk
            focus: { x, y: y - CUTSCENE.shotHeadRows * rowStep * scale } // where a shot of the speaker looks
        };
    }

    // the Agent's words from his spot: with the log, the shot goes to him where he stands
    getAgentSpeech(text, speechSpot) {
        const agent = this.extras.find(extra => extra.avatar == 'agent');
        return agent ? { ...this.getSpeechOver(agent, 'Agent', text), ...speechSpot } : { name: 'Agent', text, avatar: 'agent', ...speechSpot };
    }

    // the teammate may have gone on ahead. after a beat the recruits catch up, the script plays, and it may end with the team walking on.
    startWalkInScene() {
        const { introSweep, teammateSpot, doorTile, standSpots, frontSpots, script, ending, reveal, talkBeatMs = 0, isWaitingToBePassed = false, isTeamInPlace = false, playerSpot } = this.level.walkIn;
        const [player, teammate] = this.getPieces();
        const hasTeammate = !!teammate && !this.followers.includes(teammate);
        const getTile = spot => this.gameBoardManager.getClosestWalkableTileToLocation(spot);
        const shot = { isWide: true };
        const getName = ({ avatar }) => ROSTER.find(({ id }) => id == avatar).name;

        if (hasTeammate && teammateSpot) {
            teammate.initCharLocation(true, getTile(teammateSpot));
            teammate.facingDir = 'down';
        }
        // they stay where they are until the player has gone past them
        if (isWaitingToBePassed) [...this.followers, ...(hasTeammate ? [teammate] : [])].forEach(piece => { piece.isWaitingToBePassed = true; });
        // the recruits: already resting in their places as the player comes in (Jamie), or else coming in at the door one by one
        const arrivals = isTeamInPlace ? [] : this.followers.map((piece, index) => {
            piece.initCharLocation(true, getTile(standSpots[index % standSpots.length]));
            piece.isVisible = false;
            piece.isTileHidden = true;
            return { shot, arrivals: [{ piece, startTile: doorTile, dir: 'downLeft' }] };
        });
        const { hazmatSpot } = this.level.walkIn;
        if (isTeamInPlace) this.followers.filter(piece => !(hazmatSpot && piece.avatar == 'hazmat')).forEach((piece, index) => {
            piece.initCharLocation(true, getTile(standSpots[index % standSpots.length]));
            piece.facingDir = 'downLeft';
        });
        // the Hazmat Worker's own spot, where the scene has one (Sewer 1: up the scene from the player, Jamie, playtest 18)
        if (isTeamInPlace && hazmatSpot) this.followers.filter(piece => piece.avatar == 'hazmat').forEach(piece => {
            piece.initCharLocation(true, getTile(hazmatSpot));
            piece.facingDir = 'downLeft';
        });
        // the player walks in at the door, the whole scene in view, before the words
        const playerWalkIn = isTeamInPlace && playerSpot ? [{ shot, arrivals: [{ piece: player, startTile: doorTile, toTile: getTile(playerSpot), dir: 'downLeft' }] }] : [];

        // recruits take turns. with no recruits, their lines are the player's.
        const speakers = this.getSpeakingFollowers().length ? this.getSpeakingFollowers() : [player];
        let recruitLines = 0;
        const getSpeech = ({ who, text }) => {
            if (who == 'teammate') return this.getSpeechOver(teammate, this.getTeammateName(), text);
            const speaker = who == 'player' ? player : speakers[recruitLines++ % speakers.length];
            return this.getSpeechOver(speaker, getName(speaker), text);
        };

        const pair = [player, teammate].filter(piece => !!piece && (piece == player || hasTeammate));
        // the two of them walk to the front of the group, where their words are in shot
        const frontSteps = !frontSpots ? [] : [
            // the team already in place: the two of them run in at the door, to the front
            { shot, arrivals: pair.map((piece, index) => ({
                piece, startTile: isTeamInPlace ? doorTile : undefined, toTile: getTile(frontSpots[index]), dir: 'downLeft',
                // the second a moment behind, and by a way of their own where there is one
                ...(index > 0 ? { delayTicks: WALK_IN.followDelayTicks, avoidPathOf: pair[0] } : {})
            })) },
            { shot, ms: 0, onStart: () => pair.forEach(piece => { piece.facingDir = 'downLeft'; }) }
        ];

        const endingSteps = !ending ? [] : [
            { shot, arrivals: pair.map((piece, index) => ({ piece, toTile: getTile(ending.spots[index]), dir: 'downLeft' })) },
            // the teammate, Guy or Girl, stands under the eye: they turn up and to the right, to touch it
            { shot, ms: ending.climaxMs, phase: ending.phase, onStart: () => { if (pair[1]) pair[1].facingDir = 'upRight'; } },
            { shot, ms: 0, onStart: () => { this.isSceneOver = true; } }
        ];

        // the way on lights up, someone remarks on it, and after a beat it opens
        // someone remarks on the glow; the camera goes to it and holds, the way on shows over it, then back to the player
        const glowShot = reveal && reveal.lookSpot && { point: reveal.lookSpot, zoomScale: DIALOGUE.speakerZoomScale, isCover: true };
        const backShot = { point: { x: player.charLocation.x, y: player.charLocation.y }, zoomScale: 1, isCover: true };
        const revealSteps = !reveal ? [] : glowShot ? [
            { shot, ms: CUTSCENE.revealGlowMs, phase: reveal.glowPhase },
            { shot, ms: getSpeechMs(reveal.line.text), speech: () => getSpeech(reveal.line) },
            { shot: glowShot, ms: CUTSCENE.pullInMs },
            // both holds can be skipped with 1 or Enter
            { shot: glowShot, ms: reveal.lookMs, isSkippable: true },
            { shot: glowShot, ms: reveal.labelMs, isSkippable: true, phase: reveal.shownPhase, onStart: () => this.setPhase(EXIT_OPEN_PHASE, true) }, // the door's label, over the glow
            { shot: { ...backShot, point: { ...player.charLocation } }, ms: CUTSCENE.pullInMs }
        ] : [
            { shot, ms: CUTSCENE.revealGlowMs, phase: reveal.glowPhase },
            { shot, ms: getSpeechMs(reveal.line.text), speech: () => ({ ...getSpeech(reveal.line), isShout: true }) },
            { shot, ms: reveal.beatMs },
            { shot, ms: 0, phase: reveal.shownPhase }
        ];

        this.startCutscene([
            { shot, ms: playerWalkIn.length ? 0 : CUTSCENE.pullInMs }, // walking in: straight away, and the words as they reach their spot
            ...arrivals,
            ...playerWalkIn,
            ...frontSteps,
            // a quiet moment, all in, before anyone speaks: the whole scene, or in close and along the resting recruits
            ...(introSweep ? [
                { shot: { point: introSweep.from, zoomScale: introSweep.zoomScale, panMs: introSweep.moveInMs }, ms: introSweep.moveInMs },
                { shot: { point: introSweep.to, zoomScale: introSweep.zoomScale, panMs: introSweep.panMs, ease: 'linear' }, ms: introSweep.panMs + introSweep.holdMs }
            ] : talkBeatMs ? [{ shot, ms: talkBeatMs }] : []),
            ...script
                .filter(({ who, ifRecruits }) => (who != 'teammate' || hasTeammate) && (!ifRecruits || this.followers.length > 0))
                .map(line => ({ shot: getLineShot(line, shot), ms: getSpeechMs(line.text), speech: () => getSpeech(line) })),
            ...revealSteps,
            ...endingSteps
        ]);
    }

    // the Agents burst in from below, in slow motion at first. the powers are gone, so the only way out is the door.
    // the recruits still have theirs: they stay and hold the Agents off while the player and teammate run.
    startChase = () => {
        const { chasers: { xs, startY, landingY, moveSpeed, abilities, dropFrom }, chaseLines } = this.level.trap;
        const team = this.gameBoardPiecesManager.getTeamPieces(this.gameBoardPiecesManager.getPlayerTeamIndex());
        const runners = team.filter(piece => !this.followers.includes(piece));
        runners.forEach(piece => { piece.abilities = []; });
        this.followers.forEach(piece => {
            const elements = this.getRecruitAbilityElements(piece.avatar);
            piece.abilities = elements ? this.settingsManager.getAbilitiesFromElements(elements) : [];
            piece.isRecruit = true;
            piece.isShowHealthBarOnComponent = false; // on the player's side, with HUDs of their own: no bar over their heads (Jamie)
        });
        this.isRecruitsFighting = this.followers.length > 0;
        // the teammate makes a run for the exit. the player has to follow.
        const exitTile = this.gameBoardManager.getClosestWalkableTileToLocation(this.level.exit.spot);
        runners.filter(piece => piece.isNpc).forEach(piece => { piece.escapeTile = exitTile; });
        if (chaseLines) this.sayDuringChase(chaseLines);
        // from the catwalk: the clones there are the ones who come (their sprites go as they drop); else from below
        const clones = dropFrom ? this.level.sceneElements.filter(({ id }) => dropFrom.cloneIds.includes(id)) : [];
        const starts = clones.length ? clones.map(({ x }) => ({ x, y: dropFrom.y })) : xs.map(x => ({ x, y: startY }));
        if (clones.length) this.setPhase(dropFrom.phase, true);
        starts.forEach(start => {
            const piece = this.gameBoardPiecesManager.addPiece({
                pieceClass: GameBoardPieceAgent,
                pieceInfo: { ...PIECES_INFO.agent, abilities: this.settingsManager.getAbilitiesFromElements(abilities), maxLives: 4, moveSpeed },
                teamIndex: 1
            });
            piece.color = PIECES_INFO.kaiju.color; // a sinister purple glow, like the Kaiju's (Jamie)
            piece.startChase({ startLocation: start, landingTile: this.gameBoardManager.getClosestWalkableTileToLocation({ x: start.x, y: landingY }) });
        });
        this.gameBoardManager.moveSpeedScale *= CUTSCENE.chaseSlowSpeed;
        this.isChaseSlowed = true;
        this.chaseSlowEndsAt = this.accTime + CUTSCENE.chaseSlowMs;
    }

    // words in the middle of the chase: the game doesn't stop for them. the teammate's are hurried, and tell the player what to do.
    sayDuringChase({ agent, teammate, teammateWithRecruits }) {
        const [, teammatePiece] = this.getPieces();
        const { speechSpot } = this.level.trap;
        const lines = [
            { name: 'Agent', text: agent, getSpot: () => speechSpot },
            ...(teammatePiece && !this.followers.includes(teammatePiece) ? [{ name: this.getTeammateName(), text: this.isRecruitsFighting ? teammateWithRecruits : teammate, piece: teammatePiece }] : [])
        ];
        let atMs = 1; // after the cutscene has cleared its own words
        lines.forEach(({ name, text, getSpot, piece }) => {
            this.timeoutHandler.registerTimeout(() => {
                this.speech = this.fillSpeech({ ...(piece ? this.getSpeechOver(piece, name, text) : { name, text, ...getSpot() }), isShout: true });
            }, atMs);
            atMs += getSpeechMs(text);
        });
        this.timeoutHandler.registerTimeout(() => { this.speech = null; }, atMs);
    }

    updateChaseSlowMotion() {
        if (this.accTime < this.chaseSlowEndsAt) return;
        this.gameBoardManager.moveSpeedScale /= CUTSCENE.chaseSlowSpeed;
        this.isChaseSlowed = false;
    }

    getPlayerColor() {
        return this.gameBoardPiecesManager.getPlayerPiece().getColor();
    }

    // dev and Lab: changes who is on the team, right away
    changeTeamAvatars(player, teammate) {
        const [playerPiece, teammatePiece] = this.gameBoardPiecesManager.getTeamPieces(this.gameBoardPiecesManager.getPlayerTeamIndex());
        this.settingsManager.updatePlayerAvatar(player);
        this.settingsManager.setTeammateAvatar(teammate);
        this.gameBoardPiecesManager.changeAvatar(playerPiece, player);
        if (teammatePiece) this.gameBoardPiecesManager.changeAvatar(teammatePiece, teammate);
    }

    updateSlowMotion() {
        if (this.level.isWalkingLevel) return;
        if (!this.isSlowMotion) {
            this.isSlowMotion = true;
            this.baseMoveSpeedScale = this.gameBoardManager.moveSpeedScale;
            if (this.trainSchedule) this.stopTrains();
            this.startOutcomeShot();
        }
        this.resultMs += GAME_TICK.pieceMs;
        const rampProgress = Math.min(Math.max((this.resultMs - CUTSCENE.slowMotionDelayMs) / CUTSCENE.slowMotionRampMs, 0), 1);
        this.timeScale = 1 - (1 - CUTSCENE.slowMotionSpeed) * rampProgress;
        this.gameBoardManager.moveSpeedScale = this.baseMoveSpeedScale * this.timeScale;
        this.gameBoardPiecesManager.movePieces({ accTime: this.accTime, playerInputHandler: this.playerInputHandler });
        this.updateOutcomeShot();
    }

    startOutcomeShot() {
        this.endTravelForScene();
        const deaths = this.getDeathPieces().filter(({ isKnockdown }) => !isKnockdown);
        const lastDeath = deaths[deaths.length - 1];
        if (!lastDeath) return;
        this.outcomeDeath = lastDeath;
        this.outcomeShot = { point: { ...this.getDeathLocation(lastDeath) }, zoomScale: PENINSULA.cameraZoom * CUTSCENE.outcomeZoomScale, panMs: CUTSCENE.outcomePullMs, isPeninsulaSized: true }; // every fight's last death: people as big on screen as at the Peninsula's
    }

    // the same shot, moved: a new shot would start the camera's pull again.
    // it eases after the body, so the shot tracks it without shaking along with each bounce.
    updateOutcomeShot() {
        if (!this.outcomeShot) return;
        const { point } = this.outcomeShot;
        const target = this.getDeathLocation(this.outcomeDeath);
        point.x += (target.x - point.x) * CUTSCENE.outcomeFollow;
        point.y += (target.y - point.y) * CUTSCENE.outcomeFollow;
    }

    // the fight is over: the train leaves, and no other comes
    stopTrains() {
        this.handleTrainStage('idle', this.accTime);
        this.gameBoardManager.setWalkableTiles(this.level.walkableTiles);
    }

    // the player and teammate stand over the beaten bystander: the player's choice, with the teammate back and to the left
    startRecruitScene() {
        this.endTravelForScene();
        this.logChain += 1;
        this.dialogueLog = []; // the words before the fight are done with: the log shows only what is said over the bystander
        const { avatar, pronoun, recruitSpot, isStandingBeside } = this.level.rival;
        const { rowStep, colStep, scale } = this.level.grid;
        const getTileNearSpot = (columns, rows) => this.gameBoardManager.getClosestWalkableTileToLocation({ x: recruitSpot.x + columns * colStep * scale, y: recruitSpot.y + rows * rowStep * scale });
        // standing beside them, they lie on a tile of their own, on the same row as the team: never across the scenery behind (the Rooftop's graves)
        const { x, y } = isStandingBeside ? getTileCenter(this.level.grid, getTileNearSpot(0, CUTSCENE.besideBodyRows)) : recruitSpot;
        const getTileNear = (columns, rows) => this.gameBoardManager.getClosestWalkableTileToLocation({ x: x + columns * colStep * scale, y: y + rows * rowStep * scale });
        const [player, teammate] = this.gameBoardPiecesManager.getTeamPieces(this.gameBoardPiecesManager.getPlayerTeamIndex());

        const stand = (piece, tile, facingDir = 'down') => {
            if (piece.getIsDead()) piece.respawn(this.accTime);
            piece.initCharLocation(true, tile);
            piece.facingDir = facingDir;
        };
        // 'beside': the teammate on the bystander's left and the player on the right, both turned to them
        if (isStandingBeside) {
            stand(player, getTileNear(CUTSCENE.besideColumns, 0), 'downLeft');
            if (teammate) stand(teammate, getTileNear(-CUTSCENE.besideColumns, 0), 'downRight');
        } else {
            stand(player, getTileNear(0, -CUTSCENE.recruitStandRows));
            if (teammate) stand(teammate, getTileNear(-3, -CUTSCENE.recruitStandRows));
        }
        // the recruits (Jamie): round the body too, each on a tile of their own, not over it
        const recruits = this.getPieces().filter(piece => piece.isRecruit && !piece.isDead);
        const bodyTile = this.gameBoardManager.getClosestWalkableTileToLocation({ x, y });
        const taken = new Set([player, teammate].filter(Boolean).map(piece => `${piece.getTileIndex().i} ${piece.getTileIndex().j}`).concat(`${bodyTile.i} ${bodyTile.j}`));
        const spots = isStandingBeside ? CUTSCENE.recruitSpotsBeside : CUTSCENE.recruitSpots;
        recruits.forEach((piece, k) => {
            const [columns, rows] = spots[k % spots.length];
            let tile = getTileNear(columns, rows);
            if (taken.has(`${tile.i} ${tile.j}`)) tile = this.gameBoardManager.getAdjacentTileIndices(tile).filter(this.gameBoardManager.getIsInBounds).find(next => !taken.has(`${next.i} ${next.j}`)) || tile;
            taken.add(`${tile.i} ${tile.j}`);
            stand(piece, tile, columns < 0 ? 'downRight' : 'downLeft');
        });
        // a clean field for the choice: no powers left on the tiles, and no portals
        this.gameBoardManager.getTilesInFlatArray().forEach(tile => tile.clearTileStatus());
        this.gameBoardManager.updateWormholes(Infinity);

        const zoomScale = this.level.cameraZoom * CUTSCENE.recruitZoomScale;
        const recruitLines = teammate ? getRecruitLines(pronoun, RECRUIT_ORDER.filter(id => id != avatar && getRecruitChoices()[id]).map(id => getRecruitChoices()[id])) : [];
        // with the log, the teammate's words go there, each once
        if (teammate && getIsDialogueLog()) this.addTalk(recruitLines.map(text => ({ name: this.getTeammateName(), text, avatar: teammate.avatar, speakerIndex: teammate.pieceIndex })), () => !!this.recruitScene);
        this.speech = teammate && !getIsDialogueLog() ? {
            name: this.getTeammateName(),
            lines: recruitLines.map(line => fillPronouns(line, player.avatar)),
            x: teammate.charLocation.x,
            y: teammate.charLocation.y - CUTSCENE.recruitSpeechRows * rowStep * scale,
            isFlipped: true
        } : null;
        // with the log, the buttons are on it: the shot moves in close on the team over the bystander
        const shot = getIsDialogueLog()
            ? { point: { x, y: y - (CUTSCENE.recruitStandRows / 2 + CUTSCENE.choiceShotLiftRows) * rowStep * scale }, zoomScale: DIALOGUE.choiceZoomScale, isCover: true, isCut: true }
            : { point: { x, y: y - CUTSCENE.recruitShotRows * rowStep * scale }, zoomScale, isCut: true };
        this.recruitScene = {
            shot,
            // drawn from their own sprite sheet, lying where they fell
            // a lying body draws a little above where it is placed: it is lowered onto the tile's ground, level with the team's feet
            body: { x, y: y + (isStandingBeside ? CUTSCENE.besideBodyDropRows * rowStep * scale : 0), avatar, spriteSheetSrc: this.rivalPiece && this.rivalPiece.spriteSheetSrc, color: this.rivalPiece && this.rivalPiece.color, isGhostForm: !!this.rivalPiece && !!this.rivalPiece.isGhostForm },
            prompt: { x: player.charLocation.x, y: player.charLocation.y - CUTSCENE.recruitButtonRows * rowStep * scale }
        };
    }

    // stepping on a level's hidden tile unlocks a character
    updateUnlock() {
        const { id, label, image, spot, afterMs = 0, isRecruit = false } = this.level.unlock;
        if (getUnlocks().includes(id) || !this.getIsTalkOver(afterMs)) return;
        const { i, j } = this.gameBoardManager.getClosestWalkableTileToLocation(spot);
        const tile = this.gameBoardPiecesManager.getPlayerPiece().getTileIndex();
        if (tile.i != i || tile.j != j) return;
        addUnlock(id);
        this.unlockMessage = isRecruit ? `${label} recruited!` : `${label} unlocked!`;
        this.unlockImage = image;
    }

    updateExit() {
        const { afterMs, afterPhase, isShownWhenOpen } = this.level.exit;
        const isOpening = !this.activePhases.has(EXIT_OPEN_PHASE) && ((afterMs < Infinity && this.getIsTalkOver(afterMs)) || this.activePhases.has(afterPhase));
        if (!isOpening) return;
        this.setPhase(EXIT_OPEN_PHASE, true);
        if (isShownWhenOpen) this.startExitLook();
    }

    // the way out has opened: the camera pans to it, then back to the player. never a pull out, however far away it is:
    // the pan just takes longer
    startExitLook() {
        const player = this.gameBoardPiecesManager.getPlayerPiece();
        const { rowStep, scale } = this.level.grid;
        const rows = Math.hypot(this.level.exit.spot.x - player.charLocation.x, this.level.exit.spot.y - player.charLocation.y) / (rowStep * scale);
        const panMs = CUTSCENE.pullInMs * Math.min(Math.max(rows / CUTSCENE.exitLookFarRows, 1), 2.2);
        const exitShot = { point: this.level.exit.spot, zoomScale: 1, isCover: true, panMs };
        const backShot = { point: { ...player.charLocation }, zoomScale: 1, isCover: true, panMs };
        this.startCutscene([
            { shot: exitShot, ms: panMs },
            { shot: exitShot, ms: CUTSCENE.exitLookMs, isSkippable: true },
            { shot: backShot, ms: panMs }
        ]);
    }

    // 'afterMs' is how long the scene's talk lasts as balloons. in the log, it waits for the talk itself.
    getIsTalkOver(afterMs) {
        if (!afterMs) return true;
        return getIsDialogueLog() ? this.getIsSceneTalkDone() : this.accTime >= afterMs;
    }

    // anywhere within a few rows counts: the spot is a place, not one exact tile
    getIsPlayerNear(spot, rows = TRIGGER_ROWS) {
        const { x, y } = getTileCenter(this.level.grid, this.gameBoardPiecesManager.getPlayerPiece().getTileIndex());
        const { rowStep, scale } = this.level.grid;
        return Math.hypot(x - spot.x, y - spot.y) <= rows * rowStep * scale;
    }

    // who the player plays as: their own piece, or the one they took over when it went down (updateTakeOver)
    getControlledPiece() {
        return this.controlledPiece || this.gameBoardPiecesManager.getPlayerPiece();
    }

    /*
        Dev option, on by default (Jamie, playtest 18): when the one the player plays as goes down, once the camera has held on
        their death, the player plays on as the next of the team still fighting, in the HUDs' order: the teammate, then
        the recruits as they came, the Hazmat Worker last. the keys 1 to 3 are that one's powers then.
    */
    updateTakeOver() {
        if (!this.isTakeOverOnDeath || this.level.isWalkingLevel || this.cutscene) return;
        const current = this.getControlledPiece();
        if (!current || !current.getIsDead()) return;
        if (this.takeOverAtMs === undefined) this.takeOverAtMs = Date.now() + CAMERA_THREATS.deathHoldMs;
        if (Date.now() < this.takeOverAtMs) return;
        this.takeOverAtMs = undefined;
        const next = this.getTakeOverOrder().find(piece => !piece.getIsDead() && piece.isOnTiles);
        if (!next) return;
        next.isNpc = false;
        next.moveToTiles = [];
        next.walkToTile = undefined;
        next.escapeTile = undefined;
        next.brainAction = undefined;
        this.controlledPiece = next;
        // a close-up on them, the fight held a moment, and its notice (Jamie, playtest 19)
        const name = next == this.gameBoardPiecesManager.getTeamPieces(this.gameBoardPiecesManager.getPlayerTeamIndex())[1] && !next.isRecruit
            ? this.getTeammateName() : ((ROSTER.find(({ id }) => id == next.avatar) || {}).name || (next.avatar == 'hazmat' ? 'Hazmat Worker' : next.avatar));
        this.takeOverText = `Now playing as ${name}`;
        this.takeOverCount = (this.takeOverCount || 0) + 1;
        const rowPx = this.getGhostRowPx();
        const closeOn = { point: { x: next.charLocation.x, y: next.charLocation.y - CUTSCENE.shotHeadRows * rowPx * 0.5 }, zoomScale: PENINSULA.cameraZoom * CUTSCENE.outcomeZoomScale * 0.8, isPeninsulaSized: true, panMs: TAKE_OVER.panMs };
        this.startCutscene([{ shot: closeOn, ms: TAKE_OVER.holdMs }], { isMidFight: true });
    }

    // the recruits who died in this fight (the permadeath dev option: gone for good)
    getFallenRecruits() {
        return this.getPieces().filter(piece => piece.isRecruit && piece.getIsDead()).map(({ avatar }) => avatar);
    }

    getTakeOverOrder() {
        const team = this.gameBoardPiecesManager.getTeamPieces(this.gameBoardPiecesManager.getPlayerTeamIndex());
        const recruits = team.filter(piece => piece.isRecruit);
        return [
            ...team.filter(piece => !piece.isRecruit),
            ...recruits.filter(piece => piece.avatar != 'hazmat'),
            ...recruits.filter(piece => piece.avatar == 'hazmat')
        ];
    }

    // who the camera stays with: the player, then their teammate once the player is down
    getFocusPiece() {
        const team = this.gameBoardPiecesManager.getTeamPieces(this.gameBoardPiecesManager.getPlayerTeamIndex());
        const controlled = this.controlledPiece && !this.controlledPiece.getIsDead() ? this.controlledPiece : undefined;
        // then a recruit still fighting (Jamie): the camera stays with the fight
        const next = controlled || team.find(piece => !piece.getIsDead() && !piece.isRecruit) || team.find(piece => !piece.getIsDead() && piece.isOnTiles) || this.getPieces()[0];
        // the one it was on has just died: it holds on them a while, for their death, before it moves on (Jamie)
        const last = this.lastFocusPiece;
        if (last && last !== next && last.getIsDead()) {
            if (this.focusHeldSinceMs === undefined) this.focusHeldSinceMs = Date.now();
            if (Date.now() - this.focusHeldSinceMs < CAMERA_THREATS.deathHoldMs) return last;
        }
        this.focusHeldSinceMs = undefined;
        this.lastFocusPiece = next;
        return next;
    }

    getIsAtGoal() {
        const { goalTiles, exit, sites = [] } = this.level;
        if (!this.getPieces().length) return false;
        if (this.isSceneOver) return true;
        sites.filter(({ spot }) => !this.getIsPlayerNear(spot, SITE_ROWS + 1)).forEach(site => this.armedSites.add(site));
        const site = sites.find(site => this.armedSites.has(site) && this.getIsPlayerNear(site.spot, SITE_ROWS));
        if (site) {
            this.reachedSite = site;
            return true;
        }
        if (exit && this.activePhases.has(EXIT_OPEN_PHASE) && this.getIsPlayerNear(exit.spot, exit.nearRows)) return true;
        // the recruit's training, once offered: its spot starts it (Game.tsx)
        if (this.level.training && this.activePhases.has(TRAINING_PHASE) && this.getIsPlayerNear(this.level.training.spot)) {
            this.isTrainingChosen = true;
            return true;
        }
        const piece = this.gameBoardPiecesManager.getPlayerPiece();
        const { i, j } = piece.getTileIndex();
        return piece.isThere && goalTiles.some(tile => tile.i == i && tile.j == j);
    }

    updateAgentDrops() {
        const { drops, firstDropMs, dropIntervalMs } = this.level.agentDrops;
        const isDue = this.accTime >= firstDropMs + this.agentsDropped * dropIntervalMs;
        if (this.agentsDropped < drops.length && isDue) this.addAgent(drops[this.agentsDropped]);
        this.updateCatwalkAgent();
    }

    addAgent({ x = 0, isFromLeft = false, standTile = undefined, kit = undefined }) {
        const { maxLives, moveSpeed, catwalkY, floorY } = this.level.agentDrops;
        const piece = this.gameBoardPiecesManager.addPiece({
            pieceClass: GameBoardPieceAgent,
            pieceInfo: {
                ...PIECES_INFO.agent,
                abilities: this.getAgentAbilities(kit),
                maxLives,
                moveSpeed
            },
            teamIndex: 1
        });
        piece.kit = kit;
        piece.getIsRunningAway = () => this.accTime < this.enemyPowersAtMs; // the head start: they scatter before they fight
        if (standTile) {
            piece.isEntering = false;
            piece.initCharLocation(true, standTile);
            return piece;
        }
        const offShot = 60;
        piece.startEntrance({
            startLocation: { x: isFromLeft ? -offShot : this.level.world.width + offShot },
            dropTile: this.gameBoardManager.getClosestWalkableTileToLocation({ x, y: catwalkY }),
            landingTile: this.gameBoardManager.getClosestWalkableTileToLocation({ x, y: floorY }),
            walkDir: isFromLeft ? 'downRight' : 'downLeft'
        });
        this.agentsDropped += 1;
        return piece;
    }

    getKillsToWin() {
        if (this.level.agentDrops) return this.level.agentDrops.drops.length + (this.level.showdown ? this.level.extras.length : 0);
        if (this.level.rival) return 1;
        return this.killsToWin || this.gameManagerProxy.determineKaijuDetails().MAX_TO_WIN;
    }

    // a dev playtest: some NPCs play by a trained model (npcBrain/npcModel.ts) instead of the rules
    setNpcModelDriver(driver) {
        if (this.npcModelDriver) this.npcModelDriver.stop();
        this.npcModelDriver = driver;
    }

    // who a trained model may play: people fighting on their own, not scripted ones
    getTrainablePieces = () => this.level.isWalkingLevel ? [] : this.getPieces().filter(piece =>
        piece.isNpc && piece.avatar != 'kaiju' && !piece.isChaser && !piece.escapeTile && !(piece instanceof GameBoardPieceExtra) && piece.abilities.length > 0);

    stepPieces() {
        if (this.isPaused || this.isEditingTiles) return;
        this.updateObjective();
        this.updateTakeOver();
        this.updateTrappedRival();
        this.updateRoamingRival();
        this.updateQueuedVisitScene();
        this.updateTalks();
        this.updateWalkers();
        if (this.recruitScene) return;
        this.autoSummonRecruits();
        if (this.isGhostScreamPending) this.startGhostScream();
        if (this.isShatterPending) this.startShatter();
        if (this.getIsTransforming() && !this.transformState && !this.cutscene && this.score >= this.getKillsToWin()) this.startTransformation();
        if (this.level.finalTurn && !this.finalTurnState && !this.cutscene && this.score >= this.getKillsToWin()) this.startFinalTurn();
        if (this.cutscene) {
            this.updateCutscene();
            return;
        }
        if (this.npcModelDriver && this.getGameResult() === null) this.npcModelDriver.step(this);
        this.stepRagdolls();
        this.updateKnockdowns();
        if (this.getGameResult() !== null) {
            this.updateSlowMotion();
            return;
        }
        if (this.wideShotMs > 0) {
            this.wideShotMs -= GAME_TICK.pieceMs;
            return;
        }
        if (this.holdMs > 0) {
            this.holdMs -= GAME_TICK.pieceMs;
            return;
        }
        this.accTime += GAME_TICK.pieceMs;
        this.liveWideShotMs = Math.max(this.liveWideShotMs - GAME_TICK.pieceMs, 0);
        if (this.isChaseSlowed) this.updateChaseSlowMotion();
        this.timeoutHandler.update(this.accTime);
        this.gameBoardManager.updateWormholes(this.accTime);
        if (this.trainSchedule) this.trainSchedule.update(this.accTime);
        if (this.level.kaijuEntry && !this.level.giantKaiju) this.kaijuManager.update(this.accTime, this.score); // the final battle's Kaiju come in waves
        if (this.level.rival) this.updateRival();
        if (this.level.agentDrops) this.updateAgentDrops();
        if (this.level.greeting) this.updateGreeting();
        if (this.level.unlock) this.updateUnlock();
        if (this.level.exit) this.updateExit();
        this.gameBoardPiecesManager.movePieces({ accTime: this.accTime, playerInputHandler: this.playerInputHandler });
        if (this.ghostRing) this.updateGhostRing();
        if (this.aquariumFlood) this.updateAquariumFlood();
        if (this.giant) this.updateFinalBattle();
        if (this.portalWalk) this.updatePortalTransit();
    }

    stepTiles() {
        if (this.isPaused || this.isEditingTiles || (this.cutscene && !this.getIsLiveCutscene()) || this.wideShotMs > 0 || this.getGameResult() !== null) return;
        this.gameBoardManager.updateTileState(this.accTime);
        if (this.cutscene) return; // the board moves in a live cutscene, but no one is hurt
        this.gameBoardPiecesManager.applyDmgFromTouchedTiles(this.accTime);
    }

    getGameResult() {
        // the last fight: won when the teammate, turned Kaiju, is down. until then, its Kaiju beaten is not the end.
        if (this.level.finalTurn) {
            if (this.gameBoardPiecesManager.getIsPlayerTeamDead()) return GameResult.PlayerLost; // the 30 beaten don't make it a win
            if (this.finalTurnState == 'destroyed' || this.finalTurnState == 'saved') return GameResult.PlayerWon; // the player turned, or fell before the end
            if (this.finalTurnState == 'fighting') return this.teammateKaiju.isDead ? GameResult.PlayerWon : null;
            if (this.score >= this.getKillsToWin()) return null;
        }
        // the Lab fight is won only once the teammate has transformed
        if (this.getIsTransforming() && this.transformState != 'done' && this.score >= this.getKillsToWin() && !this.gameBoardPiecesManager.getIsPlayerTeamDead()) return null;
        if (this.level.giantKaiju) {
            // drained and saved, or at the city; Kaiju killed along the way don't decide it
            if (this.isFinaleWon) return GameResult.PlayerWon;
            if ((this.giant && this.giant.getIsAtCity()) || this.gameBoardPiecesManager.getIsPlayerTeamDead()) return GameResult.PlayerLost;
            return null;
        }
        if (this.getIsAtGoal()) return GameResult.PlayerWon;
        if (this.score >= this.getKillsToWin()) return GameResult.PlayerWon;
        if (this.gameBoardPiecesManager.getIsPlayerTeamDead()) return GameResult.PlayerLost;
        return null;
    }

    getUiState() {
        return {
            players: this.gameBoardPiecesManager.getPlayerTeamUiState(),
            recruits: this.gameBoardPiecesManager.getRecruitsUiState(),
            kaijuKillCount: this.score,
            kaijuToWin: this.getKillsToWin(),
            // what the player is to do (Objectives.ts), as plain values: the store merges objects key by key
            objectiveText: this.objective ? this.objective.text : '',
            isObjectiveKaijuCount: !!this.objective && !!this.objective.isKaijuCount,
            objectiveCount: this.objectiveCount,
            takeOverCount: this.takeOverCount || 0,
            takeOverText: this.takeOverText || '',
            isPaused: this.isPaused,
            activePhases: this.getActivePhases(),
            isWideShot: this.getIsWideShot(),
            isCutscene: !!this.cutscene && !this.cutscene.isMidFight, // a mid-fight scene keeps the HUDs up
            unlockMessage: this.unlockMessage,
            unlockImage: this.unlockImage,
            speech: this.speech,
            recruitScene: this.recruitScene,
            dialogueLog: this.dialogueLog,
            isDialogueWaiting: this.getIsDialogueWaiting(),
            isTalking: this.getIsTalking(),
            isRecruitTalkDone: this.getIsRecruitTalkDone(),
            speakingPieceIndex: this.getSpeakingPieceIndex(),
            winner: this.getGameResult(),
            isPlayerDead: this.getControlledPiece().getIsDead()
        };
    }

    updateScore = (teamIndex) => {
        // what about charmed players?
        const playerTeamIndex = this.gameBoardPiecesManager.getPlayerTeamIndex();
        if (teamIndex != playerTeamIndex) {
            this.score += 1;
        }
    }

    togglePauseGame = () => {
        this.isPaused = !this.isPaused;
    }

    resetGame() {
        this.accTime = 0;
        this.score = 0;
        this.timeoutHandler.reset();
        this.gameBoardPiecesManager.resetPieces();
        this.kaijuManager.reset();
        this.gameBoardManager.resetTiles();
        this.playerInputHandler.resetPlayerAbilities();
    }

    updateProxyProps = () => {
        this.gameManagerProxy.updateProps({
            updateScore: this.updateScore,
            registerTimeout: this.timeoutHandler.registerTimeout,
            unregisterTimeout: this.timeoutHandler.unregisterTimeout,
            getAccTime: this.getAccTime,
            getAbilityAndTileStatusData: this.settingsManager.getAbilityAndTileStatusData,
            getKaijuAbilities: this.settingsManager.getKaijuAbilities,
            determineKaijuDetails: () => ({
                ...this.kaijuManager.determineKaijuDetailsFromDifficulty(this.settingsManager.getDifficulty()),
                ...(this.killsToWin ? { MAX_TO_WIN: this.killsToWin } : {})
            }),
            getTilesAround: tile => this.gameBoardManager.getAdjacentTileIndices(tile),
            getFlattenedArrayIndex: this.gameBoardManager.getFlattenedArrayIndex,
            getDmg: this.gameBoardManager.getDmg,
            getCharmingTeam: this.gameBoardManager.getCharmingTeam,
            clearTileStatusUnderPiece: this.gameBoardManager.clearTileStatusUnderPiece,
            getHasAllyOnBoard: this.gameBoardPiecesManager.getHasAllyOnBoard,
            getPathToClosestEnemy: this.gameBoardManager.getPathToClosestEnemy,
            getClosestEnemy: this.gameBoardManager.getClosestEnemy,
            getCharXAndYFromTileIndex: this.gameBoardManager.getCharXAndYFromTileIndex,
            getRandomTileIndexOnBoard: this.gameBoardManager.getRandomTileIndexOnBoard,
            getMoveOntoGameBoardMovementData: this.gameBoardManager.getMoveOntoGameBoardMovementData,
            moveTo: this.gameBoardManager.moveTo,
            getTileOffsetFromDir: this.gameBoardManager.getTileOffsetFromDir,
            getIsInBounds: this.gameBoardManager.getIsInBounds,
            getIsClosedTile: this.gameBoardManager.getIsClosedTile,
            getLinkedTile: this.gameBoardManager.getLinkedTile,
            getCrowdCosts: this.getCrowdCosts,
            getIsOffLimitsTile: (pieceIndex, tileIndex) => {
                if (!this.catwalkAgent) return false;
                const piece = this.gameBoardPiecesManager.getPiece(pieceIndex);
                // the talker, held up there, can't escape down before his clones
                if (piece == this.catwalkAgent && piece.isHeldOnCatwalk) return !this.getIsOnCatwalk(tileIndex);
                if (!this.getIsOnCatwalk(tileIndex)) return false;
                // the Agents keep off it; the talker too, once he has come down
                return !!piece && piece.teamIndex == this.catwalkAgent.teamIndex && !(piece == this.catwalkAgent && piece.isHeldOnCatwalk);
            },
            getGhostRingMove: this.getGhostRingMove,
            startPortalWalk: this.startPortalWalk,
            getTeleportAcross: this.getTeleportAcross,
            getClosestWalkableTile: tile => this.gameBoardManager.getClosestWalkableTile(tile),
            getZIndexAtLocation: this.gameBoardManager.getZIndexAtLocation,
            getIsBossThreatNear: this.getIsBossThreatNear,
            getIsTileOpenTo: this.getIsTileOpenTo,
            // the Aquarium's sea creatures keep to the flooded floor
            getIsStatusAllowedOn: (appliedStatus, tileIndex) => appliedStatus != 'isSeaGhost' || !this.level.flood || this.getIsFloodTile(tileIndex),
            getIsWormholeTile: ({ i, j }) => this.gameBoardManager.getWormholes().some(({ from, to }) => [from, to].some(end => end.i == i && end.j == j)),
            getSafeTileIndex: this.gameBoardManager.getSafeTileIndex,
            getHighlightedTiles: this.gameBoardManager.getHighlightedTiles,
            resetHightlightedTiles: this.gameBoardManager.resetHightlightedTiles,
            getClickedTileIndex: this.gameBoardManager.getClickedTileIndex,
            getHoveredTileIndex: this.gameBoardManager.getHoveredTileIndex,
            setClickedTileIndex: this.gameBoardManager.setClickedTileIndex,
            setHoveredTileIndex: this.gameBoardManager.setHoveredTileIndex,
            getIsPieceInDanger: this.gameBoardManager.getIsPieceInDanger,
            getIsPowersOff: this.getIsPowersOff,
            getIsTileTakenForSpacing: this.getIsTileTakenForSpacing,
            getIsTeamDamaged: this.gameBoardPiecesManager.getIsTeamDamaged,
            getIsPieceOnTile: this.gameBoardPiecesManager.getIsPieceOnTile,
            getIsContactDmg: this.gameBoardPiecesManager.getIsContactDmg,
            getPlayerPiece: this.gameBoardPiecesManager.getPlayerPiece,
            getControlledPiece: () => this.getControlledPiece(),
            findPathFromTo: this.gameBoardManager.findPathFromTo,
            getPathToSafeTileAndAvoidEnemies: this.gameBoardManager.getPathToSafeTileAndAvoidEnemies,
            getPathToSafeTile: this.gameBoardManager.getPathToSafeTile,
            clearClickedTileIndex: this.gameBoardManager.clearClickedTileIndex,
            getPathToTeamLeader: this.gameBoardManager.getPathToTeamLeader,
            getPathFromTileToTile: this.gameBoardManager.getPathFromTileToTile,
            spawnDeathPieceAtLocation: this.gameBoardPiecesManager.spawnDeathPieceAtLocation,
            getStatusDirs: this.gameBoardManager.getStatusDirs,
            getStatusCaster: this.gameBoardManager.getStatusCaster,
            addWormhole: this.gameBoardManager.addWormhole,
            useWormhole: this.gameBoardManager.useWormhole,
            getDirFromTiles: this.gameBoardManager.getDirFromTiles,
            getAreTilesAdjacent: (a, b) => this.gameBoardManager.getAreTilesAdjacent(a, b),
            updateTileWithAbilityStatus: this.gameBoardManager.updateTileWithAbilityStatus,
            getPieceTileIndex: this.gameBoardPiecesManager.getPieceTileIndex,
            getMostDmgedTeammate: this.gameBoardPiecesManager.getMostDmgedTeammate,
            getPiece: this.gameBoardPiecesManager.getPiece,
            addPiece: this.gameBoardPiecesManager.addPiece,
            getTeamPieces: this.gameBoardPiecesManager.getTeamPieces,
            getPieceTeamIndex: this.gameBoardPiecesManager.getPieceTeamIndex,
            getOtherTeamsPieces: this.gameBoardPiecesManager.getOtherTeamsPieces,
            getTeamLeaderPiece: this.gameBoardPiecesManager.getTeamLeaderPiece,
        });
    }

    // FUTURE FEATURE: "ZOOM MANAGER"
    zoomInToTile(zoomTile, desiredZoomOutInNumTilesFromZoomTile) { }
    resetZoom() {
        this.zoomLvl = ZoomLvl.NoZoom;
    }
    // - - - - - - - - - - - - -
}
