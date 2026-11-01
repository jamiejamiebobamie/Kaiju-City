import { GameMode, GAME_TICK, PIECES_INFO, ZoomLvl } from 'Utils/gameState';
import { TimeoutHandler } from './TimeoutHandler';
import { GameManagerProxy } from './GameManagerProxy';
import { PlayerInputHandler } from './PlayerInputHandler';
import { SettingsManager } from './SettingsManager';
import { GameBoardPiecesManager } from './GameBoard/Pieces/GameBoardPiecesManager';
import { KaijuManager } from './KaijuManager';
import { GameBoardManager } from './GameBoard/GameBoardManager';
import { EXIT_OPEN_PHASE, PENINSULA, RIVAL_IN_PHASE } from 'Game/DataClasses/Levels/levels';
import { TrainSchedule, TRAIN_HIT } from './TrainSchedule';
import { GameBoardPieceAgent } from './GameBoard/Pieces/GameBoardPieceAgent';
import { WIDE_SHOT } from './Camera';
import { addUnlock, getUnlocks } from './Unlocks';

export const GameResult = Object.freeze({
    PlayerWon: 0,
    PlayerLost: -1
});

// timing of the moments the game holds still for
export const CUTSCENE = {
  wideMs: 1800,
  pullInMs: 1500,
  lineMs: 2800,
  touchMs: 4200, // long enough for the part's whole transformation and flash
  arrivalPanMs: 3200,
  offShotPx: 40,
  slowMotionSpeed: 0.2,
  recruitZoomScale: 1.3,
  recruitSpeechRows: 3.4 // how far above the teammate their words sit
};

export class GameManager {
    constructor({ level = PENINSULA, settingsManager, hasArrival = false }) {
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
            const teammateAvatar = playerAvatar == 'guy' ? 'girl' : 'guy'; // TO-DO: hook this up to selection screen...
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

        if (this.hasArrival) this.startArrival();
        else if (this.level.rival) this.startRivalIntro();
    }

    // the bystander touches the Kaiju part, and once that has played out the fight starts
    updateRival() {
        const { touchPhase, touchDelayMs } = this.level.rival;
        if (this.activePhases.has(RIVAL_IN_PHASE)) return;
        if (this.activePhases.has(touchPhase)) this.addRival();
        else if (this.accTime >= touchDelayMs) this.setPhase(touchPhase, true);
    }

    addRival() {
        const { avatar, abilities, maxLives, moveSpeed, spot } = this.level.rival;
        const piece = this.gameBoardPiecesManager.addPiece({
            pieceInfo: {
                ...PIECES_INFO[avatar],
                abilities: this.settingsManager.getAbilitiesFromElements(abilities),
                maxLives,
                moveSpeed
            },
            teamIndex: 1
        });
        piece.isShowHealthBarOnComponent = true;
        piece.initCharLocation(true, this.gameBoardManager.getClosestWalkableTileToLocation(spot));
        this.rivalPiece = piece;
        this.setPhase(RIVAL_IN_PHASE, true);
    }

    getCameraShot() {
        if (this.recruitScene) return this.recruitScene.shot;
        return this.cutscene ? this.cutscene.steps[this.cutscene.index].shot : undefined;
    }

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
            return;
        }
        cutscene.msLeft = step.ms;
        this.speech = step.speech || null;
        if (step.phase) this.activePhases.add(step.phase);
    }

    updateCutscene() {
        const { cutscene } = this;
        const { arrivingPiece } = cutscene.steps[cutscene.index];
        if (arrivingPiece) {
            if (arrivingPiece.stepArrival()) this.nextCutsceneStep();
            return;
        }
        cutscene.msLeft -= GAME_TICK.pieceMs;
        if (cutscene.msLeft <= 0) this.nextCutsceneStep();
    }

    // the whole map, a slow pull in on the player that speeds up, then the teammate runs in
    startArrival() {
        const [player, teammate] = this.getPieces();
        const closeShot = { point: player.charLocation, zoomScale: this.level.cameraZoom, panMs: CUTSCENE.arrivalPanMs, ease: 'cubic-bezier(0.8, 0, 1, 0.6)' };
        const steps = [{ shot: { isWide: true }, ms: CUTSCENE.wideMs }, { shot: closeShot, ms: CUTSCENE.arrivalPanMs }];
        if (teammate) {
            teammate.startArrival(this.level.world.width + CUTSCENE.offShotPx);
            const { x, y } = teammate.moveToLocation;
            const heldShot = { ...closeShot, panMs: undefined };
            steps.push(
                { shot: heldShot, arrivingPiece: teammate },
                { shot: heldShot, ms: CUTSCENE.lineMs, speech: { name: 'Teammate', text: "Heads-up, teammate. They're coming!", x, y } }
            );
        }
        this.startCutscene(steps);
    }

    // the whole level, a pull in on the bystander and the part, their words, then the touch
    startRivalIntro() {
        const { touchPhase, intro: { focus, zoomScale, lines } } = this.level.rival;
        const shot = { point: focus, zoomScale };
        this.startCutscene([
            { shot: { isWide: true }, ms: CUTSCENE.wideMs },
            { shot, ms: CUTSCENE.pullInMs },
            ...lines.map(speech => ({ shot, ms: CUTSCENE.lineMs, speech })),
            { shot, ms: CUTSCENE.touchMs, phase: touchPhase }
        ]);
    }

    updateSlowMotion() {
        if (this.level.isWalkingLevel) return;
        if (!this.isSlowMotion) {
            this.isSlowMotion = true;
            this.gameBoardManager.moveSpeedScale *= CUTSCENE.slowMotionSpeed;
        }
        if (this.getGameResult() === GameResult.PlayerWon) this.gameBoardPiecesManager.movePieces({ accTime: this.accTime, playerInputHandler: this.playerInputHandler });
    }

    // the player and teammate stand over the beaten bystander: the player's choice, with the teammate back and to the left
    startRecruitScene() {
        const { pose, pronoun } = this.level.rival;
        const { x, y } = this.rivalPiece.charLocation;
        const { rowStep, colStep, scale } = this.level.grid;
        const getTileNear = (columns, rows) => this.gameBoardManager.getClosestWalkableTileToLocation({ x: x + columns * colStep * scale, y: y + rows * rowStep * scale });
        const [player, teammate] = this.gameBoardPiecesManager.getTeamPieces(this.gameBoardPiecesManager.getPlayerTeamIndex());

        const stand = (piece, tile) => {
            if (piece.getIsDead()) piece.respawn(this.accTime);
            piece.initCharLocation(true, tile);
            piece.facingDir = 'down';
        };
        stand(player, getTileNear(0, -3));
        if (teammate) stand(teammate, getTileNear(-3, -3));

        const zoomScale = this.level.cameraZoom * CUTSCENE.recruitZoomScale;
        this.speech = teammate ? {
            name: 'Teammate',
            text: `Do you think we can use ${pronoun}?`,
            x: teammate.charLocation.x,
            y: teammate.charLocation.y - CUTSCENE.recruitSpeechRows * rowStep * scale
        } : null;
        this.recruitScene = {
            shot: { point: { x, y: y - 40 }, zoomScale, isFollowingMouse: true },
            body: { x, y, pose },
            prompt: player.charLocation
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

    updateTalk() {
        if (this.activePhases.has(this.level.talk.phase)) return;
        if (this.getIsPlayerNear(this.level.talk.spot)) this.setPhase(this.level.talk.phase, true);
    }

    updateExit() {
        const { afterMs, afterPhase } = this.level.exit;
        if (this.accTime >= afterMs || this.activePhases.has(afterPhase)) this.setPhase(EXIT_OPEN_PHASE, true);
    }

    getIsPlayerNear(spot) {
        const { i, j } = this.gameBoardManager.getClosestWalkableTileToLocation(spot);
        const piece = this.gameBoardPiecesManager.getPlayerPiece();
        const tile = piece.getTileIndex();
        return piece.isThere && tile.i == i && tile.j == j;
    }

    // who the camera stays with: the player, then their teammate once the player is down
    getFocusPiece() {
        const team = this.gameBoardPiecesManager.getTeamPieces(this.gameBoardPiecesManager.getPlayerTeamIndex());
        return team.find(piece => !piece.getIsDead()) || this.getPieces()[0];
    }

    getIsAtGoal() {
        const { goalTiles, exit } = this.level;
        if (!this.getPieces().length) return false;
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

    addAgent({ x, isFromLeft }) {
        const { abilities, maxLives, moveSpeed, catwalkY, floorY } = this.level.agentDrops;
        const piece = this.gameBoardPiecesManager.addPiece({
            pieceClass: GameBoardPieceAgent,
            pieceInfo: {
                ...PIECES_INFO.agent,
                abilities: this.settingsManager.getAbilitiesFromElements(abilities),
                maxLives,
                moveSpeed
            },
            teamIndex: 1
        });
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
        if (this.level.agentDrops) return this.level.agentDrops.drops.length;
        return this.level.rival ? 1 : this.gameManagerProxy.determineKaijuDetails().MAX_TO_WIN;
    }

    stepPieces() {
        if (this.isPaused || this.isEditingTiles || this.recruitScene) return;
        if (this.cutscene) {
            this.updateCutscene();
            return;
        }
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
        this.timeoutHandler.update(this.accTime);
        if (this.trainSchedule) this.trainSchedule.update(this.accTime);
        if (this.level.kaijuEntry) this.kaijuManager.update(this.accTime, this.score);
        if (this.level.rival) this.updateRival();
        if (this.level.agentDrops) this.updateAgentDrops();
        if (this.level.unlock) this.updateUnlock();
        if (this.level.talk) this.updateTalk();
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
        const { MAX_TO_WIN } = this.gameManagerProxy.determineKaijuDetails();
        return {
            players: this.gameBoardPiecesManager.getPlayerTeamUiState(),
            kaijuKillCount: this.score,
            kaijuToWin: MAX_TO_WIN,
            isPaused: this.isPaused,
            activePhases: this.getActivePhases(),
            isWideShot: this.getIsWideShot(),
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
            determineKaijuDetails: () => this.kaijuManager.determineKaijuDetailsFromDifficulty(this.settingsManager.getDifficulty()),
            getFlattenedArrayIndex: this.gameBoardManager.getFlattenedArrayIndex,
            getDmg: this.gameBoardManager.getDmg,
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
