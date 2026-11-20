import { describe, expect, it, vi } from 'vitest';
import { GameManager } from 'Game/DataClasses/GameManager';
import { SettingsManager } from 'Game/DataClasses/SettingsManager';
import { applyChanges, MirrorSender } from './mirror';
import { updateGuestTakeOver, BATTLEGROUNDS, getBattleground, getMultiplayerKillsToWin, GUEST_PIECE_INDEX, MULTIPLAYER_LEVEL, MultiplayerConfig, setUpMultiplayerMatch } from './multiplayerMatch';

const CONFIG: MultiplayerConfig = { mode: 'standing', level: 'peninsula', teamSize: 0, host: { avatar: 'guy', powers: ['Fire', 'Ice', 'Water'] }, guest: { avatar: 'girl', powers: ['Lightning', 'Wood', 'Metal'] } };

// each browser's match, built as Game.tsx builds it: the host's avatar and powers the player's
const makeSide = (role: 'host' | 'guest', config: MultiplayerConfig = CONFIG) => {
  const settingsManager = new SettingsManager();
  settingsManager.updatePlayerAvatar(CONFIG.host.avatar);
  settingsManager.setSortedPlayerChosenAbilityElementsString(CONFIG.host.powers);
  settingsManager.setIsTeammate(false);
  const gm: any = new GameManager({ level: getBattleground(config.level).getLevel(), settingsManager, killsToWin: getMultiplayerKillsToWin(config) } as any);
  gm.initGame();
  setUpMultiplayerMatch(gm, config, role);
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

  it("builds each side's team alike, and is only over when a whole side is down", () => {
    const team = (avatar: string) => [{ avatar, kind: 'teammate' as const, powers: ['fire', 'ice', 'metal'] }, { avatar: 'agent', kind: 'agent' as const, powers: ['death', 'wood', 'glass'] }];
    const config: MultiplayerConfig = { ...CONFIG, teamSize: 2, host: { ...CONFIG.host, team: team('girl') }, guest: { ...CONFIG.guest, team: team('guy') } };
    const host = makeSide('host', config);
    const guest = makeSide('guest', config);
    const describe = (gm: any) => gm.getPieces().map((piece: any) => [piece.avatar, piece.teamIndex, piece.abilities.map((a: any) => a.gameBoardPieceAbilityData.element).join()]);
    expect(describe(host)).toEqual(describe(guest));
    expect(host.getPieces().length).toBe(6);
    const pieces = host.getPieces();
    pieces[GUEST_PIECE_INDEX].decrementHealth(host.getAccTime(), 99);
    host.stepPieces();
    expect(host.getGameResult()).toBeNull(); // (the guest's team fights on)
    pieces.filter((piece: any) => piece.teamIndex == 1).forEach((piece: any) => piece.decrementHealth(host.getAccTime(), 99));
    for (let tick = 0; tick < 50 && host.getGameResult() === null; tick++) host.stepPieces();
    expect(host.getGameResult()).not.toBeNull();
  });

  it('builds on every battleground, the two sides apart', () => {
    BATTLEGROUNDS.forEach(({ id }) => {
      const gm = makeSide('host', { ...CONFIG, level: id });
      const [a, b] = gm.getPieces();
      expect(a.getTileIndex()).toBeDefined();
      expect(b.getTileIndex()).toBeDefined();
      expect(JSON.stringify(a.getTileIndex())).not.toBe(JSON.stringify(b.getTileIndex()));
      expect(gm.rivalPiece).toBeUndefined();
    });
  });

  it("hands the guest's keys to the next of their side once their piece is down, and colors each side as its player", () => {
    vi.useFakeTimers();
    const team = [{ avatar: 'agent', kind: 'agent' as const, powers: ['death', 'wood', 'glass'] }];
    const config: MultiplayerConfig = { ...CONFIG, teamSize: 1, host: { ...CONFIG.host, color: '#ff0000', team }, guest: { ...CONFIG.guest, color: '#00ff00', team } };
    const host = makeSide('host', config);
    const pieces = host.getPieces();
    expect(pieces.map((piece: any) => piece.color)).toEqual(['#ff0000', '#00ff00', '#ff0000', '#00ff00']);
    expect(host.getStatusTeamColor(1, 1)).toBe('#00ff00');
    expect(pieces.map((piece: any) => piece.isShowHealthBarOnComponent)).toEqual([false, true, false, true]);
    const guestAgent = pieces[3];
    pieces[GUEST_PIECE_INDEX].decrementHealth(host.getAccTime(), 99);
    expect(updateGuestTakeOver(host)).toBeUndefined(); // (the camera holds on the death first)
    vi.advanceTimersByTime(2000);
    expect(updateGuestTakeOver(host)).toBe(3);
    expect(guestAgent.inputHandler).toBe(host.guestInputHandler);
    expect(guestAgent.isNpc).toBe(false);
    vi.useRealTimers();
  });
});
