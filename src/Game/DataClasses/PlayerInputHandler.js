import { ABILITY_KEY_MAPPINGS } from 'Utils/gameState';

export class PlayerInputHandler {
    constructor({ gameManagerProxy }) {
        this.pressedKeys = [];
        this.isMovementKeyInput = false;
        this.pathPressedDir = 'idle'; // the pressed direction the current path was made for

        this.playerAbilities = [];

        this.gameManagerProxy = gameManagerProxy;
    }

    addKey(code) {
        // keys are in charge: the mouse's path stays hidden until the mouse next moves
        this.gameManagerProxy.setHoveredTileIndex(undefined);
        this.pressedKeys = !this.pressedKeys.includes(code) ? [...this.pressedKeys, code] : this.pressedKeys;
    }

    removeKey(code) {
        this.pressedKeys = this.pressedKeys.includes(code) ? this.pressedKeys.filter(k => k != code) : this.pressedKeys;
    }

    // the pressed direction, eg. 'up', 'up right', 'left'. 'idle' if no keys are pressed.
    getPressedDir() {
        if (!this.pressedKeys.length) return 'idle';

        const sortLookup = {
            "KeyW": 0, "KeyS": 1, "KeyA": 2, "KeyD": 3,
            "ArrowUp": 0, "ArrowDown": 1, "ArrowLeft": 2, "ArrowRight": 3
        };

        const dirLookup = {
            "KeyW": "up", "KeyA": "left", "KeyS": "down", "KeyD": "right",
            "ArrowUp": "up", "ArrowLeft": "left", "ArrowDown": "down", "ArrowRight": "right"
        };

        const dirs = [...this.pressedKeys]
            // sort based on priority
            .sort((a, b) => sortLookup[a] - sortLookup[b])
            // map keys to directions
            .map(k => dirLookup[k])
            // remove duplicates in case of Arrow Keys and WASD are pressed at same time
            .reduce((acc, item) => !acc.includes(item) ? [...acc, item] : acc, []);

        const isConflictingDirs = (dirs.includes("up") && dirs.includes("down")) || (dirs.includes("left") && dirs.includes("right"));
        return dirs.length > 1 && !isConflictingDirs ? `${dirs[0]} ${dirs[1]}` : dirs[0];
    }

    /*
        The tile directions to try for a pressed direction, best first.
        Hexagons have no straight left or right: alternating 'down right' and 'up right' by column
        keeps the piece on its row. The others let it slide along the edge of the map.
    */
    getTileDirsFromPressedDir(pressedDir, tileIndex) {
        const isOddColumn = tileIndex.i % 2;
        switch (pressedDir) {
            case "left": return isOddColumn ? ["up left", "down left"] : ["down left", "up left"];
            case "right": return isOddColumn ? ["up right", "down right"] : ["down right", "up right"];
            case "up": return ["up", "up right", "up left"];
            case "down": return ["down", "down right", "down left"];
            case "up left": return ["up left", "up", "down left"];
            case "up right": return ["up right", "up", "down right"];
            case "down left": return ["down left", "down", "up left"];
            case "down right": return ["down right", "down", "up right"];
            default: return [];
        }
    }

    convertWasdDirToAnimationDir(wasdDir) {
        return wasdDir.split(" ").reduce((acc, item) => !acc ? item : acc + item[0].toUpperCase() + item.slice(1), '');
    }

    getIsPastPlayerInput() {
        const isPastPlayerInput = this.isMovementKeyInput;
        return isPastPlayerInput;
    }

    setIsPastPlayerInput(isPastPlayerInput) {
        this.isMovementKeyInput = !!isPastPlayerInput;
    }

    getIsCurrentPlayerInput() {
        const isCurrentPlayerInput = !!this.pressedKeys.length
        return isCurrentPlayerInput;
    }

    getIsChangeOfDirection() {
        return this.getPressedDir() != this.pathPressedDir;
    }

    setPathPressedDir(pressedDir) {
        this.pathPressedDir = pressedDir;
    }

    addPlayerAbilities(ability) {
        this.playerAbilities.push(ability);
    }

    resetPlayerAbilities() {
        this.playerAbilities = [];
    }

    getPlayerAbilities = () => {
        return this.playerAbilities;
    }

    getAbilityKeyInputMapping = i => {
        return ABILITY_KEY_MAPPINGS[i];
    }

    /* player can use his abilities and command teammates to use theirs (if abilities are not on cooldown) */
    usePlayerAbility = (keycode, accTime) => {
        this.usePlayerAbilityFromIndex(ABILITY_KEY_MAPPINGS.indexOf(keycode), accTime);
    }

    usePlayerAbilityFromIndex(i, accTime) {
        const a = this.playerAbilities[i];
        if (!a) return;

        const pieceIndex = Math.floor(i / 3); // each player-team piece gets 3 abilities
        const piece = this.gameManagerProxy.getPiece(pieceIndex);
        if (piece.getIsDead() || a.getIsOnCooldown(accTime, piece.isNpc)) return;

        const passiveAbility = a.useAbility({
            accTime,
            piece,
            registerTimeout: this.gameManagerProxy.registerTimeout,
            updateTileWithAbilityStatus: this.gameManagerProxy.updateTileWithAbilityStatus
        });
        piece.storePassive(passiveAbility);
    }

    updatePlayerDestinationAndClickedTileFromClick(clickedTileIndex) {
        if (!clickedTileIndex) return; // TO-DO: do I want to clear the clicked tile in this case?
        // the click is in charge now: released keys must not stop this path when the piece next reaches a tile
        this.setIsPastPlayerInput(false);
        this.setPathPressedDir('idle');
        // the camera may have moved the tiles under a still mouse, so the hovered tile can be out of date
        this.gameManagerProxy.setHoveredTileIndex(clickedTileIndex);
        this.gameManagerProxy.setClickedTileIndex(clickedTileIndex);
        const { highlightedTileIndices } = this.gameManagerProxy.getHighlightedTiles();
        const player = this.gameManagerProxy.getPlayerPiece();
        player.updateMovmement(highlightedTileIndices); // updates player's 'moveToTiles'
    }

    updateHoveredTileFromPlayerHover(hoveredTileIndex) {
        this.gameManagerProxy.setHoveredTileIndex(hoveredTileIndex);
    }
}
