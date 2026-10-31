import { GameManager } from 'Game/DataClasses/GameManager';
import { SettingsManager } from 'Game/DataClasses/SettingsManager';
import { GameBoardPieceKaiju } from 'Game/DataClasses/GameBoard/Pieces/GameBoardPieceKaiju';
import { Difficulty, PIECES_INFO } from 'Utils/gameState';
import { MASTER_PENINSULA, MASTER_PENINSULA_TILES as PENINSULA_TILE_LOOKUP_VALS } from './masterPeninsula';

const tileKeys = new Set(PENINSULA_TILE_LOOKUP_VALS.map(({ i, j }) => `${i} ${j}`));

// a tile with room around it in every direction
export const CENTER_TILE = PENINSULA_TILE_LOOKUP_VALS.find(({ i, j }) =>
    [[0, -4], [0, 4], [4, 0], [-4, 0], [4, 4], [-4, -4], [4, -4], [-4, 4]]
        .every(([a, b]) => tileKeys.has(`${i + a} ${j + b}`)));

export const placePiece = (gm, piece, tileIndex) => {
    const location = gm.gameBoardManager.getCharXAndYFromTileIndex(tileIndex);
    piece.tileIndex = tileIndex;
    piece.charLocation = location;
    piece.moveFromLocation = location;
    piece.moveToLocation = location;
    piece.moveToTiles = [];
    piece.touchedTileIndices = [];
    piece.isThere = true;
    piece.isOnTiles = true;
};

export const makeGame = ({
    playerTile = CENTER_TILE,
    kaijuTile = PENINSULA_TILE_LOOKUP_VALS[PENINSULA_TILE_LOOKUP_VALS.length - 1],
    abilities = ['Fire', 'Ice', 'Water'],
    isTeammate = false,
    difficulty = Difficulty.Easy
} = {}) => {
    const settingsManager = new SettingsManager();
    settingsManager.setSortedPlayerChosenAbilityElementsString(abilities);
    settingsManager.setIsTeammate(isTeammate);
    settingsManager.setDifficulty(difficulty);

    const gm = new GameManager({ level: MASTER_PENINSULA, settingsManager });
    gm.initGame();

    const piecesManager = gm.gameBoardPiecesManager;
    const player = piecesManager.getPlayerPiece();
    placePiece(gm, player, playerTile);

    const kaiju = piecesManager.addPiece({
        pieceClass: GameBoardPieceKaiju,
        pieceInfo: {
            ...PIECES_INFO.kaiju,
            abilities: settingsManager.getKaijuAbilities(0),
            spewFireCoolDown: 9000,
            maxLives: 3,
            moveSpeed: 3,
            isDoAvoidEnemy: false
        },
        teamIndex: 1
    });
    placePiece(gm, kaiju, kaijuTile);

    return { gm, player, kaiju, settingsManager, board: gm.gameBoardManager, piecesManager };
};

export const putStatusOnTile = (gm, status, { i, j }, { dirs, count = undefined, teamIndex = 0, targetIndex = 1 }) => {
    const tileStatus = gm.settingsManager.getAbilityAndTileStatusData()[status];
    gm.gameBoardManager.tiles[i][j].updateTileStatus({
        updateKey: 0,
        tileStatus,
        currCount: count ?? tileStatus.range,
        dirs,
        teamIndex,
        targetIndex
    });
};

export const getLitTiles = gm => gm.getTiles().filter(tile => !!tile.getTileStatus());
