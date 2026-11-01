import { GameBoardPieceBase } from './GameBoardPieceBase';

const FALL_SPEED_SCALE = 3; // how much faster than he walks

/*
    Walks in from off-shot along a catwalk, drops to the floor, then fights like any other piece.
    He isn't on the tiles until he lands, so nothing can hit him before that.
*/
export class GameBoardPieceAgent extends GameBoardPieceBase {
    constructor(params) {
        super(params);
        this.isOnTiles = false;
        this.isFalling = false;
        this.isShowHealthBarOnComponent = true;
        this.pieceClass = 'Agent';
    }

    startEntrance({ startLocation, dropTile, landingTile, walkDir }) {
        this.tileIndex = landingTile; // where the others aim for him
        this.charLocation = { ...this.gameManagerProxy.getCharXAndYFromTileIndex(dropTile), x: startLocation.x };
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
            moveSpeed: this.isFalling ? this.moveSpeed * FALL_SPEED_SCALE : this.moveSpeed
        });
        this.charLocation = newLocation;
        this.moveFromLocation = newLocation;
        if (!hasArrived) return;

        if (this.isFalling) {
            this.isFalling = false;
            this.initCharLocation(true, this.tileIndex);
        } else {
            this.isFalling = true;
            this.setDir('idle');
            this.moveToLocation = this.gameManagerProxy.getCharXAndYFromTileIndex(this.tileIndex);
        }
    }
}
