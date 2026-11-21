import { describe, expect, it, vi } from 'vitest';
import { GameManager } from 'Game/DataClasses/GameManager';
import { SettingsManager } from 'Game/DataClasses/SettingsManager';
import { applyChanges, MirrorSender } from './mirror';
import { placePiece } from 'Game/DataClasses/testHelpers';
import { makeMatchTeams, MATCH_TEAMMATES, DEFENSE_LEVEL, getSideKills, updateGuestTakeOver, BATTLEGROUNDS, getBattleground, getMultiplayerKillsToWin, GUEST_PIECE_INDEX, MULTIPLAYER_LEVEL, MultiplayerConfig, setUpMultiplayerMatch } from './multiplayerMatch';

const CONFIG: MultiplayerConfig = { mode: 'standing', level: 'peninsula', teamSize: 0, host: { avatar: 'guy', powers: ['Fire', 'Ice', 'Water'] }, guest: { avatar: 'girl', powers: ['Lightning', 'Wood', 'Metal'] } };

// each browser's match, built as Game.tsx builds it: the host's avatar and powers the player's
const makeSide = (role: 'host' | 'guest', config: MultiplayerConfig = CONFIG) => {
  const settingsManager = new SettingsManager();
  settingsManager.updatePlayerAvatar(CONFIG.host.avatar);
  settingsManager.setSortedPlayerChosenAbilityElementsString(CONFIG.host.powers);
  settingsManager.setIsTeammate(false);
  const gm: any = new GameManager({ level: config.mode == 'defense' ? DEFENSE_LEVEL() : getBattleground(config.level).getLevel(), settingsManager, killsToWin: getMultiplayerKillsToWin(config) } as any);
  gm.initGame();
  setUpMultiplayerMatch(gm, config, role);
  return gm;
};

describe('a multiplayer match', { timeout: 20000 }, () => {
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

  it("makes both sides' teammates at random, none twice across the two while there are enough, each with an attack, a defense and a glow of their own", () => {
    const settingsManager = new SettingsManager();
    const firsts = new Set();
    for (let round = 0; round < 30; round++) {
      const [host, guest] = makeMatchTeams({ size: 2, settingsManager });
      const avatars = [...host, ...guest].map(member => member.avatar);
      expect(new Set(avatars).size).toBe(4); // (unique across both teams)
      avatars.forEach(avatar => expect(MATCH_TEAMMATES).toContain(avatar));
      firsts.add(host[0].avatar);
      [...host, ...guest].forEach(member => {
        expect(member.powers.length).toBe(3);
        expect(new Set(member.powers).size).toBe(3);
        expect(member.color).toMatch(/^#[0-9a-f]{6}$/);
      });
    }
    expect(firsts.size).toBeGreaterThan(1); // (not the Agent first every time)
    const [big] = makeMatchTeams({ size: 5, settingsManager });
    expect(big.length).toBe(5); // (past five, still made)
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

  it("opens the Lab's portal for the whole match", () => {
    const gm = makeSide('host', { ...CONFIG, level: 'lab' });
    const portals = gm.gameBoardManager.wormholes;
    expect(portals.length).toBe(1);
    expect(portals[0].endsAt).toBe(Infinity);
  });

  it('defends the Peninsula: both sides allies against the Kaiju, each kill to the side that made it', () => {
    const config: MultiplayerConfig = { ...CONFIG, mode: 'defense', kaijuToWin: 1 };
    const host = makeSide('host', config);
    const pieces = host.getPieces();
    expect(pieces.slice(0, 2).map((piece: any) => [piece.teamIndex, piece.side])).toEqual([[0, 0], [0, 1]]);
    // a Kaiju comes in
    for (let tick = 0; tick < 3000 && !host.getPieces().some((piece: any) => piece.side === undefined); tick++) host.stepPieces();
    const kaiju = host.getPieces().find((piece: any) => piece.side === undefined);
    expect(kaiju).toBeDefined();
    expect(kaiju.teamIndex).not.toBe(0);
    expect(host.getGameResult()).toBeNull();
    kaiju.lastHitBy = GUEST_PIECE_INDEX;
    kaiju.decrementHealth(host.getAccTime(), 999);
    for (let tick = 0; tick < 20 && !kaiju.getIsDead(); tick++) host.stepPieces();
    kaiju.lastHitBy = GUEST_PIECE_INDEX; // (as the guest's power struck it last)
    expect(getSideKills(host)).toEqual([0, 1]);
    expect(host.getGameResult()).toBe(-1); // (GameResult.PlayerLost: the guest's side beat more)
  });

  it("keeps each side's kills once the fallen Kaiju is brought back, and a Kaiju's touch doesn't take one from its caster", () => {
    const config: MultiplayerConfig = { ...CONFIG, mode: 'defense', kaijuToWin: 5 };
    const host = makeSide('host', config);
    for (let tick = 0; tick < 3000 && !host.getPieces().some((piece: any) => piece.side === undefined); tick++) host.stepPieces();
    const kaiju = host.getPieces().find((piece: any) => piece.side === undefined);
    kaiju.lastCasterHitBy = GUEST_PIECE_INDEX; // (the guest's power struck it...)
    kaiju.lastHitBy = -1; // (...then a Kaiju's touch finished it)
    kaiju.decrementHealth(host.getAccTime(), 999);
    for (let tick = 0; tick < 20 && !kaiju.getIsDead(); tick++) host.stepPieces();
    expect(getSideKills(host)).toEqual([0, 1]);
    kaiju.respawn(host.getAccTime()); // (brought back as the next one: Jamie, the count went back to 0)
    expect(getSideKills(host)).toEqual([0, 1]);
    // the guest's count is the host's, mirrored
    const guest = makeSide('guest', config);
    applyChanges(guest, JSON.parse(JSON.stringify(new MirrorSender().collect(host))));
    expect(getSideKills(guest)).toEqual([0, 1]);
  });

  it("gives a kill made by a charmed Kaiju's touch to the side that charmed it", () => {
    const config: MultiplayerConfig = { ...CONFIG, mode: 'defense', kaijuToWin: 5 };
    const host = makeSide('host', config);
    const getKaiju = () => host.getPieces().filter((piece: any) => piece.side === undefined && !piece.getIsDead());
    for (let tick = 0; tick < 6000 && getKaiju().length < 2; tick++) host.stepPieces();
    const [victim, charmed] = getKaiju();
    expect(charmed).toBeDefined();
    victim.lastCasterHitBy = 0; // (the host's power struck it earlier...)
    charmed.isCharmed = true; // (...then a Kaiju the guest charmed walks into it)
    charmed.charmEndsAt = Infinity;
    charmed.charmedBy = GUEST_PIECE_INDEX;
    charmed.setTeamIndex(0);
    victim.lives = 1;
    placePiece(host, victim, victim.getTileIndex());
    placePiece(host, charmed, victim.getTileIndex());
    for (let tick = 0; tick < 40 && !victim.getIsDead(); tick++) host.stepPieces();
    expect(victim.getIsDead()).toBe(true);
    expect(getSideKills(host)).toEqual([0, 1]);
  });

  it("defense: an Agent on a side does no harm by touch", () => {
    const team = [{ avatar: 'agent', kind: 'agent' as const, powers: ['death', 'wood', 'glass'] }];
    const host = makeSide('host', { ...CONFIG, mode: 'defense', kaijuToWin: 5, teamSize: 1, host: { ...CONFIG.host, team }, guest: { ...CONFIG.guest, team } });
    const agents = host.getPieces().filter((piece: any) => piece.avatar == 'agent');
    expect(agents.length).toBe(2);
    agents.forEach((agent: any) => expect(agent.dealsContactDmg).toBe(false));
  });

  it("ends defense on every Kaiju down, even one killed by no side's hand", () => {
    const config: MultiplayerConfig = { ...CONFIG, mode: 'defense', kaijuToWin: 1 };
    const host = makeSide('host', config);
    for (let tick = 0; tick < 3000 && !host.getPieces().some((piece: any) => piece.side === undefined); tick++) host.stepPieces();
    const kaiju = host.getPieces().find((piece: any) => piece.side === undefined);
    kaiju.lastHitBy = -1; // (no one's: a Kaiju's touch, an unknown status)
    kaiju.decrementHealth(host.getAccTime(), 999);
    for (let tick = 0; tick < 20 && host.getGameResult() === null; tick++) host.stepPieces();
    expect(getSideKills(host)).toEqual([0, 0]);
    expect(host.getGameResult()).not.toBeNull(); // (ended: the count is the Kaiju down)
  });

  it("takes the Aquarium's stairs in a match: through, and out at the far end (it vanished there for good)", () => {
    const host = makeSide('host', { ...CONFIG, level: 'aquarium' });
    const guestOnHost = host.getPieces()[GUEST_PIECE_INDEX];
    const [from, to] = host.level.tileLinks[0];
    placePiece(host, guestOnHost, from);
    guestOnHost.linkArrivalTile = undefined;
    let isOut = false;
    for (let tick = 0; tick < 400 && !isOut; tick++) {
      host.stepPieces();
      isOut = guestOnHost.isOnTiles && !guestOnHost.isInPortal && Math.abs(guestOnHost.getTileIndex().j - to.j) <= 2 && Math.abs(guestOnHost.getTileIndex().i - to.i) <= 2;
    }
    expect(isOut).toBe(true);
  });

  it("goes through a portal quickly in a match (nothing pauses): off the board a moment, then out at the far end", () => {
    const host = makeSide('host');
    const guestOnHost = host.getPieces()[GUEST_PIECE_INDEX];
    const toTile = host.gameBoardManager.walkableTiles[10];
    expect(host.startPortalWalk(guestOnHost, toTile)).toBe(true);
    expect(guestOnHost.isOnTiles).toBe(false); // (no harm can come to them there)
    expect(host.portalWalk).toBeUndefined(); // (no held scene)
    expect(guestOnHost.portalShot).toBeDefined(); // (their camera in close: Jamie, mp playtest 4)
    let wasGone = false;
    for (let tick = 0; tick < 400 && !guestOnHost.isOnTiles; tick++) {
      host.stepPieces();
      wasGone = wasGone || !guestOnHost.isVisible;
    }
    expect(wasGone).toBe(true); // (walked in, gone, walked out)
    expect(guestOnHost.isVisible).toBe(true);
    expect(guestOnHost.portalShot).toBeUndefined();
    const at = guestOnHost.getTileIndex(); // (out at the far end: on it, or a step on from it, all of them in view)
    expect(Math.abs(at.i - toTile.i) + Math.abs(at.j - toTile.j)).toBeLessThanOrEqual(3);
  });
});
