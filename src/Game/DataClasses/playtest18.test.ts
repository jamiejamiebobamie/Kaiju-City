import { describe, expect, it } from 'vitest';
import { LEVELS, updateMapWalkSites } from './Levels/levels';
import { getTileCenter } from './GameBoard/hexGrid';
import { GameManager, HAZMAT_RECRUIT } from './GameManager';
import { SettingsManager } from './SettingsManager';
import { WORMHOLE_USED_MS } from './GameBoard/GameBoardManager';
import { OBJECTIVES } from './Objectives';

// playtest 18 (Jamie, 2026-11-11)
const makeGame = (level, options: any = {}) => {
  const settingsManager = new SettingsManager();
  settingsManager.setSortedPlayerChosenAbilityElementsString(['Fire', 'Ice', 'Metal']);
  settingsManager.setIsTeammate(true);
  const gm: any = new GameManager({ level, settingsManager, ...options });
  gm.initGame();
  return gm;
};
const key = tile => `${tile.i} ${tile.j}`;

describe('playtest 18', () => {
  it('E2: the Hazmat Worker has Aegis, Heal and Dispel, no attack', () => {
    expect(HAZMAT_RECRUIT.abilities).toEqual(['metal', 'love', 'bubble']);
  });

  it('E1: Punk Guy teleports twice as often in his fight, not in his training', () => {
    const gm = makeGame(LEVELS.rapidTransit);
    const teleport = gm.rivalPiece.abilities.find(ability => ability.gameBoardPieceAbilityData.element == 'glass');
    expect(teleport.cooldownScale).toBe(0.5);
    expect((LEVELS['training-rapidTransit'] || Object.values(LEVELS).find(level => level.isTraining && level.rival.avatar == 'punk')).rival.cooldownScales).toBeUndefined();
  });

  it('E9: a used portal goes in half the time', () => {
    expect(WORMHOLE_USED_MS).toBe(1250);
  });

  it('A10: "Defeat the Agents"', () => {
    expect(OBJECTIVES.agents).toBe('Defeat the Agents');
  });

  it('B2: recruits walking with the team start on tiles of their own, not the player\'s', () => {
    const gm = makeGame(LEVELS.labIntro, { autoRecruits: ['punk', 'hazmat'], recruits: ['punk', 'hazmat'] });
    const player = gm.gameBoardPiecesManager.getPlayerPiece();
    gm.followers.forEach(piece => expect(key(piece.getTileIndex())).not.toBe(key(player.getTileIndex())));
  });

  it('C3: back in the walking Lab, the Agent doesn\'t greet the team again', () => {
    const first = makeGame(LEVELS.labIntro);
    const again = makeGame(LEVELS.labIntro, { isRevisit: true });
    [first, again].forEach(gm => { gm.talks = []; gm.addSceneTalks(); });
    expect(first.talks.length).toBeGreaterThan(0);
    expect(again.talks.length).toBeLessThan(first.talks.length);
  });

  it('B7: a map walk never starts by a site, even one won before (the Transit Station after the Rooftop)', () => {
    updateMapWalkSites(['rapidTransit', 'rooftop']);
    ['mapRooftop', 'mapAquarium'].forEach(id => {
      const gm = makeGame(LEVELS[id]);
      const player = gm.gameBoardPiecesManager.getPlayerPiece();
      const { x, y } = getTileCenter(LEVELS[id].grid, player.getTileIndex());
      const { rowStep, scale } = LEVELS[id].grid;
      LEVELS[id].sites.forEach(({ spot }) => expect(Math.hypot(x - spot.x, y - spot.y)).toBeGreaterThan(4 * rowStep * scale));
    });
    updateMapWalkSites([]);
  });

  it('A11: a new objective waits till a scene is over, even one in mid-fight', () => {
    const gm = makeGame(LEVELS.rapidTransit);
    for (let k = 0; k < 4000 && gm.cutscene; k++) gm.stepPieces();
    gm.stepPieces();
    const before = gm.objectiveCount;
    gm.startCutscene([{ shot: { isWide: true }, ms: 1000 }], { isMidFight: true });
    gm.getCurrentObjective = () => ({ text: 'Something new' });
    gm.updateObjective();
    expect(gm.objectiveCount).toBe(before);
    gm.cutscene = undefined;
    gm.updateObjective();
    expect(gm.objectiveCount).toBe(before + 1);
  });

  it('B1: the Street Agent is drawn behind the team', () => {
    const gm = makeGame(LEVELS.street);
    const [agent] = gm.extras;
    expect(agent.zIndexOffset).toBeLessThan(0);
  });
});
