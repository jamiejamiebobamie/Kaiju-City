import { describe, expect, it } from 'vitest';
import { makeGame } from 'Game/DataClasses/testHelpers';
import { applyChanges, MirrorSender } from './mirror';

// the host's match run, the guest's only given its changes (through JSON, as over the wire): they look the same
describe('multiplayer mirroring', { timeout: 20000 }, () => { // (slow under the full suite's load)
  it("the guest's pieces and tiles follow the host's", () => {
    const host = makeGame({ abilities: ['Fire', 'Ice', 'Water'] });
    const guest = makeGame({ abilities: ['Fire', 'Ice', 'Water'] });
    const sender = new MirrorSender();
    const send = () => {
      const changes = sender.collect(host.gm);
      if (changes) applyChanges(guest.gm, JSON.parse(JSON.stringify(changes)));
    };
    send();
    host.gm.getPlayerInputHandler().addKey('KeyD');
    for (let tick = 0; tick < 120; tick++) {
      if (tick == 10) host.gm.getPlayerInputHandler().usePlayerAbility('Digit1', host.gm.getAccTime());
      if (tick == 40) host.gm.getPlayerInputHandler().usePlayerAbility('Digit2', host.gm.getAccTime());
      host.gm.stepPieces();
      if (tick % 2 == 0) host.gm.stepTiles();
      send();
    }
    const hostPieces = host.gm.getPieces();
    const guestPieces = guest.gm.getPieces();
    expect(guestPieces.length).toBe(hostPieces.length);
    hostPieces.forEach((piece: any, k: number) => {
      expect(guestPieces[k].charLocation).toEqual(piece.charLocation);
      expect(guestPieces[k].tileIndex).toEqual(piece.tileIndex);
      expect(guestPieces[k].lives).toBe(piece.lives);
      expect(guestPieces[k].facingDir).toBe(piece.facingDir);
    });
    const statusOf = (gm: any) => gm.gameBoardManager.getTilesInFlatArray().map((tile: any) => (tile.tileStatus ? tile.tileStatus.appliedStatus : '') + tile.currCount);
    expect(statusOf(host.gm).some((status: string) => status.startsWith('is'))).toBe(true); // (powers were cast)
    expect(statusOf(guest.gm)).toEqual(statusOf(host.gm));
    // the guest's shared status data is its own, not a copy
    const lit = guest.gm.gameBoardManager.getTilesInFlatArray().find((tile: any) => tile.tileStatus);
    expect(Object.values(guest.gm.settingsManager.abilityAndTileStatusData)).toContain(lit.tileStatus);
    expect(guest.gm.getAccTime()).toBe(host.gm.getAccTime());
  });

  it('sends nothing when nothing changed', () => {
    const host = makeGame();
    const sender = new MirrorSender();
    sender.collect(host.gm);
    expect(sender.collect(host.gm)).toBeUndefined();
  });

  it('sends the ragdolls: a body falls on the guest too', () => {
    const host = makeGame();
    const guest = makeGame();
    const sender = new MirrorSender();
    const send = () => { const changes = sender.collect(host.gm); if (changes) applyChanges(guest.gm, JSON.parse(JSON.stringify(changes))); };
    send();
    host.player.decrementHealth(host.gm.getAccTime(), 99);
    for (let tick = 0; tick < 10; tick++) { host.gm.stepPieces(); send(); }
    const hostDeaths = host.gm.getDeathPieces();
    expect(hostDeaths.length).toBeGreaterThan(0);
    expect(guest.gm.getDeathPieces().map((death: any) => death.key)).toEqual(hostDeaths.map((death: any) => death.key));
    expect(guest.gm.getDeathPieces()[0].avatar).toBe(hostDeaths[0].avatar);
  });

  it("sends the board's wormholes whole, a never-closing one too", () => {
    const host = makeGame();
    const guest = makeGame();
    const sender = new MirrorSender();
    const tiles = host.gm.gameBoardManager.walkableTiles;
    host.gm.gameBoardManager.addWormhole(tiles[0], tiles[5], 0, Infinity);
    applyChanges(guest.gm, JSON.parse(JSON.stringify(sender.collect(host.gm))));
    const [portal] = guest.gm.gameBoardManager.wormholes;
    expect(portal.from).toEqual(tiles[0]);
    expect(portal.to).toEqual(tiles[5]);
    expect(portal.endsAt).toBe(Infinity);
  });
});
