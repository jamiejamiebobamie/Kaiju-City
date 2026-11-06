import { GameBoardPieceBase } from './GameBoardPieceBase';
import { GIANT_KAIJU } from 'Game/DataClasses/GiantKaiju';

/*
  The final battle's giant Kaiju, as the board sees it: a piece standing on its weak spot. Everyone aims at it there,
  its edge caret points there, and its health is its power, drained a hit at a time. It doesn't walk or think for
  itself: the game moves it with the giant (GiantKaiju.ts) and draws the giant's body itself (GiantKaijuLayer).
*/
export class GameBoardPieceGiant extends GameBoardPieceBase {
    constructor(params) {
        super(params);
        this.isGiant = true;
        this.isVisible = false;
        this.isShowHealthBarOnComponent = false;
        this.lastDmgAccTimeInterval = GIANT_KAIJU.hitEveryMs;
    }

    movePiece({ accTime }) {
        this.accTime = accTime;
    }

    // stands where the weak spot is
    standAt(tileIndex) {
        this.setTileIndex(tileIndex);
        const location = this.gameManagerProxy.getCharXAndYFromTileIndex(tileIndex);
        this.charLocation = location;
        this.moveFromLocation = location;
        this.moveToLocation = location;
        this.isThere = true;
        this.isOnTiles = true;
    }
}
