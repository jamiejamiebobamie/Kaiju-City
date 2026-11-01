import { GameBoardPieceBase } from './GameBoardPieceBase';

const WALK_IN_SPEED_SCALE = 1.5;
const FALL_SPEED_SCALE = 3;

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
        return this.isChaser ? 0 : super.getIdealDistanceFromEnemy();
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
