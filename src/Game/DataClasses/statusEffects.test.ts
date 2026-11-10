import { describe, expect, it } from 'vitest';
import { LEVELS } from './Levels/levels';
import { GameManager } from './GameManager';
import { SettingsManager } from './SettingsManager';

// the effects over the pieces' heads (Jamie, 2026-11-10)
const makeGame = (elements = ['Ice', 'Lightning', 'Fire']) => {
  const settingsManager = new SettingsManager();
  settingsManager.setSortedPlayerChosenAbilityElementsString(elements);
  settingsManager.setIsTeammate(true);
  const gm: any = new GameManager({ level: LEVELS.peninsula, settingsManager });
  gm.initGame();
  return gm;
};
const ids = (gm, piece) => piece.getStatusEffects(gm.gameBoardPiecesManager.getPlayerTeamIndex()).map(({ id }) => id);
const setPassive = (piece, element, isOn) => {
  const ability = piece.abilities.find(a => a.gameBoardPieceAbilityData.element == element);
  ability.isPassiveApplied = isOn;
  return ability;
};

describe('status effects', () => {
  it('slowed (Ice Slice’s passive), fast (Discharge’s), and Wildfire’s stacks for the team', () => {
    const gm = makeGame();
    const player = gm.getPieces()[0];
    expect(ids(gm, player)).toEqual([]);
    setPassive(player, 'ice', true);
    setPassive(player, 'lightning', true);
    const fire = setPassive(player, 'fire', true);
    fire.stacks = 2;
    expect(ids(gm, player)).toEqual(['slowed', 'fast', 'burn']);
    expect(player.getStatusEffects(0).find(({ id }) => id == 'burn').count).toBe(2);
  });

  it('wading in the water: slowed, with its stacks', () => {
    const gm = makeGame(['Fire', 'Metal', 'Bubble']);
    const player = gm.getPieces()[0];
    player.accTime = 1000;
    player.waterSlowEnds = [1500, 1600];
    const slowed = player.getStatusEffects(0).find(({ id }) => id == 'slowed');
    expect(slowed.count).toBe(2);
  });

  it('charmed, and spurned (an NPC after its charmer); no icon for being unhurtable', () => {
    const gm = makeGame(['Fire', 'Metal', 'Bubble']);
    gm.kaijuManager.addKaijuPiece(gm.accTime);
    const [player] = gm.getPieces();
    const kaiju = gm.getPieces().find(piece => piece.avatar == 'kaiju');
    kaiju.isCharmed = true;
    expect(ids(gm, kaiju)).toContain('charmed');
    kaiju.isCharmed = false;
    kaiju.spurnedBy = player.pieceIndex;
    expect(ids(gm, kaiju)).toContain('spurned');
    kaiju.isUnhurtable = true;
    expect(ids(gm, kaiju)).not.toContain('unhurtable');
  });

  it('Dispel wiping other passives counts a Clean Slate', () => {
    const gm = makeGame(['Fire', 'Metal', 'Bubble']);
    const player = gm.getPieces()[0];
    setPassive(player, 'metal', true);
    const bubble = player.abilities.find(a => a.gameBoardPieceAbilityData.element == 'bubble');
    bubble.useAbility({ accTime: 5000, piece: player, registerTimeout: () => {}, updateTileWithAbilityStatus: () => {} });
    expect(player.cleanSlateCount).toBe(1);
  });
});
