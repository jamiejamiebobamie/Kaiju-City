import { GameBoardPieceBase } from './GameBoardPieceBase';

/*
    Someone standing in a scene, drawn the same way and at the same size as any other piece.
    They aren't on the tiles, so nothing aims at them, and they don't take part in anything.
*/
export class GameBoardPieceExtra extends GameBoardPieceBase {
    constructor(params) {
        super(params);
        this.isOnTiles = false;
        this.isPlain = true;
    }

    place({ charLocation, tileIndex, facingDir }) {
        this.charLocation = charLocation;
        this.tileIndex = tileIndex;
        this.facingDir = facingDir;
    }

    leave() {
        this.isVisible = false;
        this.setIsDead(true);
    }

    movePiece() { }
}
