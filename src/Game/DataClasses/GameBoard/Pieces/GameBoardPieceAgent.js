import { GameBoardPieceBase } from './GameBoardPieceBase';

const WALK_IN_SPEED_SCALE = 1.5;
const FALL_SPEED_SCALE = 3;
const RUN_AWAY_TILES = 12; // the head start: as far off as they can get

/*
    Walks in from off-shot along a catwalk, drops to the floor, then fights like any other piece.
    A chaser runs straight in from off-shot instead, and only wants to catch the player.
    He isn't on the tiles until he lands, so nothing can hit him before that.
*/
export class GameBoardPieceAgent extends GameBoardPieceBase {
    constructor(params) {
        super(params);
        this.isOnTiles = false;
        this.isFalling = false;
        this.isEntering = true;
        this.isShowHealthBarOnComponent = true;
        this.pieceClass = 'Agent';
    }

    getIdealDistanceFromEnemy() {
        if (this.isChaser) return 0;
        if (this.getIsRunningAway && this.getIsRunningAway()) return RUN_AWAY_TILES;
        return super.getIdealDistanceFromEnemy();
    }

    // on the catwalk, with no one up there: he stands and waits for his clones
    moveWithEnemy(enemy) {
        if (this.getIsWaitingOnCatwalk && this.getIsWaitingOnCatwalk()) {
            this.moveToTiles = [];
            return;
        }
        super.moveWithEnemy(enemy);
    }

    // held on the catwalk: he never takes the portal back down
    getNextDestination() {
        if (this.isHeldOnCatwalk) {
            const [nextTileIndex] = this.moveToTiles;
            const linkedTile = this.gameManagerProxy.getLinkedTile(this.tileIndex);
            if (!!linkedTile && linkedTile.i == nextTileIndex.i && linkedTile.j == nextTileIndex.j) {
                this.moveToTiles = [];
                return;
            }
        }
        super.getNextDestination();
    }

    followTileLink() {
        if (!this.isHeldOnCatwalk) super.followTileLink();
    }

    // from the catwalk to the floor, like the clones did
    dropDown(landingTile) {
        this.isOnTiles = false;
        this.isEntering = true;
        this.isFalling = true;
        this.moveToTiles = [];
        this.tileIndex = landingTile;
        this.moveFromLocation = this.charLocation;
        this.moveToLocation = this.gameManagerProxy.getCharXAndYFromTileIndex(landingTile);
        this.setDir('idle');
    }

    startChase({ startLocation, landingTile }) {
        this.isChaser = true;
        this.dealsContactDmg = true;
        this.startEntrance({ startLocation, dropTile: landingTile, landingTile, walkDir: 'up' });
    }

    startEntrance({ startLocation, dropTile, landingTile, walkDir }) {
        this.tileIndex = landingTile; // where the others aim for him
        this.charLocation = { ...this.gameManagerProxy.getCharXAndYFromTileIndex(dropTile), ...startLocation };
        this.moveFromLocation = this.charLocation;
        this.moveToLocation = this.gameManagerProxy.getCharXAndYFromTileIndex(dropTile);
        this.isThere = false;
        this.setDir(walkDir);
    }

    movePiece(params) {
        if (this.isDead || this.isOnTiles) {
            super.movePiece(params);
            return;
        }

        const { newLocation, hasArrived } = this.gameManagerProxy.moveTo({
            currentLocation: this.charLocation,
            moveFromLocation: this.moveFromLocation,
            moveToLocation: this.moveToLocation,
            moveSpeed: this.moveSpeed * (this.isFalling ? FALL_SPEED_SCALE : WALK_IN_SPEED_SCALE)
        });
        this.charLocation = newLocation;
        this.moveFromLocation = newLocation;
        if (!hasArrived) return;

        if (this.isFalling || this.isChaser) {
            this.isFalling = false;
            this.isEntering = false;
            this.initCharLocation(true, this.tileIndex);
        } else {
            this.isFalling = true;
            this.setDir('idle');
            this.moveToLocation = this.gameManagerProxy.getCharXAndYFromTileIndex(this.tileIndex);
        }
    }
}
