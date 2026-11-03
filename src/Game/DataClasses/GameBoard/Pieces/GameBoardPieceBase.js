import { getThrowVec } from 'Game/DataClasses/Ragdoll';
import { followBrainAction } from 'Game/DataClasses/npcBrain/brain';
import { BUBBLE_DRAWBACKS } from 'Game/DataClasses/BubbleTest';

const CHARM_MS = 5000;
const SLIPPERY_SLIDE_TILES = 1;
const CHARM_ALONE_DMG = 1;

export class GameBoardPieceBase {
    constructor({
        pieceIndex = 0,
        teamIndex = 0,
        avatar = 'guy',
        color = "#55AAff",
        maxLives = 4,
        moveSpeed = 7,
        spriteSheetSrc = '',
        deadSpriteSrc = '',
        isVisible = true,
        isTeamLeader = false,
        isNpc = true,
        isDoAvoidEnemy = true,
        gameManagerProxy,
        abilities = [],
        isOnTiles = true
    }) {

        this.gameManagerProxy = gameManagerProxy;

        this.pieceIndex = pieceIndex;
        this.teamIndex = teamIndex;
        this.isTeamLeader = isTeamLeader;
        this.isNpc = isNpc;
        this.isCharmed = false;
        this.isTileHidden = false; // its tile isn't highlighted, while it makes an entrance
        this.charmEndsAt = 0;
        this.homeTeamIndex = teamIndex; // the team it goes back to, and the team its death counts against

        // aesthetics
        this.avatar = avatar; // enum?
        this.color = color;
        this.isVisible = isVisible;

        // piece class
        this.pieceClass = '';
        this.pieceClassDescription = '';
        this.elements = '';

        // active abilities
        this.abilities = abilities;
        this.abilityAccTimeInterval = 500; // amt of time in milliseconds to wait between ability usages

        // passive abilities
        this.storedPassive = undefined; // teleport passive is called after teleport
        this.livesModifier = 0;
        this.moveSpeedModifier = 0;
        this.numTilesModifier = 0;
        this.tileCountModifier = 0;
        this.slipperyModifier = 0; // above 0, the piece slides one tile further when it stops
        this.dmgModifier = 0;

        // for rendering dmg/healing and teleport floating text
        this.isHealed = false;
        this.isTeleported = false;

        // animation
        this.dir = 'idle';
        this.facingDir = 'down'; // the last direction the piece moved in. used to aim with no target.
        this.spriteSheetSrc = spriteSheetSrc;
        this.deadSpriteSrc = deadSpriteSrc;

        // health
        this.lives = maxLives;
        this.maxLives = maxLives;
        this.isDead = false;
        this.lastDmgAccTime = 0; // in milliseconds
        this.lastDmgAccTimeInterval = 1000; // in milliseconds
        this.dealsContactDmg = false; // does touching this piece dmg its enemies
        this.isShowHealthBarOnComponent = false;

        // movement
        this.shouldTeleport = false;
        this.isThere = true; // tracks if piece is at the next tile in moveToTiles array
        this.moveSpeed = moveSpeed;
        this.isOnTiles = isOnTiles;
        this.charLocation = { x: 0, y: 0 };
        this.moveFromLocation = { x: 0, y: 0 };
        this.moveToLocation = { x: 0, y: 0 };
        this.moveToTiles = [];
        this.tileIndex = { i: 0, j: 0 };
        // tiles the piece has been on since the last tile update.
        // stops a piece and a status swapping tiles without touching.
        this.touchedTileIndices = [];
        this.linkArrivalTile = undefined; // the linked tile the piece jumped to. it doesn't jump back until it has left.
        this.followDistance = 3 + pieceIndex * 2; // in number of tiles
        this.isDoAvoidEnemy = isDoAvoidEnemy; // does NPC pathing avoid enemies

        /*
            Biases the piece to be closer (negative value) or farther away (positive value) from enemy
        */
        this.enemyDistanceBias = 5; // in number of tiles.
    }

    getIsMoveToTiles() {
        return !!this.moveToTiles.length;
    }

    getZIndex() {
        return this.gameManagerProxy.getFlattenedArrayIndex(this.tileIndex);
    }

    initCharLocation(isOnTiles = false, spawnTile = undefined) {
        this.isOnTiles = isOnTiles;
        if (isOnTiles) {
            const tileIndex = spawnTile || this.gameManagerProxy.getRandomTileIndexOnBoard();
            const charLocation = this.gameManagerProxy.getCharXAndYFromTileIndex(tileIndex);
            this.charLocation = charLocation;
            this.moveFromLocation = charLocation;
            this.moveToLocation = charLocation;
            this.moveToTiles = [];
            this.isThere = true;
            this.tileIndex = tileIndex;
            this.dir = 'idle';
        } else {
            const { charLocation, tileIndex, dir } = this.gameManagerProxy.getMoveOntoGameBoardMovementData();
            this.charLocation = charLocation;
            this.moveFromLocation = charLocation;
            this.moveToLocation = this.gameManagerProxy.getCharXAndYFromTileIndex(tileIndex);
            this.moveToTiles = [tileIndex];
            this.isThere = false;
            this.tileIndex = tileIndex;
            this.dir = dir;
        }
    }

    getTileIndex() {
        return this.tileIndex;
    }

    getPieceIndex() {
        return this.pieceIndex;
    }

    getLives() {
        return this.lives;
    }

    setAbilities(abilities) {
        this.abilities = abilities;
    }

    setIsTeamLeader(isTeamLeader) {
        this.isTeamLeader = isTeamLeader;
    }

    getFacingDir() {
        return this.facingDir;
    }

    setDir(dir) {
        this.dir = dir;
        if (dir != 'idle') this.facingDir = dir;
    }

    setTileIndex(tileIndex) {
        this.touchedTileIndices.push(this.tileIndex);
        this.tileIndex = tileIndex;
    }

    setShouldTeleport(shouldTeleport) {
        this.shouldTeleport = shouldTeleport;
    }

    applyDmgFromTouchedTiles(accTime) {
        if (!this.isDead && this.isOnTiles) {
            [...this.touchedTileIndices, this.tileIndex].forEach(tileIndex => {
                const dmg = this.gameManagerProxy.getDmg(this.pieceIndex, tileIndex);
                if (!dmg) return;
                this.lastHitDirs = this.gameManagerProxy.getStatusDirs(tileIndex);
                this.decrementHealth(accTime, dmg);
            });
        }
        this.touchedTileIndices = [];
    }

    movePiece({ accTime, playerInputHandler = undefined }) {
        if (this.isDead) return;

        this.accTime = accTime;
        this.updateCharm(accTime);

        // intention: even the player can be Charmed and lose control for a moment of his piece....
        if (this.isNpc && this.isOnTiles && this.escapeTile) {
            this.runForEscape();
        } else if (this.isNpc && this.isOnTiles && this.brainAction) {
            // a trained NPC: its model chooses, in place of the rules below
            followBrainAction(this, accTime);
        } else if (this.isNpc && this.isOnTiles) {

            const enemy = this.gameManagerProxy.getClosestEnemy(this.pieceIndex);

            // DETERMINE DESIRED MOVEMENT LOGIC
            // only re-path between tiles. a new path each tick is wasted while walking to the next tile.
            if (this.isThere) {
                if (!enemy) {
                    this.followLeader();
                } else {
                    this.moveWithEnemy(enemy);
                }
            } // - - - - - - - - - - - -

            this.useAbilities(accTime);
        } else if (!this.isNpc) {
            this.handlePlayerInput(playerInputHandler);
        }

        // the player teleports once they have chosen a destination
        if (this.shouldTeleport && (this.isNpc || this.getIsMoveToTiles())) {
            this.teleportPiece();
        }

        // MOVE PIECE
        this.move();

        if (this.isThere) {
            if (this.getIsMoveToTiles()) {
                this.getNextDestination();
            } else if (!this.getIsMoveToTiles()) {
                this.stopMoving();
                if (!this.isNpc) this.followTileLink();
            }
        }

        if (this.isOnTiles) {
            const dmg = this.gameManagerProxy.getDmg(this.pieceIndex);
            if (!!dmg) {
                this.lastHitDirs = this.gameManagerProxy.getStatusDirs(this.tileIndex);
                this.lastHitBy = this.gameManagerProxy.getStatusCaster(this.tileIndex); // -1 for a Kaiju's touch
                this.decrementHealth(accTime, dmg);
            }
        }
    }

    // runs for a way out, ignoring everyone, and is gone once there
    runForEscape() {
        const { i, j } = this.escapeTile;
        if (this.tileIndex.i == i && this.tileIndex.j == j) {
            this.isVisible = false;
            this.isOnTiles = false;
            return;
        }
        if (this.isThere) this.updateMovmement(this.gameManagerProxy.getPathFromTileToTile({ fromTile: this.tileIndex, toTile: this.escapeTile }));
    }

    // a charmed piece fights for the other team for a while. the player keeps their piece, but its keys are reversed.
    updateCharm(accTime) {
        const hasNoOneToFight = this.isNpc && this.isCharmed && !this.gameManagerProxy.getHasAllyOnBoard(this.pieceIndex, this.homeTeamIndex);
        if (this.isCharmed && (accTime >= this.charmEndsAt || hasNoOneToFight)) {
            this.isCharmed = false;
            this.setTeamIndex(this.homeTeamIndex);
            // Spurned: an NPC goes after whoever charmed them, for as long as the charmer lives
            if (this.isNpc) this.spurnedBy = this.charmedBy;
            return;
        }
        if (!this.isOnTiles) return;
        const charmingTeam = this.gameManagerProxy.getCharmingTeam(this.pieceIndex);
        if (charmingTeam === undefined) return;
        const charmer = this.gameManagerProxy.getStatusCaster(this.tileIndex);

        // a Charm is spent on the first enemy it touches
        this.gameManagerProxy.clearTileStatusUnderPiece(this.pieceIndex);
        if (this.isCharmed) return;

        // with no one left on their old side to turn on, it hurts them instead
        if (this.isNpc && !this.gameManagerProxy.getHasAllyOnBoard(this.pieceIndex, this.teamIndex)) {
            this.decrementHealth(accTime, CHARM_ALONE_DMG);
            return;
        }
        this.isCharmed = true;
        this.charmEndsAt = accTime + CHARM_MS;
        this.charmedBy = charmer;
        if (this.isNpc) {
            this.setTeamIndex(charmingTeam);
            this.moveToTiles = [];
        }
    }

    getMoveToTiles() {
        return this.moveToTiles;
    }

    getNextDestination() {
        const [nextTileIndex, ...tileIndices] = this.moveToTiles;

        // the path crosses a tile link
        const linkedTile = this.gameManagerProxy.getLinkedTile(this.tileIndex);
        if (!!linkedTile && linkedTile.i == nextTileIndex.i && linkedTile.j == nextTileIndex.j) {
            this.moveToTiles = tileIndices;
            this.jumpToLinkedTile(linkedTile);
            return;
        }

        this.linkArrivalTile = undefined;
        const playerDirection = this.gameManagerProxy.getDirFromTiles(this.tileIndex, nextTileIndex);
        this.setDir(playerDirection);
        this.setTileIndex(nextTileIndex);
        this.moveToTiles = tileIndices;
        this.moveToLocation = this.gameManagerProxy.getCharXAndYFromTileIndex(nextTileIndex);
    }

    applyAvatar({ avatar, color, spriteSheetSrc }) {
        this.avatar = avatar;
        this.color = color;
        this.spriteSheetSrc = spriteSheetSrc;
    }

    // starts off-shot, and runs up to where it was standing
    // 'waypoints': the spots it passes on the way, if it has to go round something. 'dir': the way it faces once there.
    startArrival(startLocation, dir = undefined, waypoints = []) {
        this.arrivalEnd = this.charLocation;
        this.arrivalWaypoints = [...waypoints];
        this.arrivalDir = dir;
        this.moveToLocation = this.arrivalWaypoints.shift() || this.arrivalEnd;
        this.charLocation = startLocation;
        this.moveFromLocation = startLocation;
        this.isVisible = true;
        this.faceTowards(this.moveToLocation);
    }

    // one of the six hex directions, the closest to the way it is heading
    faceTowards(location) {
        const dx = location.x - this.charLocation.x;
        const dy = location.y - this.charLocation.y;
        if (!dx && !dy) return;
        const upOrDown = dy < 0 ? 'up' : 'down';
        this.setDir(Math.abs(dx) < Math.abs(dy) * 0.5 ? upOrDown : `${upOrDown}${dx > 0 ? 'Right' : 'Left'}`);
    }

    // says whether it has got there
    stepArrival() {
        const { newLocation, hasArrived } = this.gameManagerProxy.moveTo({
            currentLocation: this.charLocation,
            moveFromLocation: this.moveFromLocation,
            moveToLocation: this.moveToLocation,
            moveSpeed: this.moveSpeed
        });
        this.charLocation = newLocation;
        this.moveFromLocation = newLocation;
        if (!hasArrived) return false;
        if (this.moveToLocation != this.arrivalEnd) {
            this.moveToLocation = this.arrivalWaypoints.shift() || this.arrivalEnd;
            this.faceTowards(this.moveToLocation);
            return false;
        }
        this.setDir(this.arrivalDir || 'idle');
        this.setDir('idle');
        return true;
    }

    // the tiles changed: the piece doesn't walk onto tiles that have gone
    trimPathToWalkableTiles() {
        if (this.gameManagerProxy.getIsClosedTile(this.tileIndex)) return; // the path may be its way off
        const firstGone = this.moveToTiles.findIndex(tile => !this.gameManagerProxy.getIsInBounds(tile));
        if (firstGone != -1) this.moveToTiles = this.moveToTiles.slice(0, firstGone);
    }

    hitByTrain(accTime, { mode, dmg }, safeTile) {
        this.setLastDmgAccTime(0); // a train hits whatever else has just happened
        this.lastHitDirs = undefined;
        this.decrementHealth(accTime, mode == 'kill' ? this.lives + this.livesModifier : dmg);
        this.moveToTiles = [];
        this.jumpToLinkedTile(safeTile);
    }

    // the player stopped on a linked tile
    followTileLink() {
        const linkedTile = this.gameManagerProxy.getLinkedTile(this.tileIndex);
        const isJustArrived = !!this.linkArrivalTile && this.linkArrivalTile.i == this.tileIndex.i && this.linkArrivalTile.j == this.tileIndex.j;
        if (!!linkedTile && !isJustArrived) this.jumpToLinkedTile(linkedTile);
    }

    jumpToLinkedTile(linkedTile) {
        const location = this.gameManagerProxy.getCharXAndYFromTileIndex(linkedTile);
        this.setTileIndex(linkedTile);
        this.linkArrivalTile = linkedTile;
        this.charLocation = location;
        this.moveFromLocation = location;
        this.moveToLocation = location;
        this.isThere = true;
    }

    move() {
        const { newLocation, hasArrived } = this.gameManagerProxy.moveTo({
            currentLocation: this.charLocation,
            moveFromLocation: this.moveFromLocation,
            moveToLocation: this.moveToLocation,
            // Bubble's Suds: soapy tiles slow anyone on them
            moveSpeed: this.moveSpeed + this.moveSpeedModifier + (this.isOnTiles && this.gameManagerProxy.getIsSoapy(this.tileIndex) ? BUBBLE_DRAWBACKS.suds.speed : 0)
        });
        this.charLocation = newLocation;
        this.moveFromLocation = newLocation;
        this.isThere = hasArrived;
    }

    handlePlayerInput(playerInputHandler) {

        /*
            player ended input.
            wait for 'isThere' to be true; character is fully moved to the next tile.
            stop moving.
         */
        if (this.isThere && playerInputHandler.getIsPastPlayerInput() && !playerInputHandler.getIsCurrentPlayerInput()) {
            playerInputHandler.setIsPastPlayerInput(false);
            playerInputHandler.setPathPressedDir('idle');
            // it walks on to the tile it is assigned, and stops there. slippery, it slides one tile on.
            this.moveToTiles = this.slipperyModifier > 0 ? this.moveToTiles.slice(0, SLIPPERY_SLIDE_TILES) : [];
            this.isThere = false;
        } else if (playerInputHandler.getIsCurrentPlayerInput() && playerInputHandler.getIsChangeOfDirection()) {
            /*
                a new direction was pressed: turn right away.
                'this.tileIndex' is the tile the piece is on, or the tile it is stepping onto.
            */
            playerInputHandler.setIsPastPlayerInput(true);
            const pressedDir = playerInputHandler.getPressedDir();
            playerInputHandler.setPathPressedDir(pressedDir);

            const moveToTiles = this.getPathFromPressedDir(pressedDir, playerInputHandler);
            if (moveToTiles.length) {
                this.gameManagerProxy.clearClickedTileIndex();
                this.updateMovmement(moveToTiles);
            } else {
                // no valid tile
                this.stopMoving();
            }
        }
    }

    // walks the board in the pressed direction until the piece runs out of tiles
    getPathFromPressedDir(pressedDir, playerInputHandler) {
        const moveToTiles = [];
        const seenTiles = new Set([`${this.tileIndex.i} ${this.tileIndex.j}`]);
        const isLeavingClosedTiles = this.gameManagerProxy.getIsClosedTile(this.tileIndex);
        const getCanStepOnto = tile => this.gameManagerProxy.getIsInBounds(tile) || (isLeavingClosedTiles && this.gameManagerProxy.getIsClosedTile(tile));
        let tileIndex = this.tileIndex;
        while (tileIndex) {
            const fromTile = tileIndex;
            tileIndex = playerInputHandler.getTileDirsFromPressedDir(pressedDir, fromTile)
                .map(dir => {
                    const offset = this.gameManagerProxy.getTileOffsetFromDir(dir, fromTile);
                    return { i: fromTile.i + offset.i, j: fromTile.j + offset.j };
                })
                .find(tile => getCanStepOnto(tile) && !seenTiles.has(`${tile.i} ${tile.j}`));
            if (tileIndex) {
                seenTiles.add(`${tileIndex.i} ${tileIndex.j}`);
                moveToTiles.push(tileIndex);
            }
        }
        return moveToTiles;
    }

    updateMovmement(moveToTiles) {
        if (!moveToTiles || !moveToTiles.length) return;
        this.moveToLocation = this.gameManagerProxy.getCharXAndYFromTileIndex(moveToTiles[0]) || this.moveToLocation;
        this.moveFromLocation = this.charLocation;
        this.moveToTiles = moveToTiles;
        this.isThere = false;

        const playerDirection = this.gameManagerProxy.getDirFromTiles(this.tileIndex, moveToTiles[0]);
        this.setDir(playerDirection);
    }

    teleportPiece() {
        // updates useEffect to trigger floating text 'Zip!'
        this.isTeleported = !this.isTeleported;

        const teleportTileIndex = this.isNpc ? this.gameManagerProxy.getSafeTileIndex(this.pieceIndex) : this.moveToTiles[this.moveToTiles.length - 1];

        if (teleportTileIndex) {
            // it leaves a wormhole between where it was and where it lands
            const { wormholeMs } = this.gameManagerProxy.getAbilityAndTileStatusData().isTeleportTile;
            if (wormholeMs) this.gameManagerProxy.addWormhole(this.tileIndex, teleportTileIndex, this.accTime, wormholeMs);
            this.linkArrivalTile = teleportTileIndex; // standing on the wormhole's far end doesn't send it straight back
            const teleportLocation = this.gameManagerProxy.getCharXAndYFromTileIndex(teleportTileIndex);
            this.setTileIndex(teleportTileIndex);
            this.shouldTeleport = false;
            this.charLocation = teleportLocation;
            this.moveToLocation = teleportLocation;
            this.moveFromLocation = teleportLocation;
            this.moveToTiles = [];
            this.isThere = true;

            if (!this.isNpc) {
                this.gameManagerProxy.resetHightlightedTiles();
            }

            // teleport passive is triggered after teleport is triggered...
            if (!!this.storedPassive) {
                this.storedPassive();
                this.storedPassive = undefined;
            }
        }
    }

    storePassive(passive){
        this.storedPassive = passive;
    }

    stopMoving() {
        this.setDir('idle');
        this.moveToLocation = this.charLocation;
        this.moveFromLocation = this.charLocation;
        this.moveToTiles = [];

        if (!this.isOnTiles && this.isThere && !this.moveToTiles.length) {
            this.isOnTiles = true;
        }
    }

    useAbilities(accTime) {
        let hasUsedOneAbility = this.getHasUsedOneAbility(accTime);

        if (hasUsedOneAbility) return;

        const moveToTilesToEnemy = this.gameManagerProxy.getPathToClosestEnemy(this.pieceIndex);
        const numTilesToEnemy = moveToTilesToEnemy.length;
        const isInDanger = this.gameManagerProxy.getIsPieceInDanger(this.pieceIndex);
        const isHealRequired = this.gameManagerProxy.getIsTeamDamaged(this.pieceIndex);

        // use abilities
        const isPowersOff = this.gameManagerProxy.getIsPowersOff(this);
        this.abilities.forEach(a => {
            if (!isPowersOff && !hasUsedOneAbility && !a.getIsOnCooldown(accTime, this.isNpc)) {
                const type = a.getType();
                const desiredAIRange = a.getDesiredAIRange();
                const isOffensivePowerAndTargetInRange =
                    type.includes("offensive") &&
                    !!numTilesToEnemy &&
                    desiredAIRange >= numTilesToEnemy;
                const isDefensivePowerAndIsInDanger =
                    type.includes("defensive") && isInDanger;
                const isEscapePowerAndIsInDanger =
                    type.includes("escape") &&
                    (
                        (!!numTilesToEnemy && desiredAIRange > numTilesToEnemy)
                        || isInDanger
                    );
                const isHealPowerAndIsTeammateHealthLow =
                    type.includes("heal") && isHealRequired;

                if (
                    isOffensivePowerAndTargetInRange ||
                    isDefensivePowerAndIsInDanger ||
                    isEscapePowerAndIsInDanger ||
                    isHealPowerAndIsTeammateHealthLow
                ) {

                    hasUsedOneAbility = true;

                    this.storePassive(a.useAbility({
                        accTime,
                        piece: this,
                        registerTimeout: this.gameManagerProxy.registerTimeout,
                        updateTileWithAbilityStatus: this.gameManagerProxy.updateTileWithAbilityStatus
                    }));
                }
            }
        });
    }

    getHasUsedOneAbility(accTime) {
        return this.abilities.some(v => !!v.accTime && (accTime - v.accTime) < this.abilityAccTimeInterval);
    }

    moveWithEnemy(enemy) {
        const idealDistance = this.getIdealDistanceFromEnemy();
        const moveToTilesToEnemy = this.gameManagerProxy.getPathFromTileToTile({ fromTile: this.tileIndex, toTile: enemy.tileIndex });

        const isEnemyTooFar = moveToTilesToEnemy.length > idealDistance + this.enemyDistanceBias;
        const isEnemyTooClose = moveToTilesToEnemy.length < idealDistance;

        if (isEnemyTooFar) {
            // move closer to enemy
            this.setMoveToTilesGivenIdealDistanceFromEnemy(moveToTilesToEnemy, idealDistance);
        } else if (isEnemyTooClose) {
            // move closer to safe tile, away from enemy
            const moveToTilesToSafety = this.isDoAvoidEnemy ?
                this.gameManagerProxy.getPathToSafeTileAndAvoidEnemies(this.pieceIndex)
                : this.gameManagerProxy.getPathToSafeTile(this.pieceIndex);
            this.setMoveToTilesGivenIdealDistanceFromEnemy(moveToTilesToSafety, idealDistance);
        }
    }

    setMoveToTilesGivenIdealDistanceFromEnemy(moveToTiles, idealDistance) {
        this.moveToTiles = (moveToTiles.length - idealDistance) > 0 ? moveToTiles.slice(0, moveToTiles.length - idealDistance) : moveToTiles;
    }

    followLeader() {
        const moveToTiles = this.gameManagerProxy.getPathToTeamLeader(this.pieceIndex);
        this.moveToTiles = moveToTiles.length > this.followDistance ?
            // ensure piece follows within the range of 'this.followDistance'
            moveToTiles.slice(0, moveToTiles.length - this.followDistance)
            : [];
    }

    getIdealDistanceFromEnemy() {
        const readyAbilities = this.abilities.filter(a => !a.getIsOnCooldown(this.accTime, this.isNpc));
        return !readyAbilities.length ?
            10 // default to 10 tiles (away from enemy) if all abilities are on cooldown
            // the average range of the powers that are ready
            : readyAbilities.reduce((acc, item) => acc + item.getDesiredAIRange(), 0) / readyAbilities.length;
    }

    decrementHealth(accTime, dmg) {
        if (this.getIsDamageable(accTime)) {
            this.setLastDmgAccTime(accTime);

            const isHeal = dmg < 0;
            const isExtraLives = this.livesModifier > 0;
            let remainingDmg = dmg;

            if (!isHeal && isExtraLives) {
                remainingDmg = this.decrementExtraLives(dmg);
            }

            const livesNewVal = this.lives - remainingDmg;
            // constrain health to [0, this.maxLives]
            this.lives = Math.max(Math.min(this.maxLives, livesNewVal), 0);

            if (isHeal) {
                // triggers useEffect to show
                this.isHealed = !this.isHealed;
            }

            const lives = this.lives + this.livesModifier;

            if (!this.isDead && lives < 1) {
                this.handleDeath();
            }
        }
    }

    decrementExtraLives(dmg) {
        /*
            decrement from extra lives (positive "livesModifier")
                before decrementing from health ("lives")
        */
        const remainingDmg = Math.max(dmg - this.livesModifier, 0);
        this.livesModifier = Math.max(this.livesModifier - dmg, 0);

        // ability gives: positive "livesModifier." clearTimeout as passive has been toggled-off by decrementing extra lives
        const toggledOnPassives = this.abilities.filter(({ gameBoardPieceAbilityData, isPassiveApplied }) => {
            const { fieldToModify, modifierVal } = gameBoardPieceAbilityData;
            return fieldToModify == 'livesModifier' && modifierVal > 0 && !!isPassiveApplied;
        });
        toggledOnPassives.forEach(a => a.clearPassiveTimeout(this.gameManagerProxy.unregisterTimeout));

        return remainingDmg;
    }

    setLastDmgAccTime(accTime) {
        this.lastDmgAccTime = accTime;
    }

    getIsDamageable(accTime) {
        // piece is dead. piece CANNOT be dmged
        if (this.isDead) return false;
        // piece never dmged. piece CAN be dmged
        if (this.lastDmgAccTime == 0) return true;

        // wait until the current game time is greater than the last game time the piece was dmged + the wait time interval
        return accTime > (this.lastDmgAccTime + this.lastDmgAccTimeInterval)
    }

    getNumMoveToTiles() {
        return this.moveToTiles.length;
    }

    getTeamIndex() { return this.teamIndex; }


    // intended for 'Charm' ability -
    setTeamIndex(index) { this.teamIndex = index; }
    setColor(color) { this.color = color; }
    // - - - - - - - - - - - - - - - -

    getColor() {
        return this.color;
    }

    handleDeath() {
        this.setIsDead(true);
        this.spawnDeathPiece();
        // a Kaiju charmed onto the player's team still counts as a kill
        this.gameManagerProxy.updateScore(this.homeTeamIndex);
    }

    spawnDeathPiece() {
        this.isVisible = false;
        /*
            pieceAdded to the board on piece's death.
            representation varies per piece.
            (example: 'Exploding Kaiju' sprite anim.)
        */
        // thrown by how they were moving and by what hit them
        const throwVec = getThrowVec(this.dir, this.lastHitDirs, this.facingDir);
        this.gameManagerProxy.spawnDeathPieceAtLocation(this.charLocation, this.avatar, this.tileIndex, this.color, this.pieceIndex, throwVec, this.spriteSheetSrc);
    }

    getIsDead() {
        return this.isDead;
    }

    setIsDead(isDead) {
        this.isDead = isDead;
    }

    getUiState() {
        const { lives, maxLives, isDead, avatar, livesModifier, moveSpeedModifier, numTilesModifier, tileCountModifier } = this;
        return {
            lives,
            maxLives,
            isDead,
            gender: avatar,
            livesModifier,
            moveSpeedModifier,
            numTilesModifier,
            tileCountModifier,
            abilities: this.abilities.map(a => a.getUiState(this.isNpc))
        };
    }

    respawn(accTime) {
        this.isCharmed = false;
        this.setTeamIndex(this.homeTeamIndex);
        this.lives = this.maxLives;
        this.isDead = false;
        // TO-DO: remove dead game piece
        this.isVisible = true;

        // reset passive ability stats
        this.storedPassive = undefined;
        this.livesModifier = 0;
        this.moveSpeedModifier = 0;
        this.numTilesModifier = 0;
        this.tileCountModifier = 0;
        this.slipperyModifier = 0;
        this.soakedUntil = 0;
        this.dmgModifier = 0;
        // - - - - - - - - - -

        // reset active ability data
        this.lastDmgAccTime = accTime;
        this.shouldTeleport = false;
    }
}