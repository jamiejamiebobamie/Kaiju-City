import { GameMode, GAME_TICK, PIECES_INFO, ZoomLvl } from 'Utils/gameState';
import { TimeoutHandler } from './TimeoutHandler';
import { GameManagerProxy } from './GameManagerProxy';
import { PlayerInputHandler } from './PlayerInputHandler';
import { SettingsManager } from './SettingsManager';
import { GameBoardPiecesManager } from './GameBoard/Pieces/GameBoardPiecesManager';
import { KaijuManager } from './KaijuManager';
import { GameBoardManager } from './GameBoard/GameBoardManager';
import { EXIT_OPEN_PHASE, getSortZIndex, LEVELS, PENINSULA, RIVAL_IN_PHASE } from 'Game/DataClasses/Levels/levels';
import { TrainSchedule, TRAIN_HIT } from './TrainSchedule';
import { GameBoardPieceAgent } from './GameBoard/Pieces/GameBoardPieceAgent';
import { GameBoardPieceExtra } from './GameBoard/Pieces/GameBoardPieceExtra';
import { WIDE_SHOT } from './Camera';
import { addUnlock, getRecruitChoices, getUnlocks } from './Unlocks';
import { ROSTER } from './Avatars';
import { getSpeechMs } from './speechTiming';
import { getTileCenter } from './GameBoard/hexGrid';
import { startRagdoll, stepRagdoll } from './Ragdoll';

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
  slowMotionSpeed: 0.2,
  slowMotionDelayMs: 350, // full speed for a moment, so the last explosion or throw gets going
  slowMotionRampMs: 500, // then it eases down to slow motion
  outcomeZoomScale: 1.25, // the end-of-fight shot is a little closer than play
  outcomePullMs: 900,
  chaseSlowSpeed: 0.35,
  chaseSlowMs: 2800,
  mapWideMs: 2400,
  recruitZoomScale: 1.3,
  recruitSpeechRows: 3.4, // how far above a character their words sit
  speechTopY: 200, // words sit no higher than this, or they would go off the top of a wide shot or under the top buttons
  speechLineChars: 15, // about this many letters fit on a balloon's line
  speechShortLines: 3, // a balloon of up to this many lines fits under 'speechTopY'
  speechLinePx: 40, // each line past that sits it this much lower, in scene pixels
  shotHeadRows: 1.5,
  recruitStandRows: 2, // how far north of the beaten bystander they stand
  recruitShotRows: 3, // how far north of the bystander the camera looks
  recruitButtonRows: 3.6 // how far above the player the buttons sit
};

// a playtest: tile statuses take the color of the side that cast them
export const TEAM_COLORS = {
    kaiju: '#9b30ff',
    playerTeam: '#5b8fd9', // a light navy
    agents: '#e0201b'
};

// the Lab fight's Agents: three of these each, at random
const AGENT_POWER_POOL = ['ice', 'fire', 'water', 'wood', 'lightning', 'death', 'bubble', 'metal', 'glass', 'love', 'charm', 'kaijuFire'];
const AGENT_POWER_COUNT = 3;

const ARRIVAL_LINE = "Heads-up, teammate. They're coming!";

// before each Recruit or Terminate: what each choice means
const POSSESSIVES = { him: 'his', her: 'her' };
export const getRecruitLine = (pronoun) => {
    const possessive = POSSESSIVES[pronoun] || 'their';
    return `Maybe we could recruit ${pronoun}... or we could study ${possessive} DNA to get ${possessive} power. Though that would be fatal for ${pronoun}.`;
};

export class GameManager {
    constructor({ level = PENINSULA, settingsManager, hasArrival = false, killsToWin = undefined }) {
        this.killsToWin = killsToWin;
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
        this.outcomeShot = undefined; // once the fight is decided, the camera stays on the death that decided it
        this.isChaseSlowed = false;
        this.chaseSlowEndsAt = 0;
        this.followers = []; // recruits walking with the team
        this.extras = []; // people standing in the scene
        this.isSceneOver = false; // a scripted scene has played out, and the level ends
        this.agentsDropped = 0;
        this.wideShotMs = 0; // what is left of the current wide shot. the game holds still during it.
        this.liveWideShotMs = 0; // what is left of a wide shot the game keeps running through
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

    // the camera starts its move back in before the game resumes
    getIsWideShot = () => {
        const isAgentEntering = this.getPieces().some(({ isEntering, isDead }) => isEntering && !isDead);
        return !!this.cutscene || !!this.recruitScene || this.isEditingTiles || this.wideShotMs > WIDE_SHOT.pullMs || this.liveWideShotMs > 0 || isAgentEntering;
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
        if (stage == 'warning') this.closeTracks();
        const isTrainIn = stage == 'train';
        if (isTrainIn == this.activePhases.has('train')) return;

        this.setPhase('train', isTrainIn);
        if (isTrainIn) {
            this.closeTracks();
            this.gameBoardPiecesManager.updatePiecesForWalkableTiles(piece => {
                piece.hitByTrain(accTime, TRAIN_HIT, this.gameBoardManager.getClosestWalkableTile(piece.getTileIndex()));
            });
        } else {
            this.gameBoardManager.setWalkableTiles(walkableTiles);
        }
    }

    // undefined for a status no one is known to have cast: it keeps its power's color
    getStatusTeamColor = (casterIndex) => {
        const caster = this.getPieces()[casterIndex];
        if (!caster) return undefined;
        if (caster.avatar == 'kaiju') return TEAM_COLORS.kaiju;
        if (caster.avatar == 'agent') return TEAM_COLORS.agents;
        const isPlayerSide = caster.homeTeamIndex == this.gameBoardPiecesManager.getPlayerTeamIndex();
        // recruits and the bystanders they once were: their own color
        return caster.isRecruit || !isPlayerSide ? caster.getColor() : TEAM_COLORS.playerTeam;
    }

    getWormholes() {
        return this.gameBoardManager.getWormholes();
    }

    getSoapyTiles() {
        return this.gameBoardManager.getSoapyTiles();
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

        this.gameBoardPiecesManager.initPlayerLocationsOnBoard(this.level.spawnTiles);

        if (this.level.hasRecruitFollowers) this.addRecruitFollowers();
        if (this.level.extras) this.level.extras.forEach(extra => this.addExtra(extra));

        if (this.hasArrival) this.startArrival();
        else if (this.level.rival) this.startRivalIntro();
        else if (this.level.isMapWalk) this.startMapIntro();
        else if (this.level.trap) this.startTrapScene();
        else if (this.level.showdown) this.startShowdown();
        else if (this.level.walkIn) this.startWalkInScene();
        else if (this.level.visitLines) this.startVisitScene();
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
        piece.isShowHealthBarOnComponent = true;
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

    addRecruitFollowers() {
        const playerTile = this.gameBoardPiecesManager.getPlayerPiece().getTileIndex();
        Object.entries(getRecruitChoices())
            .filter(([, choice]) => choice == 'recruit')
            .forEach(([avatar]) => this.followers.push(this.gameBoardPiecesManager.addFollower(avatar, playerTile)));
    }

    getCameraShot() {
        if (this.recruitScene) return this.recruitScene.shot;
        if (this.cutscene) return this.cutscene.steps[this.cutscene.index].shot;
        return this.outcomeShot;
    }

    getTimeScale = () => {
        return this.timeScale;
    }

    // bodies fly on game time, so slow motion slows them too
    stepRagdolls() {
        const rowPx = this.level.grid.rowStep * this.level.grid.scale;
        const seconds = GAME_TICK.pieceMs / 1000 * this.timeScale;
        this.getDeathPieces().filter(death => death.throwVec && death.avatar != 'kaiju').forEach(death => {
            death.body = death.body ? stepRagdoll(death.body, seconds, rowPx) : startRagdoll(death.charLocation, death.throwVec, rowPx);
        });
    }

    // where a death is now: a thrown body moves, an exploding Kaiju stays put
    getDeathLocation({ body, charLocation }) {
        return body ? { x: body.x, y: body.y - body.height } : charLocation;
    }

    // the shot holds on whoever's death ended the fight, and follows their body

    startCutscene(steps) {
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
            this.getPieces().forEach(piece => { piece.isTileHidden = false; });
            return;
        }
        cutscene.msLeft = step.ms;
        // words can be placed when they are said, over wherever the speaker has walked to
        this.speech = (typeof step.speech == 'function' ? step.speech() : step.speech) || null;
        if (step.onStart) step.onStart();
        if (step.arrivals) step.arrivals.forEach(arrival => this.startPieceArrival(arrival));
        if (step.phase) this.activePhases.add(step.phase);
    }

    // a piece walks to where it stands, from a tile, or from where it is to a new tile
    startPieceArrival({ piece, startTile, toTile, dir }) {
        const start = startTile ? this.gameBoardManager.getCharXAndYFromTileIndex(startTile) : piece.charLocation;
        if (toTile) piece.initCharLocation(true, toTile);
        piece.startArrival(start, dir);
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
                { shot: heldShot, ms: getSpeechMs(ARRIVAL_LINE), speech: { name: 'Teammate', text: ARRIVAL_LINE, x, y: y - CUTSCENE.recruitSpeechRows * rowStep * scale } }
            );
        }
        this.startCutscene(steps);
    }

    // the whole level, a pull in on the bystander and the part, their words, then the touch
    startRivalIntro() {
        const { touchPhase, intro: { focus, zoomScale, lines } } = this.level.rival;
        this.addRival();
        const rival = this.rivalPiece;
        const [, teammate] = this.gameBoardPiecesManager.getTeamPieces(this.gameBoardPiecesManager.getPlayerTeamIndex());
        const { rowStep, scale } = this.level.grid;
        const shot = { point: focus, zoomScale };

        // the camera goes to the teammate for their line, then back to the part
        const getTeammateSteps = text => {
            if (!teammate) return [];
            const { x, y } = teammate.charLocation;
            const teammateShot = { point: { x, y: y - CUTSCENE.shotHeadRows * rowStep * scale }, zoomScale };
            const speech = { name: 'Teammate', text, x, y: y - CUTSCENE.recruitSpeechRows * rowStep * scale };
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
            { shot, ms: CUTSCENE.touchMs, phase: touchPhase, onStart: () => { rival.isPlain = false; } }
        ]);
    }

    // a battleground won on before, visited from the map: the teammate has a word, then it's a walk
    startVisitScene() {
        const [, teammate] = this.gameBoardPiecesManager.getTeamPieces(this.gameBoardPiecesManager.getPlayerTeamIndex());
        if (!teammate) return;
        this.startCutscene(this.level.visitLines.map(text => ({ shot: { isWide: true }, ms: getSpeechMs(text), speech: this.getSpeechOver(teammate, 'Teammate', text) })));
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
            if (who == 'agent') return { name: 'Agent', text, ...speechSpot };
            return who == 'teammate' ? this.getSpeechOver(teammate, 'Teammate', text) : this.getSpeechOver(player, playerName, text);
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

    // the Agent who did the talking fights from where he stands. the rest drop in from the catwalk.
    startShowdownFight = () => {
        this.extras.forEach(extra => {
            extra.leave();
            this.addAgent({ standTile: extra.getTileIndex() });
        });
    }

    // Agents with powers picked at random, Kaiju Fire among them
    getAgentAbilities() {
        const { abilities, isRandomPowers } = this.level.agentDrops;
        if (!isRandomPowers) return this.settingsManager.getAbilitiesFromElements(abilities);
        const pool = [...AGENT_POWER_POOL];
        const picked = [];
        while (picked.length < AGENT_POWER_COUNT) picked.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
        return this.settingsManager.getAbilitiesFromElements(picked);
    }

    // everyone stands facing the Agent while he has his say, each line once, and then the chase is on
    startTrapScene() {
        const { lines, speechSpot } = this.level.trap;
        this.getPieces().forEach(piece => { piece.facingDir = 'up'; });
        const shot = { isWide: true };
        this.startCutscene([
            ...lines.map(text => ({ shot, ms: getSpeechMs(text), speech: { name: 'Agent', text, ...speechSpot } })),
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
        return { name, text, x, y: Math.max(y - CUTSCENE.recruitSpeechRows * rowStep * scale, topY), isFlipped: x > this.level.world.width / 2 };
    }

    // the teammate may have gone on ahead. after a beat the recruits catch up, the script plays, and it may end with the team walking on.
    startWalkInScene() {
        const { teammateSpot, doorTile, standSpots, frontSpots, script, ending } = this.level.walkIn;
        const [player, teammate] = this.getPieces();
        const hasTeammate = !!teammate && !this.followers.includes(teammate);
        const getTile = spot => this.gameBoardManager.getClosestWalkableTileToLocation(spot);
        const shot = { isWide: true };
        const getName = ({ avatar }) => ROSTER.find(({ id }) => id == avatar).name;

        if (hasTeammate && teammateSpot) {
            teammate.initCharLocation(true, getTile(teammateSpot));
            teammate.facingDir = 'down';
        }
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
            if (who == 'teammate') return this.getSpeechOver(teammate, 'Teammate', text);
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
            { shot, ms: ending.climaxMs, phase: ending.phase },
            { shot, ms: 0, onStart: () => { this.isSceneOver = true; } }
        ];

        this.startCutscene([
            { shot, ms: CUTSCENE.pullInMs },
            ...arrivals,
            ...frontSteps,
            ...script
                .filter(({ who }) => who != 'teammate' || hasTeammate)
                .map(line => ({ shot, ms: getSpeechMs(line.text), speech: () => getSpeech(line) })),
            ...endingSteps
        ]);
    }

    // the Agents burst in from below, in slow motion at first. the powers are gone, so the only way out is the door.
    startChase = () => {
        const { chasers: { xs, startY, landingY, moveSpeed, abilities } } = this.level.trap;
        const team = this.gameBoardPiecesManager.getTeamPieces(this.gameBoardPiecesManager.getPlayerTeamIndex());
        team.forEach(piece => { piece.abilities = []; });
        // the teammate and the recruits make a run for the exit. the player has to follow.
        const exitTile = this.gameBoardManager.getClosestWalkableTileToLocation(this.level.exit.spot);
        team.filter(piece => piece.isNpc).forEach(piece => { piece.escapeTile = exitTile; });
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
        const deaths = this.getDeathPieces();
        const lastDeath = deaths[deaths.length - 1];
        if (!lastDeath) return;
        this.outcomeDeath = lastDeath;
        this.outcomeShot = { point: { ...this.getDeathLocation(lastDeath) }, zoomScale: this.level.cameraZoom * CUTSCENE.outcomeZoomScale, panMs: CUTSCENE.outcomePullMs };
    }

    // the same shot, moved: a new shot would start the camera's pull again
    updateOutcomeShot() {
        if (!this.outcomeShot) return;
        Object.assign(this.outcomeShot.point, this.getDeathLocation(this.outcomeDeath));
    }

    // the fight is over: the train leaves, and no other comes
    stopTrains() {
        this.handleTrainStage('idle', this.accTime);
        this.gameBoardManager.setWalkableTiles(this.level.walkableTiles);
    }

    // the player and teammate stand over the beaten bystander: the player's choice, with the teammate back and to the left
    startRecruitScene() {
        const { avatar, pronoun, recruitSpot } = this.level.rival;
        const { x, y } = recruitSpot;
        const { rowStep, colStep, scale } = this.level.grid;
        const getTileNear = (columns, rows) => this.gameBoardManager.getClosestWalkableTileToLocation({ x: x + columns * colStep * scale, y: y + rows * rowStep * scale });
        const [player, teammate] = this.gameBoardPiecesManager.getTeamPieces(this.gameBoardPiecesManager.getPlayerTeamIndex());

        const stand = (piece, tile) => {
            if (piece.getIsDead()) piece.respawn(this.accTime);
            piece.initCharLocation(true, tile);
            piece.facingDir = 'down';
        };
        stand(player, getTileNear(0, -CUTSCENE.recruitStandRows));
        if (teammate) stand(teammate, getTileNear(-3, -CUTSCENE.recruitStandRows));
        this.gameBoardManager.getTilesInFlatArray().forEach(tile => tile.clearTileStatus());

        const zoomScale = this.level.cameraZoom * CUTSCENE.recruitZoomScale;
        this.speech = teammate ? {
            name: 'Teammate',
            text: getRecruitLine(pronoun),
            x: teammate.charLocation.x,
            y: teammate.charLocation.y - CUTSCENE.recruitSpeechRows * rowStep * scale,
            isFlipped: true
        } : null;
        this.recruitScene = {
            shot: { point: { x, y: y - CUTSCENE.recruitShotRows * rowStep * scale }, zoomScale, isFollowingMouse: true, isCut: true },
            body: { x, y, avatar },
            prompt: { x: player.charLocation.x, y: player.charLocation.y - CUTSCENE.recruitButtonRows * rowStep * scale }
        };
    }

    // stepping on a level's hidden tile unlocks a character
    updateUnlock() {
        const { id, label, image, spot } = this.level.unlock;
        if (getUnlocks().includes(id)) return;
        const { i, j } = this.gameBoardManager.getClosestWalkableTileToLocation(spot);
        const tile = this.gameBoardPiecesManager.getPlayerPiece().getTileIndex();
        if (tile.i != i || tile.j != j) return;
        addUnlock(id);
        this.unlockMessage = `${label} unlocked!`;
        this.unlockImage = image;
    }

    updateExit() {
        const { afterMs, afterPhase } = this.level.exit;
        if (this.accTime >= afterMs || this.activePhases.has(afterPhase)) this.setPhase(EXIT_OPEN_PHASE, true);
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
        const site = sites.find(({ spot }) => this.getIsPlayerNear(spot, SITE_ROWS));
        if (site) {
            this.reachedSite = site;
            return true;
        }
        if (exit && this.activePhases.has(EXIT_OPEN_PHASE) && this.getIsPlayerNear(exit.spot)) return true;
        const piece = this.gameBoardPiecesManager.getPlayerPiece();
        const { i, j } = piece.getTileIndex();
        return piece.isThere && goalTiles.some(tile => tile.i == i && tile.j == j);
    }

    updateAgentDrops() {
        const { drops, firstDropMs, dropIntervalMs } = this.level.agentDrops;
        const isDue = this.accTime >= firstDropMs + this.agentsDropped * dropIntervalMs;
        if (this.agentsDropped < drops.length && isDue) this.addAgent(drops[this.agentsDropped]);
    }

    addAgent({ x = 0, isFromLeft = false, standTile = undefined }) {
        const { maxLives, moveSpeed, catwalkY, floorY } = this.level.agentDrops;
        const piece = this.gameBoardPiecesManager.addPiece({
            pieceClass: GameBoardPieceAgent,
            pieceInfo: {
                ...PIECES_INFO.agent,
                abilities: this.getAgentAbilities(),
                maxLives,
                moveSpeed
            },
            teamIndex: 1
        });
        if (standTile) {
            piece.isEntering = false;
            piece.initCharLocation(true, standTile);
            return;
        }
        const offShot = 60;
        piece.startEntrance({
            startLocation: { x: isFromLeft ? -offShot : this.level.world.width + offShot },
            dropTile: this.gameBoardManager.getClosestWalkableTileToLocation({ x, y: catwalkY }),
            landingTile: this.gameBoardManager.getClosestWalkableTileToLocation({ x, y: floorY }),
            walkDir: isFromLeft ? 'downRight' : 'downLeft'
        });
        this.agentsDropped += 1;
    }

    getKillsToWin() {
        if (this.level.agentDrops) return this.level.agentDrops.drops.length + (this.level.showdown ? this.level.extras.length : 0);
        if (this.level.rival) return 1;
        return this.killsToWin || this.gameManagerProxy.determineKaijuDetails().MAX_TO_WIN;
    }

    stepPieces() {
        if (this.isPaused || this.isEditingTiles || this.recruitScene) return;
        if (this.cutscene) {
            this.updateCutscene();
            return;
        }
        this.stepRagdolls();
        if (this.getGameResult() !== null) {
            this.updateSlowMotion();
            return;
        }
        if (this.wideShotMs > 0) {
            this.wideShotMs -= GAME_TICK.pieceMs;
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
            getSafeTileIndex: this.gameBoardManager.getSafeTileIndex,
            getHighlightedTiles: this.gameBoardManager.getHighlightedTiles,
            resetHightlightedTiles: this.gameBoardManager.resetHightlightedTiles,
            getClickedTileIndex: this.gameBoardManager.getClickedTileIndex,
            getHoveredTileIndex: this.gameBoardManager.getHoveredTileIndex,
            setClickedTileIndex: this.gameBoardManager.setClickedTileIndex,
            setHoveredTileIndex: this.gameBoardManager.setHoveredTileIndex,
            getIsPieceInDanger: this.gameBoardManager.getIsPieceInDanger,
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
            getIsSoapy: this.gameBoardManager.getIsSoapy,
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
