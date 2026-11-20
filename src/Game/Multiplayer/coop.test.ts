import { describe, expect, it } from 'vitest';
import { GameManager } from 'Game/DataClasses/GameManager';
import { SettingsManager } from 'Game/DataClasses/SettingsManager';
import { LEVELS } from 'Game/DataClasses/Levels/levels';
import { applyChanges, MirrorSender } from './mirror';
import { COOP_LINE, MultiplayerConfig, resolveCoopVote, setUpCoop, wrapCoopDialogue } from './multiplayerMatch';

const CONFIG: MultiplayerConfig = { mode: 'coop', level: 'peninsula', teamSize: 0, host: { avatar: 'guy', powers: ['Fire', 'Ice', 'Water'], color: '#ff0000' }, guest: { avatar: 'girl', powers: ['Lightning', 'Wood', 'Metal'], color: '#00ff00' } };

// each browser's campaign fight, as Game.tsx builds it: the host's player, the guest's avatar the teammate
const makeSide = (role: 'host' | 'guest') => {
  const settingsManager = new SettingsManager();
  settingsManager.updatePlayerAvatar(CONFIG.host.avatar);
  settingsManager.setTeammateAvatar(CONFIG.guest.avatar);
  settingsManager.setSortedPlayerChosenAbilityElementsString(CONFIG.host.powers);
  settingsManager.setIsTeammate(true);
  const gm: any = new GameManager({ level: { ...LEVELS.peninsula, kaijuEntry: undefined }, settingsManager } as any);
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
});
