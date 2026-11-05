import { GameMode, GAME_TICK, PIECES_INFO, ZoomLvl } from 'Utils/gameState';
import { TimeoutHandler } from './TimeoutHandler';
import { GameManagerProxy } from './GameManagerProxy';
import { PlayerInputHandler } from './PlayerInputHandler';
import { SettingsManager } from './SettingsManager';
import { GameBoardPiecesManager } from './GameBoard/Pieces/GameBoardPiecesManager';
import { KaijuManager } from './KaijuManager';
import { GameBoardManager } from './GameBoard/GameBoardManager';
import { CHARACTER_FEET, CHARACTER_HEIGHT_PX, EXIT_OPEN_PHASE, getSortZIndex, LEVELS, PENINSULA, RIVAL_IN_PHASE } from 'Game/DataClasses/Levels/levels';
import { TrainSchedule, TRAIN_HIT } from './TrainSchedule';
import { GameBoardPieceAgent } from './GameBoard/Pieces/GameBoardPieceAgent';
import { GameBoardPieceExtra } from './GameBoard/Pieces/GameBoardPieceExtra';
import { WIDE_SHOT } from './Camera';
import { addUnlock, getRecruitChoices, getUnlocks } from './Unlocks';
import { ROSTER } from './Avatars';
import { getSpeechMs } from './speechTiming';
import { getTileCenter } from './GameBoard/hexGrid';
import { getTorsoSpot, startRagdoll, stepRagdoll } from './Ragdoll';
import { DIALOGUE, getIsClickThrough, getIsDialogueLog } from './DialogueLog';
import { getIsSpacing } from './SpacingTest';

export const GameResult = Object.freeze({
    PlayerWon: 0,
    PlayerLost: -1
});

// timing of the moments the game holds still for
const TRIGGER_ROWS = 2; // how close a door or a walk-here spot has to be
const SITE_ROWS = 3; // how close a site on the map has to be

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
  recruitShotRows: 3, // how far north of the bystander the camera looks
  recruitButtonRows: 3.6 // how far above the player the buttons sit
};

// a playtest: damaging tile statuses take the color of the side that cast them.
// the player's side (recruits too) uses the player's own color: blue for Guy, yellow for Girl.
export const TEAM_COLORS = {
    enemies: '#9b30ff'
};

// the Lab fight's Agents: three of these each, at random

const ARRIVAL_LINE = "Heads-up, teammate. They're coming!";

// before each Recruit or Terminate: what each choice means, a page at a time.
// the first time is as written. after that the teammate remembers the last choice, and then any pattern.
const POSSESSIVES = { him: 'his', her: 'her' };
const RECRUIT_ORDER = ['punk', 'black_female', 'mermaid']; // as they are met in the campaign
export const getRecruitLines = (pronoun, pastChoices = []) => {
    const his = POSSESSIVES[pronoun] || 'their';
    const him = pronoun;
    const last = pastChoices[pastChoices.length - 1];
    if (pastChoices.length >= 2 && pastChoices.every(choice => choice == last)) {
        return [
            `I guess we're going to ${last} ${him}, like the others?`,
            `Recruit ${him}, and the crew grows by one...`,
            `...or study ${his} DNA and take ${his} power. That would be fatal for ${him}.`
        ];
    }
    if (pastChoices.length >= 2) {
        return [
            'We have recruited, and we have terminated...',
            `Recruit ${him}, and we gain a crew member...`,
            `...or terminate ${him}, and harvest ${his} power.`
        ];
    }
    if (last == 'recruit') {
        return [
            'Another one... The last one joined the crew.',
            `We could recruit ${him} too, and grow the team...`,
            `...or study ${his} DNA and take ${his} power. That would be fatal for ${him}.`
        ];
    }
    if (last == 'terminate') {
        return [
            'Last time, we took the power for ourselves.',
            `We could study ${his} DNA again, and take ${his} power. It would be fatal for ${him}...`,
            `...or we could recruit ${him} onto the crew.`
        ];
    }
    return [`Maybe we could recruit ${him}...`, `...or we could study ${his} DNA to get ${his} power.`, `Though that would be fatal for ${him}.`];
};

// how much of a sprite frame's height the body fills (the hazmat sheet: about 137 of 200 pixels)
const WALKER_BODY_FRACTION = 0.69;
// what the piece component adds to every piece's z-index, so pieces sort with the scene's own layers
const PIECE_Z_BASE = 20001;

// A*'s extra cost of a tile, in steps: someone standing on it, or someone headed for it
const CROWD_COST = { standing: 3, headedFor: 1.5 };

// a train hit that doesn't kill: down this long as a ragdoll, then up again
const TRAIN_KNOCKDOWN = { downMs: 3000 };

export class GameManager {
    // 'returnSpot': back on a map walk from a site, the team starts beside it.
    // 'isRetry': the match is played again after a loss, so its opening scene is skipped.
    constructor({ level = PENINSULA, settingsManager, hasArrival = false, killsToWin = undefined, returnSpot = undefined, isRetry = false }) {
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
        return !!this.cutscene || !!this.recruitScene || this.isEditingTiles || this.wideShotMs > WIDE_SHOT.pullMs || this.liveWideShotMs > 0;
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
        return teamIndex == this.gameBoardPiecesManager.getPlayerTeamIndex() ? this.getPlayerColor() : TEAM_COLORS.enemies;
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
        if (mandatoryTeammateGamemodes.includes(gameMode) && this.settingsManager.getIsTeammate()) {
            const teammateAvatar = this.settingsManager.getTeammateAvatar();
            const teammateAbilities = this.settingsManager.getThreeRandomAbilities();

            // add teammate abilities to input handler to be triggered by keyboard keys
            teammateAbilities.forEach(a => this.playerInputHandler.addPlayerAbilities(a));

            // add teammate
            this.gameBoardPiecesManager.addTeammate({ teammateAvatar, teammateAbilities });
        }

        // must be set before calling updateBounds
        this.gameBoardManager.setUpdateProxyProps(this.updateProxyProps);

        this.gameBoardManager.updateBounds();

        this.gameBoardManager.initTiles();

        this.gameBoardPiecesManager.initPlayerLocationsOnBoard(this.returnSpot ? this.getReturnTiles(this.returnSpot) : this.level.spawnTiles);

        if (this.level.hasRecruitFollowers) this.addRecruitFollowers();
        if (this.level.extras) this.level.extras.forEach(extra => this.addExtra(extra));
        if (this.level.walkers) this.level.walkers.forEach(walker => this.addWalker(walker));
        if (getIsDialogueLog()) this.addSceneTalks();
        if (this.level.isDepowered) this.depowerPlayerTeam();

        if (this.hasArrival) this.startArrival();
        else if (this.level.rival) this.startRivalIntro();
        else if (this.level.isMapWalk) this.startMapIntro();
        else if (this.level.trap) this.startTrapScene();
        else if (this.level.showdown) this.startShowdown();
        else if (this.level.walkIn) this.startWalkInScene();
        else if (this.level.visitLines) this.startVisitScene();
        else if (this.level.greeting) this.startGreeting();
        if (this.isRetry && this.cutscene) this.skipCutscene();
    }

    // just outside a site's reach, toward the middle of the map, so the walk carries on from beside it
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
    addRival() {
        const { avatar, abilities, maxLives, moveSpeed, spot, startFacing, introSortY } = this.level.rival;
        const piece = this.gameBoardPiecesManager.addPiece({
            pieceInfo: {
                ...PIECES_INFO[avatar],
                abilities: this.settingsManager.getAbilitiesFromElements(abilities),
                maxLives,
                moveSpeed
            },
            teamIndex: 1
        });
        piece.initCharLocation(true, this.gameBoardManager.getClosestWalkableTileToLocation(spot));
        piece.isPlain = true; // no glow until they touch the part
        piece.isTileHidden = true;
        piece.facingDir = startFacing;
        piece.introZIndex = getSortZIndex(this.level, introSortY);
        this.rivalPiece = piece;
    }

    // a recruit called in to help: they fight beside the team with the powers they had as a rival
    callRecruit = (avatar) => {
        if (this.isPaused || this.cutscene || this.recruitScene || this.getGameResult() !== null) return false;
        const rivalLevel = Object.values(LEVELS).find(({ rival }) => rival && rival.avatar == avatar);
        if (!rivalLevel) return false;
        const piece = this.gameBoardPiecesManager.addRecruit(avatar, this.settingsManager.getAbilitiesFromElements(rivalLevel.rival.abilities));
        const player = this.gameBoardPiecesManager.getPlayerPiece();
        const [besidePlayer] = this.gameBoardManager.getAdjacentTileIndices(player.getTileIndex()).filter(this.gameBoardManager.getIsInBounds);
        piece.initCharLocation(true, besidePlayer || player.getTileIndex());
        return true;
    }

    // placed by their feet, wherever they stand, tile or no tile
    addExtra({ avatar, spot, facingDir }) {
        const piece = this.gameBoardPiecesManager.addPiece({
            pieceClass: GameBoardPieceExtra,
            pieceInfo: { ...PIECES_INFO[avatar], abilities: [] },
            teamIndex: 1
        });
        const tileIndex = this.gameBoardManager.getClosestWalkableTileToLocation(spot);
        const center = getTileCenter(this.level.grid, tileIndex);
        const { x, y } = this.gameBoardManager.getCharXAndYFromTileIndex(tileIndex);
        piece.place({ charLocation: { x: x + spot.x - center.x, y: y + spot.y - center.y }, tileIndex, facingDir });
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

    addRecruitFollowers() {
        const playerTile = this.gameBoardPiecesManager.getPlayerPiece().getTileIndex();
        Object.entries(getRecruitChoices())
            .filter(([, choice]) => choice == 'recruit')
            .forEach(([avatar]) => this.followers.push(this.gameBoardPiecesManager.addFollower(avatar, playerTile)));
    }

    getCameraShot() {
        if (this.recruitScene) return this.recruitScene.shot;
        if (this.cutscene) return this.cutscene.steps[this.cutscene.index].shot;
        return this.outcomeShot || this.knockShot; // the player knocked down by the train: in close on them
    }

    getTimeScale = () => {
        return this.timeScale;
    }

    // hit by the train and still standing: thrown as a ragdoll, down a moment, then up where they landed and on with the fight
    knockDown(piece, hitAt) {
        const side = piece.charLocation.x >= hitAt.x ? 1 : -1; // flung the way they were pushed off the tracks
        const knock = {
            key: `knock ${piece.pieceIndex} ${this.accTime}`, charLocation: hitAt, avatar: piece.avatar, zIndex: piece.getZIndex(), color: piece.color,
            pieceIndex: piece.pieceIndex, throwVec: { x: side, y: -0.35 }, spriteSheetSrc: piece.spriteSheetSrc, body: undefined,
            isKnockdown: true, upAt: this.accTime + TRAIN_KNOCKDOWN.downMs
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

    // up again: where the body came to rest, on the nearest tile
    updateKnockdowns() {
        const deaths = this.gameBoardPiecesManager.deathPieces;
        deaths.filter(({ isKnockdown, upAt }) => isKnockdown && this.accTime >= upAt).forEach(knock => {
            const piece = this.gameBoardPiecesManager.getPiece(knock.pieceIndex);
            if (piece && !piece.isDead) {
                piece.initCharLocation(true, this.gameBoardManager.getClosestWalkableTileToLocation(this.getDeathLocation(knock)));
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

    startCutscene(steps) {
        // in the log, a conversation in a wide shot cuts to each speaker: first it holds on the whole scene
        const [first] = steps;
        if (getIsDialogueLog() && first && first.speech && first.shot && first.shot.isWide) steps = [{ shot: { isWide: true }, ms: DIALOGUE.establishMs }, ...steps];
        this.cutscene = { steps, index: -1, msLeft: 0 };
        this.nextCutsceneStep();
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
        this.speech = (typeof step.speech == 'function' ? step.speech() : step.speech) || null;
        if (this.speech && getIsDialogueLog() && !this.speech.isShout) {
            // the line goes to the log, not a balloon. the shot goes to the speaker, if it was the whole scene.
            this.speech = { ...this.speech, isLogged: true };
            this.addToLog(this.speech);
            // 'isCover': the zoom is from the screen filled, not from the whole scene fitted in it
            if (step.shot && step.shot.isWide && this.speech.focus) step.shot = { point: this.speech.focus, zoomScale: DIALOGUE.speakerZoomScale, isCover: true };
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
    startPieceArrival({ piece, startTile, toTile, dir }) {
        const start = startTile ? this.gameBoardManager.getCharXAndYFromTileIndex(startTile) : piece.charLocation;
        const fromTile = startTile || piece.getTileIndex();
        if (toTile) piece.initCharLocation(true, this.getUnclaimedTile(piece, toTile));
        const isOnTiles = fromTile && this.gameBoardManager.getIsInBounds(fromTile) && this.gameBoardManager.getIsInBounds(piece.getTileIndex());
        const path = isOnTiles ? this.gameBoardManager.findPathFromTo(fromTile, piece.getTileIndex(), undefined, false, piece.pieceIndex) : [];
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

    // who said it, for the log's color and portrait
    addToLog({ name, text, avatar }) {
        const player = this.gameBoardPiecesManager.getPlayerPiece();
        const who = avatar == 'agent' ? 'agent' : name == this.getTeammateName() ? 'teammate' : player && avatar == player.avatar ? 'player' : 'other';
        this.dialogueLog = [...this.dialogueLog, { key: this.dialogueLog.length, who, name, text, avatar, chain: this.logChain }];
    }

    // a scene's speech elements go to the log, while their phase is on (and before their 'hidePhase')
    addSceneTalks() {
        this.level.sceneElements.filter(({ type }) => type == 'speech').forEach(({ name = 'Agent', lines, phase, hidePhase }) => {
            // a scene that opens with a call waits for the team to come over
            const isActive = () => !this.cutscene && (!this.level.greeting || this.isGreetingAnswered) && (!phase || this.activePhases.has(phase)) && !(hidePhase && this.activePhases.has(hidePhase));
            const agent = name == 'Agent' ? this.extras.find(extra => extra.avatar == 'agent') : undefined;
            this.addTalk(lines.map(text => ({ name, text, avatar: name == 'Agent' ? 'agent' : undefined, speakerIndex: agent && agent.pieceIndex })), isActive, !!phase || !!hidePhase);
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
        const step = cutscene.steps[cutscene.index];
        if (step.arrivals) {
            step.arrivals = step.arrivals.filter(({ piece }) => !piece.stepArrival());
            if (!step.arrivals.length) this.nextCutsceneStep();
            return;
        }
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
                { shot: heldShot, ms: getSpeechMs(ARRIVAL_LINE), speech: { name: this.getTeammateName(), text: ARRIVAL_LINE, x, y: y - CUTSCENE.recruitSpeechRows * rowStep * scale, isShout: true } }
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
            const speech = { name: this.getTeammateName(), text, x, y: y - CUTSCENE.recruitSpeechRows * rowStep * scale, avatar: teammate.avatar };
            return [
                { shot: teammateShot, ms: CUTSCENE.pullInMs },
                { shot: teammateShot, ms: getSpeechMs(text), speech },
                { shot, ms: CUTSCENE.pullInMs }
            ];
        };

        this.startCutscene([
            { shot: { isWide: true }, ms: CUTSCENE.wideMs },
            { shot, ms: CUTSCENE.pullInMs },
            ...lines.flatMap(({ isTeammate, name, text, isFlipped }) => isTeammate ? getTeammateSteps(text) : [
                { shot, ms: getSpeechMs(text), speech: { ...this.getSpeechOver(rival, name, text), isFlipped } }
            ]),
            { shot: isTouchWide ? { isWide: true } : shot, ms: CUTSCENE.touchMs, phase: touchPhase, onStart: () => { rival.isPlain = false; } },
            ...(afterTouch ? [
                { shot: closeShot({ x: rival.charLocation.x, y: rival.charLocation.y }), ms: CUTSCENE.pullInMs },
                { shot: closeShot({ x: rival.charLocation.x, y: rival.charLocation.y }), ms: getSpeechMs(afterTouch.text), speech: () => this.getSpeechOver(rival, afterTouch.name, afterTouch.text) }
            ] : [])
        ]);
    }

    // the whole scene, in on the Agent for his call, then back to the team, as at the train.
    // he calls again ('repeatMs' later) until the team is near him: each call takes the camera and the controls for a moment.
    startGreeting(isRepeat = false) {
        const { text, speechSpot, repeatMs } = this.level.greeting;
        const speech = { ...this.getAgentSpeech(text, speechSpot), isShout: true }; // a call across the street: a balloon, not the log
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

    // a battleground won on before, visited from the map: the teammate has a word, then it's a walk
    startVisitScene() {
        const [, teammate] = this.gameBoardPiecesManager.getTeamPieces(this.gameBoardPiecesManager.getPlayerTeamIndex());
        if (!teammate) return;
        this.startCutscene(this.level.visitLines.map(text => ({ shot: { isWide: true }, ms: getSpeechMs(text), speech: this.getSpeechOver(teammate, this.getTeammateName(), text) })));
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
                .map(line => ({ shot, ms: getSpeechMs(line.text), speech: getSpeech(line) })),
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
            const floorTile = extra.getTileIndex();
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

    // the kit's three powers
    getAgentAbilities(kit) {
        return this.settingsManager.getAbilitiesFromElements(this.level.agentDrops.kits[kit]);
    }

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
        agent.dropDown(this.gameBoardManager.getClosestWalkableTileToLocation({ x: agent.charLocation.x, y: floorY }));
    }

    // everyone stands facing the Agent while he has his say, each line once, and then the chase is on
    // the team in a row before the Agent, each on their own tile, all facing him
    lineUpTeam({ y, spacing }) {
        const { x } = this.level.trap.speechSpot;
        const team = this.gameBoardPiecesManager.getTeamPieces(this.gameBoardPiecesManager.getPlayerTeamIndex());
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

    startTrapScene() {
        const { script, speechSpot, lineUp, ray } = this.level.trap;
        this.lineUpTeam(lineUp);
        const [player, teammate] = this.getPieces();
        const [recruit] = this.followers;
        const shot = { isWide: true };
        const getName = ({ avatar }) => ROSTER.find(({ id }) => id == avatar).name;
        const getSpeaker = who => ({ player, teammate, recruit })[who];
        // with the log, the shots are on each speaker: the ray keeps the last one, rather than pull out
        let lastShot = shot;
        const clonesShot = { isWide: true }; // the clones stand by their tanks, along both sides: the whole lab shows them all
        const getStep = ({ who, text, phase, ray: isRay }) => {
            if (isRay) {
                const rayStep = { shot, ms: ray.ms, onStart: () => { if (getIsDialogueLog()) rayStep.shot = lastShot; this.fireRay(); } };
                return [rayStep];
            }
            const speaker = getSpeaker(who);
            const name = who == 'teammate' ? this.getTeammateName() : speaker && getName(speaker);
            const speech = speaker ? this.getSpeechOver(speaker, name, text) : this.getAgentSpeech(text, speechSpot);
            // once the beam has done its work, the glow is gone
            const step = { shot: { ...shot }, ms: getSpeechMs(text), phase, speech, onStart: () => { if (this.rayBeam) this.endRay(); lastShot = step.shot; } };
            // the clones step out: the camera goes up to them before anyone remarks on it
            return phase == 'clones' && getIsDialogueLog() ? [step, { shot: clonesShot, ms: CUTSCENE.clonesLookMs }] : [step];
        };
        this.startCutscene([
            ...script.filter(({ who, ifRecruits }) => (who != 'teammate' || !!teammate) && (!ifRecruits || !!recruit)).flatMap(getStep),
            { shot, ms: 0, onStart: this.startChase }
        ]);
    }

    // words over someone's head, with the balloon opening toward the middle of the scene
    getSpeechOver(piece, name, text) {
        const { x, y } = piece.charLocation;
        const { rowStep, scale } = this.level.grid;
        // a longer balloon is taller, so it sits lower to stay in the shot
        const lineCount = Math.ceil(text.length / CUTSCENE.speechLineChars);
        const topY = CUTSCENE.speechTopY + Math.max(lineCount - CUTSCENE.speechShortLines, 0) * CUTSCENE.speechLinePx;
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
        const { teammateSpot, doorTile, standSpots, frontSpots, script, ending, reveal, talkBeatMs = 0, isWaitingToBePassed = false } = this.level.walkIn;
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
        const arrivals = this.followers.map((piece, index) => {
            piece.initCharLocation(true, getTile(standSpots[index % standSpots.length]));
            piece.isVisible = false;
            piece.isTileHidden = true;
            return { shot, arrivals: [{ piece, startTile: doorTile, dir: 'downLeft' }] };
        });

        // recruits take turns. with no recruits, their lines are the player's.
        const speakers = this.followers.length ? this.followers : [player];
        let recruitLines = 0;
        const getSpeech = ({ who, text }) => {
            if (who == 'teammate') return this.getSpeechOver(teammate, this.getTeammateName(), text);
            const speaker = who == 'player' ? player : speakers[recruitLines++ % speakers.length];
            return this.getSpeechOver(speaker, getName(speaker), text);
        };

        const pair = [player, teammate].filter(piece => !!piece && (piece == player || hasTeammate));
        // the two of them walk to the front of the group, where their words are in shot
        const frontSteps = !frontSpots ? [] : [
            { shot, arrivals: pair.map((piece, index) => ({ piece, toTile: getTile(frontSpots[index]), dir: 'downLeft' })) },
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
            { shot, ms: CUTSCENE.pullInMs },
            ...arrivals,
            ...frontSteps,
            ...(talkBeatMs ? [{ shot, ms: talkBeatMs }] : []), // a quiet moment, all in, before anyone speaks
            ...script
                .filter(({ who, ifRecruits }) => (who != 'teammate' || hasTeammate) && (!ifRecruits || this.followers.length > 0))
                .map(line => ({ shot, ms: getSpeechMs(line.text), speech: () => getSpeech(line) })),
            ...revealSteps,
            ...endingSteps
        ]);
    }

    // the Agents burst in from below, in slow motion at first. the powers are gone, so the only way out is the door.
    // the recruits still have theirs: they stay and hold the Agents off while the player and teammate run.
    startChase = () => {
        const { chasers: { xs, startY, landingY, moveSpeed, abilities }, chaseLines } = this.level.trap;
        const team = this.gameBoardPiecesManager.getTeamPieces(this.gameBoardPiecesManager.getPlayerTeamIndex());
        const runners = team.filter(piece => !this.followers.includes(piece));
        runners.forEach(piece => { piece.abilities = []; });
        this.followers.forEach(piece => {
            const rivalLevel = Object.values(LEVELS).find(({ rival }) => rival && rival.avatar == piece.avatar);
            piece.abilities = rivalLevel ? this.settingsManager.getAbilitiesFromElements(rivalLevel.rival.abilities) : [];
            piece.isRecruit = true;
            piece.isShowHealthBarOnComponent = true;
        });
        this.isRecruitsFighting = this.followers.length > 0;
        // the teammate makes a run for the exit. the player has to follow.
        const exitTile = this.gameBoardManager.getClosestWalkableTileToLocation(this.level.exit.spot);
        runners.filter(piece => piece.isNpc).forEach(piece => { piece.escapeTile = exitTile; });
        if (chaseLines) this.sayDuringChase(chaseLines);
        xs.forEach(x => {
            const piece = this.gameBoardPiecesManager.addPiece({
                pieceClass: GameBoardPieceAgent,
                pieceInfo: { ...PIECES_INFO.agent, abilities: this.settingsManager.getAbilitiesFromElements(abilities), maxLives: 4, moveSpeed },
                teamIndex: 1
            });
            piece.startChase({ startLocation: { x, y: startY }, landingTile: this.gameBoardManager.getClosestWalkableTileToLocation({ x, y: landingY }) });
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
                this.speech = { ...(piece ? this.getSpeechOver(piece, name, text) : { name, text, ...getSpot() }), isShout: true };
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
        // a clean field for the choice: no powers left on the tiles, and no portals
        this.gameBoardManager.getTilesInFlatArray().forEach(tile => tile.clearTileStatus());
        this.gameBoardManager.updateWormholes(Infinity);

        const zoomScale = this.level.cameraZoom * CUTSCENE.recruitZoomScale;
        const recruitLines = teammate ? getRecruitLines(pronoun, RECRUIT_ORDER.filter(id => id != avatar && getRecruitChoices()[id]).map(id => getRecruitChoices()[id])) : [];
        // with the log, the teammate's words go there, each once
        if (teammate && getIsDialogueLog()) this.addTalk(recruitLines.map(text => ({ name: this.getTeammateName(), text, avatar: teammate.avatar, speakerIndex: teammate.pieceIndex })), () => !!this.recruitScene);
        this.speech = teammate && !getIsDialogueLog() ? {
            name: this.getTeammateName(),
            lines: recruitLines,
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
            body: { x, y: y + (isStandingBeside ? CUTSCENE.besideBodyDropRows * rowStep * scale : 0), avatar, spriteSheetSrc: this.rivalPiece && this.rivalPiece.spriteSheetSrc, color: this.rivalPiece && this.rivalPiece.color },
            prompt: { x: player.charLocation.x, y: player.charLocation.y - CUTSCENE.recruitButtonRows * rowStep * scale }
        };
    }

    // stepping on a level's hidden tile unlocks a character
    updateUnlock() {
        const { id, label, image, spot, afterMs = 0 } = this.level.unlock;
        if (getUnlocks().includes(id) || !this.getIsTalkOver(afterMs)) return;
        const { i, j } = this.gameBoardManager.getClosestWalkableTileToLocation(spot);
        const tile = this.gameBoardPiecesManager.getPlayerPiece().getTileIndex();
        if (tile.i != i || tile.j != j) return;
        addUnlock(id);
        this.unlockMessage = `${label} unlocked!`;
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

    // who the camera stays with: the player, then their teammate once the player is down
    getFocusPiece() {
        const team = this.gameBoardPiecesManager.getTeamPieces(this.gameBoardPiecesManager.getPlayerTeamIndex());
        return team.find(piece => !piece.getIsDead() && !piece.isRecruit) || this.getPieces()[0];
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
        this.updateTalks();
        this.updateWalkers();
        if (this.recruitScene) return;
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
        if (this.level.kaijuEntry) this.kaijuManager.update(this.accTime, this.score);
        if (this.level.rival) this.updateRival();
        if (this.level.agentDrops) this.updateAgentDrops();
        if (this.level.greeting) this.updateGreeting();
        if (this.level.unlock) this.updateUnlock();
        if (this.level.exit) this.updateExit();
        this.gameBoardPiecesManager.movePieces({ accTime: this.accTime, playerInputHandler: this.playerInputHandler });
    }

    stepTiles() {
        if (this.isPaused || this.isEditingTiles || this.cutscene || this.wideShotMs > 0 || this.getGameResult() !== null) return;
        this.gameBoardManager.updateTileState(this.accTime);
        this.gameBoardPiecesManager.applyDmgFromTouchedTiles(this.accTime);
    }

    getGameResult() {
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
            isPaused: this.isPaused,
            activePhases: this.getActivePhases(),
            isWideShot: this.getIsWideShot(),
            isCutscene: !!this.cutscene,
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
            isPlayerDead: this.gameBoardPiecesManager.getPlayerPiece().getIsDead()
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
                return !!piece && piece.teamIndex == this.catwalkAgent.teamIndex && piece != this.catwalkAgent;
            },
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
            getDirFromTiles: this.gameBoardManager.getDirFromTiles,
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
