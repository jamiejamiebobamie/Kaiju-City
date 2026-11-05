
/*
    centralized proxy class for calling functions from various delegate classes in GameManager.
    some functions are dependent on the GameBoard boundaries and need to be updated in the proxy when the Bounds change
*/
export class GameManagerProxy {
    constructor(props) {
        this.props = props;
    }

    // Call 'updateProps' when the Bounds change
    updateProps(props) {
        this.props = props;
    }

    getFlattenedArrayIndex(tileIndex) {
        return this.props.getFlattenedArrayIndex(tileIndex);
    }

    getPieceTileIndex(pieceIndex) {
        return this.props.getPieceTileIndex(pieceIndex);
    }

    getMostDmgedTeammate(pieceIndex) {
        return this.props.getMostDmgedTeammate(pieceIndex);
    }

    getIsPowersOff(piece = undefined) {
        return !!this.props.getIsPowersOff && this.props.getIsPowersOff(piece);
    }

    // someone else stands on the tile, and NPCs keep their distance here (SpacingTest.ts)
    getIsTileTakenForSpacing(pieceIndex, tile) {
        return !!this.props.getIsTileTakenForSpacing && this.props.getIsTileTakenForSpacing(pieceIndex, tile);
    }

    getPiece(pieceIndex) {
        return this.props.getPiece(pieceIndex);
    }

    getPieceTeamIndex(pieceIndex) {
        return this.props.getPieceTeamIndex(pieceIndex);
    }

    getOtherTeamsPieces(pieceIndex) {
        return this.props.getOtherTeamsPieces(pieceIndex);
    }

    getTeamLeaderPiece(pieceIndex) {
        return this.props.getTeamLeaderPiece(pieceIndex);
    }

    addWormhole(from, to, accTime, durationMs) {
        this.props.addWormhole(from, to, accTime, durationMs);
    }

    getIsSoapy(tileIndex) {
        return this.props.getIsSoapy(tileIndex);
    }

    getStatusCaster(tileIndex) {
        return this.props.getStatusCaster(tileIndex);
    }

    getStatusDirs(tileIndex) {
        return this.props.getStatusDirs(tileIndex);
    }

    getTilesAround(tileIndex) {
        return this.props.getTilesAround(tileIndex);
    }

    getCharmingTeam(pieceIndex) {
        return this.props.getCharmingTeam(pieceIndex);
    }

    clearTileStatusUnderPiece(pieceIndex) {
        return this.props.clearTileStatusUnderPiece(pieceIndex);
    }

    getHasAllyOnBoard(pieceIndex, teamIndex) {
        return this.props.getHasAllyOnBoard(pieceIndex, teamIndex);
    }

    getDmg(pieceIndex, tileIndex) {
        return this.props.getDmg(pieceIndex, tileIndex);
    }

    addPiece(accTime) {
        return this.props.addPiece(accTime);

    }
    getTeamPieces(teamIndex) {
        return this.props.getTeamPieces(teamIndex);
    }

    determineKaijuDetails() {
        return this.props.determineKaijuDetails();
    }

    getPathToClosestEnemy(pieceIndex) {
        return this.props.getPathToClosestEnemy(pieceIndex);
    }

    getPathFromTileToTile({ fromTile, toTile, avoidTiles, isAlwaysAvoid }) {
        return this.props.getPathFromTileToTile({ fromTile, toTile, avoidTiles, isAlwaysAvoid });
    }

    getClosestEnemy(pieceIndex) {
        return this.props.getClosestEnemy(pieceIndex);
    }

    getCharXAndYFromTileIndex(tileIndex) {
        return this.props.getCharXAndYFromTileIndex(tileIndex);
    }

    getRandomTileIndexOnBoard() {
        return this.props.getRandomTileIndexOnBoard();
    }

    getMoveOntoGameBoardMovementData() {
        return this.props.getMoveOntoGameBoardMovementData();
    }

    getAbilityAndTileStatusData() {
        return this.props.getAbilityAndTileStatusData();
    }

    getKaijuAbilities(accTime) {
        return this.props.getKaijuAbilities(accTime);
    }

    moveTo({
        currentLocation,
        moveFromLocation,
        moveToLocation,
        moveSpeed
    }) {
        const { newLocation, hasArrived } = this.props.moveTo({
            currentLocation,
            moveFromLocation,
            moveToLocation,
            moveSpeed
        });
        return { newLocation, hasArrived };
    }

    getTileOffsetFromDir(dir, tileIndex) {
        return this.props.getTileOffsetFromDir(dir, tileIndex);
    }

    // one end of a Teleport's wormhole (not a level's own link, like the Aquarium's stairs)
    getIsWormholeTile(tileIndex) {
        return !!this.props.getIsWormholeTile && this.props.getIsWormholeTile(tileIndex);
    }

    getLinkedTile(tileIndex) {
        return this.props.getLinkedTile(tileIndex);
    }

    getIsInBounds(tileIndex) {
        return this.props.getIsInBounds(tileIndex);
    }

    getIsClosedTile(tileIndex) {
        return this.props.getIsClosedTile(tileIndex);
    }

    getSafeTileIndex(pieceIndex) {
        return this.props.getSafeTileIndex(pieceIndex);
    }

    resetHightlightedTiles() {
        return this.props.resetHightlightedTiles();
    }

    getIsPieceInDanger(pieceIndex) {
        return this.props.getIsPieceInDanger(pieceIndex);
    }

    getIsTeamDamaged(pieceIndex) {
        return this.props.getIsTeamDamaged(pieceIndex);
    }

    getIsPieceOnTile(tileIndex) {
        return this.props.getIsPieceOnTile(tileIndex);
    }

    getIsContactDmg(pieceIndex, tileIndex) {
        return this.props.getIsContactDmg(pieceIndex, tileIndex);
    }

    getAccTime() {
        return this.props.getAccTime();
    }

    getPathToSafeTileAndAvoidEnemies(pieceIndex) {
        return this.props.getPathToSafeTileAndAvoidEnemies(pieceIndex);
    }

    getPathToSafeTile(pieceIndex) {
        return this.props.getPathToSafeTile(pieceIndex);
    }

    getPathToTeamLeader(pieceIndex) {
        return this.props.getPathToTeamLeader(pieceIndex);
    }

    spawnDeathPieceAtLocation(charLocation, avatar, tileIndex, color, pieceIndex, throwVec, spriteSheetSrc) {
        return this.props.spawnDeathPieceAtLocation(charLocation, avatar, tileIndex, color, pieceIndex, throwVec, spriteSheetSrc);
    }

    getDirFromTiles(fromTile, toTile) {
        return this.props.getDirFromTiles(fromTile, toTile)
    }

    registerTimeout = (callback, delay) => {
        const timeoutRef = this.props.registerTimeout(callback, delay);
        return timeoutRef;
    }

    unregisterTimeout = (timeoutRef) => {
        this.props.unregisterTimeout(timeoutRef);
    }

    updateTileWithAbilityStatus = ({
        accTime,
        pieceIndex,
        appliedStatus,
        isBuffed,
        stackRange,
        areaBonus
    }) => {
        this.props.updateTileWithAbilityStatus({
            accTime,
            pieceIndex,
            appliedStatus,
            isBuffed,
            stackRange,
            areaBonus
        });
    }

    updateScore(teamIndex) {
        this.props.updateScore(teamIndex);
    }

    findPathFromTo({ from, to, avoid }) {
        return this.props.findPathFromTo(from, to, avoid);
    }

    getPlayerPiece() {
        return this.props.getPlayerPiece();
    }

    getClickedTileIndex() {
        return this.props.getClickedTileIndex();
    }

    setClickedTileIndex(clickedTileIndex) {
        this.props.setClickedTileIndex(clickedTileIndex);
    }

    getHoveredTileIndex() {
        return this.props.getHoveredTileIndex();
    }

    setHoveredTileIndex(hoveredTileIndex) {
        this.props.setHoveredTileIndex(hoveredTileIndex);
    }

    getHighlightedTiles() {
        return this.props.getHighlightedTiles();
    }

    clearClickedTileIndex(){
        this.props.clearClickedTileIndex();
    }
}