import { expect, it } from 'vitest';
import { GameManager } from 'Game/DataClasses/GameManager';
import { SettingsManager } from 'Game/DataClasses/SettingsManager';
import { getBattleground, setUpMultiplayerMatch } from './multiplayerMatch';
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
