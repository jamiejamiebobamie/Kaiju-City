import { describe, expect, it } from 'vitest';
import { LEVELS, TRAINING_PHASE, getTrainingLevelId, getVisitLevelId } from './Levels/levels';
import { GameManager, GameResult } from './GameManager';
import { SettingsManager } from './SettingsManager';
import { storage } from 'Utils/storage';
import { getIsSkillOpen, unlockRecruitSkill } from './Avatars';

// recruit training (Jamie, 2026-11-10)
const makeGame = (level, { isTeammate = true, recruits = [] as Array<string> } = {}) => {
  const settingsManager = new SettingsManager();
  settingsManager.setSortedPlayerChosenAbilityElementsString(['Fire', 'Ice', 'Metal']);
  settingsManager.setIsTeammate(isTeammate);
  const gm: any = new GameManager({ level, settingsManager, recruits, autoRecruits: recruits });
  gm.initGame();
  return gm;
};
const skip = gm => { for (let k = 0; k < 4000 && gm.cutscene; k++) gm.stepPieces(); };

describe('recruit training', () => {
  it('on a visit, the recruited bystander offers training: then "Do Training" opens in the middle of the battlefield', () => {
    storage.clear();
    const gm = makeGame(LEVELS[getVisitLevelId('rapidTransit')], { recruits: ['punk'] });
    expect(gm.getTrainingOffer()).toBeDefined();
    const said = [];
    for (let k = 0; k < 4000 && gm.cutscene; k++) {
      if (gm.speech && !said.includes(gm.speech.text)) said.push(gm.speech.text);
      gm.stepPieces();
    }
    expect(said.some(text => text.includes('Overgrowth'))).toBe(true);
    expect(gm.getActivePhases()).toContain(TRAINING_PHASE);
    // walking to it ends the visit, for the training fight
    const player = gm.getPieces()[0];
    player.initCharLocation(true, gm.gameBoardManager.getClosestWalkableTileToLocation(LEVELS[getVisitLevelId('rapidTransit')].training.spot));
    gm.stepPieces();
    expect(gm.isTrainingChosen).toBe(true);
    expect(gm.getGameResult()).toBe(GameResult.PlayerWon);
  });

  it('no offer without the recruit, or once their power is open', () => {
    storage.clear();
    const without = makeGame(LEVELS[getVisitLevelId('rapidTransit')]);
    expect(without.getTrainingOffer()).toBeUndefined();
    unlockRecruitSkill('punk');
    const open = makeGame(LEVELS[getVisitLevelId('rapidTransit')], { recruits: ['punk'] });
    expect(open.getTrainingOffer()).toBeUndefined();
    storage.clear();
  });

  it('the training fight: the recruit one on one, no Kaiju part or boss phases (the Subway keeps its trains); beating them wins', () => {
    ['rapidTransit', 'rooftop', 'aquarium'].forEach(levelId => {
      const level = LEVELS[getTrainingLevelId(levelId)];
      expect(level.isTraining).toBe(true);
      expect(!!level.hasTrainSchedule).toBe(levelId == 'rapidTransit'); // as often as the Punk Guy fight (Jamie, playtest 19)
      expect(level.ghostBoss).toBeUndefined();
      expect(level.aquariumFlood).toBeUndefined();
      const gm = makeGame(level, { isTeammate: false, recruits: ['punk', 'black_female', 'mermaid'] });
      skip(gm);
      gm.stepPieces();
      const team = gm.gameBoardPiecesManager.getTeamPieces(gm.gameBoardPiecesManager.getPlayerTeamIndex());
      expect(team.length).toBe(1); // no teammate, no recruits
      const rival = gm.rivalPiece;
      expect(rival.avatar).toBe(LEVELS[levelId].rival.avatar);
      expect(gm.getActivePhases().some(phase => /touched|Touched|tongue|head|eye/.test(phase))).toBe(false);
      gm.accTime += 5000;
      rival.lastDmgAccTime = 0;
      rival.decrementHealth(gm.accTime, rival.lives + rival.livesModifier);
      expect(gm.getGameResult()).toBe(GameResult.PlayerWon);
    });
  });

  it('winning unlocks the recruit’s power', () => {
    storage.clear();
    expect(getIsSkillOpen('death')).toBe(false);
    expect(unlockRecruitSkill('black_female').name).toBe('Haunt');
    expect(getIsSkillOpen('death')).toBe(true);
    storage.clear();
  });
});
