import { PIECES_INFO } from 'Utils/gameState';
import { getAvatarColor } from 'Game/DataClasses/Avatars';

// with the color they came out of the Lab's vat with
const getPieceInfo = avatar => ({ ...PIECES_INFO[avatar], color: getAvatarColor(avatar) || PIECES_INFO[avatar].color });
import { GameBoardPieceBase } from './GameBoardPieceBase';
import { Team } from './Team';

export class GameBoardPiecesManager {
    constructor({ gameManagerProxy }) {
        this.pieces = [];
        this.deathPieces = [];
        this.teams = [];
        this.gameManagerProxy = gameManagerProxy;
    }

    getPlayerPiece = () => {
        const player = this.pieces[0];
        return player;
    }

    getPiece = (pieceIndex) => {
        const piece = this.pieces[pieceIndex];
        return piece;
    }

    getPieces() {
        return this.pieces;
    }

    getDeathPieces() {
        return this.deathPieces;
    }

    getIsPlayerTeamDead() {
        return this.getTeamPieces(this.getPlayerTeamIndex()).every(piece => piece.getIsDead());
    }

    getPlayerTeamUiState() {
        return this.getTeamPieces(this.getPlayerTeamIndex()).map(piece => piece.getUiState());
    }

    // is anyone else on this side, on the board and alive?
    getHasAllyOnBoard = (pieceIndex, teamIndex) => {
        return this.pieces.some(piece => piece.pieceIndex != pieceIndex && piece.teamIndex == teamIndex && !piece.isDead && piece.isOnTiles);
    }

    getIsPieceOnTile = ({ i, j }) => {
        return this.pieces.some(({ isDead, isOnTiles, tileIndex }) => !isDead && isOnTiles && tileIndex.i == i && tileIndex.j == j);
    }

    getIsContactDmg = (pieceIndex, { i, j }) => {
        const teamIndex = this.pieces[pieceIndex].teamIndex;
        return this.pieces.some(({ teamIndex: otherTeamIndex, dealsContactDmg, isDead, isOnTiles, tileIndex }) =>
            dealsContactDmg && otherTeamIndex != teamIndex && !isDead && isOnTiles && tileIndex.i == i && tileIndex.j == j);
    }

    // after the walkable tiles change: 'hitOffTiles' is run on any piece left off of them
    updatePiecesForWalkableTiles(hitOffTiles) {
        this.pieces.filter(piece => !piece.isDead && piece.isOnTiles).forEach(piece => {
            piece.trimPathToWalkableTiles();
            if (!this.gameManagerProxy.getIsInBounds(piece.getTileIndex())) hitOffTiles(piece);
        });
    }

    applyDmgFromTouchedTiles(accTime) {
        this.pieces.forEach(piece => piece.applyDmgFromTouchedTiles(accTime));
    }

    getMostDmgedTeammate = (pieceIndex) => {

        const teamIndex = this.pieces[pieceIndex].teamIndex;
        const teammateIndices = this.teams[teamIndex].getTeamPiecesIndices();

        let mostDmgedTeammateIndex = pieceIndex;
        let lowestHealth = this.pieces[pieceIndex].getLives();

        teammateIndices.forEach(i => {
            const test = this.pieces[i].getLives();
            if (!this.pieces[i].getIsDead() && lowestHealth > test) {
                lowestHealth = test;
                mostDmgedTeammateIndex = i;
            }
        })

        return this.pieces[mostDmgedTeammateIndex];
    }

    getPieceTileIndex = (pieceIndex) => {
        const pieceTileIndex = this.pieces[pieceIndex].tileIndex;
        return pieceTileIndex;
    }

    getPlayerTeamIndex() {
        const playerTeamIndex = this.pieces[0].getTeamIndex();
        return playerTeamIndex;
    }

    getPieceTeamIndex = (pieceIndex) => {
        const teamIndex = this.pieces[pieceIndex].getTeamIndex();
        return teamIndex;
    }

    // with too few spawn tiles, the rest of the team starts beside the first
    initPlayerLocationsOnBoard(spawnTiles = []) {
        const isOnTiles = true;
        const [firstTile] = spawnTiles;
        const spareTiles = firstTile ? this.gameManagerProxy.getTilesAround(firstTile) : [];
        this.pieces.forEach((p, i) => p.initCharLocation(isOnTiles, spawnTiles[i] || spareTiles[i - spawnTiles.length]));
    }

    changeAvatar(piece, avatar) {
        piece.applyAvatar(getPieceInfo(avatar));
    }

    getTeamLeaderPiece = (pieceIndex) => {
        const teamIndex = this.pieces[pieceIndex].getTeamIndex();
        const leaderPieceIndex = this.teams[teamIndex].getTeamLeaderIndex();
        const leaderPiece = this.pieces[leaderPieceIndex];
        return leaderPiece;
    }

    getIsAllLivingPiecesFromOneTeam() {
        let winningTeamIndex = -1;
        const isOnlyOneTeamStanding = this.pieces.every(piece => {

            // do not consider dead pieces.
            if (piece.isDead)
                return true;

            /*
                init 'winningTeamIndex.'
                continue to next living piece...
            */
            if (winningTeamIndex == -1) {
                winningTeamIndex = piece.teamIndex;
                return true;

                /*
                    every living piece's teamIndex must equal the 'winningTeamIndex.'
                */
            } else {
                const isOnlyOneTeamAlive = piece.teamIndex == winningTeamIndex;
                return isOnlyOneTeamAlive;
            }
        });
        return isOnlyOneTeamStanding;
    }

    getIsSomePiecesAlive() {
        const isSomeAlive = this.pieces.some(({ isDead }) => !isDead);
        return isSomeAlive;
    }

    movePieces({ accTime, playerInputHandler }) {
        this.pieces.forEach(p => p.movePiece({ accTime, playerInputHandler }));
    }

    // recruits walk with the team, and have no powers of their own here
    addFollower(avatar, tileIndex) {
        const piece = this.addPiece({ pieceInfo: { ...getPieceInfo(avatar), abilities: [] } });
        piece.initCharLocation(true, tileIndex);
        return piece;
    }

    addPlayer({ playerAvatar, playerAbilities }) {
        const pieceInfo = { ...getPieceInfo(playerAvatar), isNpc: false, abilities: playerAbilities };
        this.addPiece({ pieceInfo });
    }

    addTeammate({ teammateAvatar, teammateAbilities }) {
        const pieceInfo = { ...getPieceInfo(teammateAvatar), abilities: teammateAbilities };
        this.addPiece({ pieceInfo });
    }

    getTeamPieces = (teamIndex) => {
        const teamPiecesIndices = this.teams[teamIndex].getTeamPiecesIndices();
        const teamPieces = teamPiecesIndices.map(pieceIndex => this.pieces[pieceIndex]);
        return teamPieces
    }

    spawnDeathPieceAtLocation = (charLocation, avatar, tileIndex, color, pieceIndex) => {
        const zIndex = this.gameManagerProxy.getFlattenedArrayIndex(tileIndex);
        this.deathPieces.push({ key: this.deathPieces.length, charLocation, avatar, zIndex, color, pieceIndex });
    }

    getIsTeamDamaged = (pieceIndex) => {
        const teamIndex = this.pieces[pieceIndex].teamIndex;
        const teammates = this.teams[teamIndex].teammateIndices;
        return teammates.some(pieceIndex => {
            const teammate = this.pieces[pieceIndex];
            return !teammate.getIsDead() && teammate.lives < teammate.maxLives;
        });
    }

    getOtherTeamsPieces = (pieceIndex) => {
        const teamIndex = this.pieces[pieceIndex].teamIndex;
        const otherTeamsPieces = this.pieces.filter(p => p.teamIndex != teamIndex);
        return otherTeamsPieces;
    }

    addTeam(pieceIndex) {
        const newTeam = new Team({ teamLeaderIndex: pieceIndex, teamIndex: this.teams.length, teammateIndices: [pieceIndex] });
        this.teams.push(newTeam);
    }

    removeTeam(teamIndex) {
        if (this.teams.some(t => t.teamIndex == teamIndex)) {
            this.teams.splice(teamIndex, 1);
        }
    }

    addPiece = ({ pieceClass = GameBoardPieceBase, pieceInfo, teamIndex = 0 }) => {
        const pieceIndex = this.pieces.length;

        const classInfo = { ...pieceInfo, pieceIndex, teamIndex, gameManagerProxy: this.gameManagerProxy };

        const newPiece = new pieceClass(classInfo);
        this.pieces.push(newPiece);

        // SIDE-EFFECT: create new Team if team does not exist
        if (!this.teams[teamIndex]) {
            this.addTeam(pieceIndex);
            newPiece.setIsTeamLeader(true);
        } else {
            this.teams[teamIndex].addTeammate(pieceIndex);
        }

        return newPiece;
    }

    removePiece(pieceIndex) {
        const removedPiece = this.pieces.splice(pieceIndex, 1);
        this.teams[removedPiece.teamIndex].removeTeammate(removedPiece.pieceIndex);
    }

    resetPieces() {
        this.pieces = [];
        this.teams = [];
        this.deathPieces = [];
    }
    getPieceColorsLookup() {
        // create lookup of tileindex string: '0 1' to GamePiece color for 'redrawTiles' method
        return this.pieces.filter(p => p.isOnTiles && !p.isDead && !p.isTileHidden).reduce((lookup, piece) => {
            lookup[`${piece.tileIndex.i} ${piece.tileIndex.j}`] = piece.getColor();
            return lookup;
        }, {});
    }
    // - - - - - - - - - -
}