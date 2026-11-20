import { describe, expect, it } from 'vitest';
import { GameManager } from 'Game/DataClasses/GameManager';
import { SettingsManager } from 'Game/DataClasses/SettingsManager';
import { applyChanges, MirrorSender } from './mirror';
import { getMultiplayerKillsToWin, GUEST_PIECE_INDEX, MULTIPLAYER_LEVEL, MultiplayerConfig, setUpMultiplayerMatch } from './multiplayerMatch';

const CONFIG: MultiplayerConfig = { mode: 'standing', host: { avatar: 'guy', powers: ['Fire', 'Ice', 'Water'] }, guest: { avatar: 'girl', powers: ['Lightning', 'Wood', 'Metal'] } };

// each browser's match, built as Game.tsx builds it: the host's avatar and powers the player's
const makeSide = (role: 'host' | 'guest') => {
  const settingsManager = new SettingsManager();
  settingsManager.updatePlayerAvatar(CONFIG.host.avatar);
  settingsManager.setSortedPlayerChosenAbilityElementsString(CONFIG.host.powers);
  settingsManager.setIsTeammate(false);
  const gm: any = new GameManager({ level: MULTIPLAYER_LEVEL, settingsManager, killsToWin: getMultiplayerKillsToWin(CONFIG) } as any);
  gm.initGame();
  setUpMultiplayerMatch(gm, CONFIG, role);
  return gm;
};

describe('a multiplayer match', () => {
  it("is built alike on both sides, the guest's piece moved by the guest's keys on the host, and mirrored back", () => {
    const host = makeSide('host');
    const guest = makeSide('guest');
    expect(host.getPieces().map((piece: any) => [piece.avatar, piece.teamIndex])).toEqual(guest.getPieces().map((piece: any) => [piece.avatar, piece.teamIndex]));
    expect(host.getPieces().length).toBe(2); // (no teammate, no Kaiju)
    const guestOnHost = host.getPieces()[GUEST_PIECE_INDEX];
    expect(guestOnHost.abilities.map((ability: any) => ability.gameBoardPieceAbilityData.element)).toEqual(['lightning', 'wood', 'metal']);
    // the guest's view is its own piece
    expect(guest.gameBoardPiecesManager.getPlayerPiece()).toBe(guest.getPieces()[GUEST_PIECE_INDEX]);
    expect(guest.getFocusPiece()).toBe(guest.getPieces()[GUEST_PIECE_INDEX]);

    const sender = new MirrorSender();
    const send = () => { const changes = sender.collect(host); if (changes) applyChanges(guest, JSON.parse(JSON.stringify(changes))); };
    send();
    const start = { ...guestOnHost.charLocation };
    // the guest's keys, as they'd come over
    guestOnHost.inputHandler.addKey('KeyW');
    let isLit = false;
    for (let tick = 0; tick < 60; tick++) {
      if (tick == 20) guestOnHost.inputHandler.usePlayerAbility('Digit1', host.getAccTime());
      host.stepPieces();
      if (tick % 2 == 0) host.stepTiles();
      send();
      isLit = isLit || host.gameBoardManager.getTilesInFlatArray().some((tile: any) => tile.tileStatus && tile.teamIndex == 1);
    }
    expect(guestOnHost.charLocation).not.toEqual(start); // (it moved)
    expect(host.getPieces()[0].charLocation).toEqual(host.getPieces()[0].moveFromLocation); // (the host's own didn't: no keys)
    expect(guest.getPieces()[GUEST_PIECE_INDEX].charLocation).toEqual(guestOnHost.charLocation);
    expect(isLit).toBe(true); // (its power went off)
  });

  it('is won when the other falls', () => {
    const host = makeSide('host');
    expect(host.getGameResult()).toBeNull();
    const guestOnHost = host.getPieces()[GUEST_PIECE_INDEX];
    guestOnHost.decrementHealth(host.getAccTime(), 99);
    for (let tick = 0; tick < 200 && host.getGameResult() === null; tick++) host.stepPieces();
    expect(host.getGameResult()).not.toBeNull();
  });
});
