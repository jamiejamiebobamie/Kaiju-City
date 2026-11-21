import { expect, it } from 'vitest';
import { GameManager } from 'Game/DataClasses/GameManager';
import { SettingsManager } from 'Game/DataClasses/SettingsManager';
import { placePiece } from 'Game/DataClasses/testHelpers';
import { getBattleground, setUpMultiplayerMatch } from './multiplayerMatch';
// Jamie (mp playtest 2): a ghost fired at a player standing close by looped round them and never landed. Aimed from
// where it goes next (GameBoardManager), it lands, from any side, near or far
it('a chasing ghost lands on a player standing still close by, from any side', () => {
  const out: any[] = [];
  for (const [casterIndex, power, di, dj] of [[0, 'Death', 2, 0], [0, 'Death', 3, 1], [0, 'Death', 4, 2], [0, 'Death', 0, 3], [0, 'Death', 5, 0], [1, 'Death', -3, 1]] as const) {
    const s = new SettingsManager();
    s.updatePlayerAvatar('guy');
    s.setSortedPlayerChosenAbilityElementsString([power, 'Ice', 'Fire']);
    s.setIsTeammate(false);
    const config: any = { mode: 'standing', level: 'rapidTransit', teamSize: 0, host: { avatar: 'guy', powers: [power, 'Ice', 'Fire'] }, guest: { avatar: 'girl', powers: [power, 'Ice', 'Fire'] } };
    const gm: any = new GameManager({ level: getBattleground('rapidTransit').getLevel(), settingsManager: s } as any);
    gm.initGame();
    setUpMultiplayerMatch(gm, config, 'host');
    const [host, guest] = gm.getPieces();
    for (let k = 0; k < 40; k++) gm.stepPieces();
    const ht = host.getTileIndex();
    const near = gm.gameBoardManager.getClosestWalkableTileToLocation(gm.gameBoardManager.getCharXAndYFromTileIndex({ i: ht.i + di, j: ht.j + dj }));
    placePiece(gm, guest, near);
    const caster = casterIndex == 1 ? guest : host;
    const target = casterIndex == 1 ? host : guest;
    if (casterIndex == 1) guest.inputHandler.usePlayerAbility('Digit1', gm.getAccTime());
    else gm.getPlayerInputHandler().usePlayerAbility('Digit1', gm.getAccTime());
    const t = target.getTileIndex();
    let hit = -1; const trail: string[] = [];
    for (let tick = 0; tick < 60; tick++) {
      gm.stepPieces(); if (tick % 2 == 0) gm.stepTiles();
      const lit = gm.gameBoardManager.getTilesInFlatArray().filter((x: any) => x.tileStatus && x.tileStatus.appliedStatus != 'isTeleportTile');
      if (tick % 4 == 0) trail.push(lit.map((x: any) => `${x.tileIndex.i},${x.tileIndex.j}:${x.targetIndex}`).slice(0, 4).join(' '));
      if (hit < 0 && lit.some((x: any) => x.tileIndex.i == t.i && x.tileIndex.j == t.j)) hit = tick;
    }
    out.push({ caster: casterIndex, power, from: caster.getTileIndex(), target: t, targetIndex: target.pieceIndex, hit, trail: trail.slice(0, 10) });
  }
  out.forEach(({ hit, from, target }) => expect(hit, `from ${JSON.stringify(from)} at ${JSON.stringify(target)}`).toBeGreaterThanOrEqual(0));
});
