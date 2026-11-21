import { expect, it } from 'vitest';
import { GameManager } from 'Game/DataClasses/GameManager';
import { SettingsManager } from 'Game/DataClasses/SettingsManager';
import { getBattleground, setUpMultiplayerMatch } from './multiplayerMatch';
import { placePiece } from 'Game/DataClasses/testHelpers';
// Jamie (mp playtest 2): the guest's Teleport, the train in: toward the host's platform, across to it
it("the guest's Teleport crosses the tracks to the host's platform while the train's in", () => {
  const out: any[] = [];
  for (const key of ['KeyA']) { // (the host's platform is to the left)
    const s = new SettingsManager();
    s.updatePlayerAvatar('guy'); s.setSortedPlayerChosenAbilityElementsString(['Fire', 'Ice', 'Water']); s.setIsTeammate(false);
    const config: any = { mode: 'standing', level: 'rapidTransit', teamSize: 0, host: { avatar: 'guy', powers: ['Fire', 'Ice', 'Water'] }, guest: { avatar: 'girl', powers: ['Glass', 'Ice', 'Fire'] } };
    const gm: any = new GameManager({ level: getBattleground('rapidTransit').getLevel(), settingsManager: s } as any);
    gm.initGame(); setUpMultiplayerMatch(gm, config, 'host');
    const [host, guest] = gm.getPieces();
    for (let k = 0; k < 60; k++) gm.stepPieces();
    gm.trainSchedule.setIsTrainIn(true, gm.getAccTime());
    for (let k = 0; k < 5; k++) gm.stepPieces();
    const before = { g: gm.getTeleportRegion(guest.getTileIndex()), h: gm.getTeleportRegion(host.getTileIndex()), gt: guest.getTileIndex(), ht: host.getTileIndex() };
    guest.inputHandler.usePlayerAbility('Digit1', gm.getAccTime());
    guest.inputHandler.addKey(key);
    for (let k = 0; k < 40; k++) gm.stepPieces();
    out.push({ key, before, after: { g: gm.getTeleportRegion(guest.getTileIndex()), gt: guest.getTileIndex() }, should: guest.shouldTeleport });
  }
  expect(out[0].after.g).toBe(out[0].before.h);
  expect(out[0].after.gt.i).toBeLessThan(out[0].before.gt.i - 10);
});

// Jamie (mp playtest 4): fleeing. An enemy close by on one's own platform, the Teleport pressed away from them: onto the
// furthest other platform that way, to its far edge. No enemy close: an ordinary Teleport, on one's own platform
const fleeFrom = (isEnemyNear: boolean) => {
  const s = new SettingsManager();
  s.updatePlayerAvatar('guy'); s.setSortedPlayerChosenAbilityElementsString(['Fire', 'Ice', 'Water']); s.setIsTeammate(false);
  const config: any = { mode: 'standing', level: 'rapidTransit', teamSize: 0, host: { avatar: 'guy', powers: ['Fire', 'Ice', 'Water'] }, guest: { avatar: 'girl', powers: ['Glass', 'Ice', 'Fire'] } };
  const gm: any = new GameManager({ level: getBattleground('rapidTransit').getLevel(), settingsManager: s } as any);
  gm.initGame(); setUpMultiplayerMatch(gm, config, 'host');
  const [host, guest] = gm.getPieces();
  for (let k = 0; k < 60; k++) gm.stepPieces();
  gm.trainSchedule.setIsTrainIn(true, gm.getAccTime());
  for (let k = 0; k < 5; k++) gm.stepPieces();
  const board = gm.gameBoardManager;
  const own = gm.getTeleportRegion(guest.getTileIndex());
  // the host beside the guest, to their right on their platform (or far off along it)
  const g = guest.getTileIndex();
  const spot = isEnemyNear
    ? board.walkableTiles.filter((t: any) => gm.getTeleportRegion(t) == own && t.i > g.i && t.i - g.i <= 3 && Math.abs(t.j - g.j) <= 2)[0]
    : [...board.walkableTiles].filter((t: any) => gm.getTeleportRegion(t) == own).sort((a: any, b: any) => (Math.abs(b.i - g.i) + Math.abs(b.j - g.j)) - (Math.abs(a.i - g.i) + Math.abs(a.j - g.j)))[0];
  placePiece(gm, host, spot);
  guest.inputHandler.addKey('KeyA'); // (away: to the left, toward the other platforms)
  guest.inputHandler.usePlayerAbility('Digit1', gm.getAccTime());
  for (let k = 0; k < 200 && (guest.isInPortal || guest.shouldTeleport || k < 10); k++) gm.stepPieces();
  const after = gm.getTeleportRegion(guest.getTileIndex());
  return { own, after };
};
it("the Teleport flees onto other ground, away from an enemy close by on one's own", () => {
  const { own, after } = fleeFrom(true);
  expect(after).not.toBe(own);
});
it('the Teleport stays on its own ground with no enemy close by', () => {
  const { own, after } = fleeFrom(false);
  expect(after).toBe(own);
});
