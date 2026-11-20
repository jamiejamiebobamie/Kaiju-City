import { describe, expect, it } from 'vitest';
import { GameManager } from 'Game/DataClasses/GameManager';
import { SettingsManager } from 'Game/DataClasses/SettingsManager';
import { LEVELS } from 'Game/DataClasses/Levels/levels';
import { applyChanges, MirrorSender } from './mirror';
import { placePiece } from 'Game/DataClasses/testHelpers';
import { COOP_LINE, getIsSiteLocked, hideCoopTeammate, placeCoopTeammate, MultiplayerConfig, resolveCoopVote, setUpCoop, updateCoopTurnedKaiju, wrapCoopDialogue } from './multiplayerMatch';

const CONFIG: MultiplayerConfig = { mode: 'coop', level: 'peninsula', teamSize: 0, host: { avatar: 'guy', powers: ['Fire', 'Ice', 'Water'], color: '#ff0000' }, guest: { avatar: 'girl', powers: ['Lightning', 'Wood', 'Metal'], color: '#00ff00' } };

// each browser's campaign fight, as Game.tsx builds it: the host's player, the guest's avatar the teammate
const makeSide = (role: 'host' | 'guest', level: any = { ...LEVELS.peninsula, kaijuEntry: undefined }) => {
  const settingsManager = new SettingsManager();
  settingsManager.updatePlayerAvatar(CONFIG.host.avatar);
  settingsManager.setTeammateAvatar(CONFIG.guest.avatar);
  settingsManager.setSortedPlayerChosenAbilityElementsString(CONFIG.host.powers);
  settingsManager.setIsTeammate(true);
  const gm: any = new GameManager({ level, settingsManager } as any);
  gm.initGame();
  const teammate = setUpCoop(gm, CONFIG, role);
  return { gm, teammate };
};

describe('co-op campaign', { timeout: 20000 }, () => {
  it("gives the teammate to the guest: their powers and color, their keys on the host, their view on the guest", () => {
    const host = makeSide('host');
    const guest = makeSide('guest');
    expect(host.teammate).toBeDefined();
    expect(host.teammate.avatar).toBe('girl');
    expect(host.teammate.abilities.map((ability: any) => ability.gameBoardPieceAbilityData.element)).toEqual(['lightning', 'wood', 'metal']);
    expect(host.teammate.color).toBe('#00ff00');
    expect(host.teammate.inputHandler).toBe(host.gm.guestInputHandler);
    expect(guest.gm.gameBoardPiecesManager.getPlayerPiece()).toBe(guest.teammate);
    expect(guest.gm.getFocusPiece()).toBe(guest.teammate);

    const sender = new MirrorSender();
    const send = () => { const changes = sender.collect(host.gm); if (changes) applyChanges(guest.gm, JSON.parse(JSON.stringify(changes))); };
    send();
    const start = { ...host.teammate.charLocation };
    host.teammate.inputHandler.addKey('KeyS');
    for (let tick = 0; tick < 60; tick++) { host.gm.stepPieces(); send(); }
    expect(host.teammate.charLocation).not.toEqual(start);
    expect(guest.teammate.charLocation).toEqual(host.teammate.charLocation);
  });

  it('moves a line on once both have pressed Enter, or their 3 s are up, after a 700 ms hold', () => {
    let advanced = 0;
    let isWaiting = true;
    const gm: any = { cutscene: { index: 0 }, talks: [], getIsDialogueWaiting: () => isWaiting, advanceDialogue: () => { advanced += 1; isWaiting = false; return true; } };
    wrapCoopDialogue(gm);
    expect(gm.updateCoopDialogue(0)).toEqual({ isWaiting: true, host: false, guest: false });
    gm.advanceDialogue(); // (the host's Enter: its check, not the line)
    expect(advanced).toBe(0);
    expect(gm.updateCoopDialogue(100)).toEqual({ isWaiting: true, host: true, guest: false });
    gm.coopVote('guest');
    expect(gm.updateCoopDialogue(200)).toEqual({ isWaiting: true, host: true, guest: true }); // (both: held)
    gm.updateCoopDialogue(200 + COOP_LINE.holdMs - 1);
    expect(advanced).toBe(0);
    gm.updateCoopDialogue(200 + COOP_LINE.holdMs);
    expect(advanced).toBe(1);
    // the next line: nobody presses, the 3 s press for them
    isWaiting = true;
    gm.cutscene.index = 1;
    gm.updateCoopDialogue(5000);
    expect(gm.updateCoopDialogue(5000 + COOP_LINE.autoMs)).toEqual({ isWaiting: true, host: true, guest: true });
    gm.updateCoopDialogue(5000 + COOP_LINE.autoMs + COOP_LINE.holdMs);
    expect(advanced).toBe(2);
  });

  it("settles Recruit or Terminate: one vote stands, the same stands, split or none is a coin flip", () => {
    expect(resolveCoopVote('recruit', undefined, 0.9)).toEqual({ choice: 'recruit', isFlip: false });
    expect(resolveCoopVote(undefined, 'terminate', 0.1)).toEqual({ choice: 'terminate', isFlip: false });
    expect(resolveCoopVote('terminate', 'terminate', 0.1)).toEqual({ choice: 'terminate', isFlip: false });
    expect(resolveCoopVote('recruit', 'terminate', 0.1)).toEqual({ choice: 'recruit', isFlip: true });
    expect(resolveCoopVote(undefined, undefined, 0.9)).toEqual({ choice: 'terminate', isFlip: true });
  });

  it('in sparring, the guest plays the rival: the teammate the host spars', () => {
    const { gm } = makeSide('host', LEVELS['spar-rapidTransit']);
    for (let tick = 0; tick < 5 && !gm.rivalPiece; tick++) gm.stepPieces();
    expect(gm.rivalPiece).toBeDefined();
    expect(updateCoopTurnedKaiju(gm)).toBe(gm.rivalPiece.pieceIndex);
    expect(gm.rivalPiece.inputHandler).toBe(gm.guestInputHandler);
    expect(gm.rivalPiece.isNpc).toBe(false);
    expect(updateCoopTurnedKaiju(gm)).toBeUndefined(); // (once)
  });

  it('goes into a place on the map together: the first there waits, held, till the other comes', () => {
    const { gm, teammate } = makeSide('host', LEVELS.mapSubway);
    const site = gm.level.sites.find((each: any) => each.icon == 'subway');
    const board = gm.gameBoardManager;
    const at = (spot: any) => board.getClosestWalkableTileToLocation(spot);
    const far = at({ x: site.spot.x + 150, y: site.spot.y + 200 });
    placePiece(gm, teammate, far);
    placePiece(gm, gm.getPieces()[0], far);
    gm.getIsAtGoal(); // (armed: away from it)
    placePiece(gm, gm.getPieces()[0], at(site.spot));
    expect(gm.getIsAtGoal()).toBe(false);
    expect(gm.getPieces()[0].isHeld).toBe(true);
    expect(gm.getCoopWait().who).toBe('host');
    // the guest's places: the host's choice, and the Lab; the rest locked
    expect(getIsSiteLocked(site, gm.getCoopWait())).toBe(false);
    expect(getIsSiteLocked({ icon: 'lab', spot: { x: 0, y: 0 } }, gm.getCoopWait())).toBe(false);
    expect(getIsSiteLocked({ icon: 'rooftop', spot: { x: 1, y: 1 } }, gm.getCoopWait())).toBe(true);
    placePiece(gm, teammate, at(site.spot));
    expect(gm.getIsAtGoal()).toBe(true);
    expect(gm.getPieces()[0].isHeld).toBe(false);
  });

  it("goes into the Lab alone (anyone's own), notices the guest at it, and hides and places the teammate", () => {
    const { gm, teammate } = makeSide('host', LEVELS.mapSubway);
    const lab = gm.level.sites.find((each: any) => each.icon == 'lab');
    const board = gm.gameBoardManager;
    const at = (spot: any) => board.getClosestWalkableTileToLocation(spot);
    const far = at({ x: lab.spot.x + 150, y: lab.spot.y + 200 });
    placePiece(gm, teammate, far);
    placePiece(gm, gm.getPieces()[0], far);
    gm.getIsAtGoal();
    // the guest walks to the Lab: noticed (Game sends them off to their own)
    placePiece(gm, teammate, at(lab.spot));
    gm.getIsAtGoal();
    expect(gm.coopGuestToLab).toBe(true);
    hideCoopTeammate(gm);
    expect(teammate.isVisible).toBe(false);
    expect(teammate.isOnTiles).toBe(false);
    // the host into the Lab: not held, the guest away
    placePiece(gm, gm.getPieces()[0], at(lab.spot));
    expect(gm.getIsAtGoal()).toBe(true);
    // the guest back: by the Lab
    placeCoopTeammate(gm, lab.spot);
    expect(teammate.isVisible).toBe(true);
    expect(teammate.isOnTiles).toBe(true);
  });
});
