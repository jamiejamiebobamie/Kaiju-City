import { describe, expect, it } from 'vitest';
import { GameManager } from 'Game/DataClasses/GameManager';
import { SettingsManager } from 'Game/DataClasses/SettingsManager';
import { LEVELS } from 'Game/DataClasses/Levels/levels';
import { applyChanges, MirrorSender } from './mirror';
import { MultiplayerConfig, setUpCoop } from './multiplayerMatch';

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
});
