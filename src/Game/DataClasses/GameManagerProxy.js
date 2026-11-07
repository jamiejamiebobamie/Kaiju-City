
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
    // the player stepping through a portal or a tile link: true if the game plays it out
    startPortalWalk(piece, toTile) {
        return !!this.props.startPortalWalk && this.props.startPortalWalk(piece, toTile);
    }

    // the player's Teleport toward the rival on other ground: the tiles to it across the gaps, or undefined
    getTeleportAcross(fromTile, pressedDir, playerInputHandler) {
        return this.props.getTeleportAcross ? this.props.getTeleportAcross(fromTile, pressedDir, playerInputHandler) : undefined;
    }

    // a status kept to its own ground (the Aquarium's sea creatures, to the flooded floor)
    getIsStatusAllowedOn(appliedStatus, tileIndex) {
        return !this.props.getIsStatusAllowedOn || this.props.getIsStatusAllowedOn(appliedStatus, tileIndex);
    }

    // the ghost boss: where the teammate steps inside the ghost ring, or undefined when it isn't in one
    getGhostRingMove(piece) {
        return this.props.getGhostRingMove ? this.props.getGhostRingMove(piece) : undefined;
    }

    getIsWormholeTile(tileIndex) {
        return !!this.props.getIsWormholeTile && this.props.getIsWormholeTile(tileIndex);
    }

    // a tile this piece must keep off: the Lab's catwalk, for the Agents' side, but for the talker waiting up there
    getIsOffLimitsTile(pieceIndex, tileIndex) {
        return !!this.props.getIsOffLimitsTile && this.props.getIsOffLimitsTile(pieceIndex, tileIndex);
    }

    // what each tile adds to this piece's path: others standing there, or headed there (empty with spacing off)
    getCrowdCosts(pieceIndex) {
        return this.props.getCrowdCosts ? this.props.getCrowdCosts(pieceIndex) : new Map();
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

    // 'isTeleport': where a Teleport lands. a piece that can teleport across (the Subway's Punk Guy) may pick a tile it can't walk to
    getSafeTileIndex(pieceIndex, isTeleport = false) {
        return this.props.getSafeTileIndex(pieceIndex, isTeleport);
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