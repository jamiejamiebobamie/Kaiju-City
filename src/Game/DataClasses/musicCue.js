/*
  Which theme plays, as things stand in a level (Jamie, 2026-11-26; the themes: Utils/musicThemes.js):
  - a recruit's area: their own theme on its walking level, at their intro and at their recruit choice; the battle
    theme once the fight is on (the Kaiju part touched); training and sparring a lighter take of the battle;
  - the Street the Sleazy Agent's; the Peninsula's fights the Kaiju fight; the map walk the Peninsula map's;
  - the Lab: its own theme walking; the Agents' showdown talk the Agent's; their fight, and the trap's chase, the Lab
    escape's; the Sewers' own, tense by the glowing door and at the climb to the whiteout;
  - the final fight: the Kaiju fight, the teammate's slow take as they turn, the final battle against them;
  - multiplayer: the battleground's battle theme.
  'intensity' 1 brings in a theme's tense layer: the ghost rings, the Aquarium's flood.
*/

const AREAS = {
  rapidTransit: { character: "punk", battle: "subwayBattle" },
  rooftop: { character: "ghostGirl", battle: "rooftopBattle" },
  aquarium: { character: "mermaid", battle: "aquariumBattle" },
  floodedAquarium: { character: "mermaid", battle: "aquariumBattle" }
};
const getBaseId = id => String(id || "").replace(/^(visit|train|spar)-/, "");

export const getMusicCue = gm => {
  const level = gm.level || {};
  const id = level.id;
  const baseId = getBaseId(id);
  const area = AREAS[baseId];
  const phases = new Set(gm.getActivePhases ? gm.getActivePhases() : []);
  const cue = (musicId, extra = {}) => ({ musicId, musicLight: !!extra.isLight, musicIntensity: extra.intensity || 0 });

  if (level.isMultiplayer) {
    if (area) return cue(area.battle);
    if (baseId == "lab") return cue("labEscape");
    return cue("kaijuFight");
  }
  if (level.finalTurn) {
    if (gm.finalTurnState == "turning") return cue("teammateSad");
    if (gm.finalTurnState == "fighting" || level.finalTurn.isStartTurned) return cue("finalBattle");
    if (gm.finalTurnState == "saved" || gm.finalTurnState == "destroyed") return cue("teammateSad");
    return cue("kaijuFight");
  }
  if (level.isMapWalk) return cue("peninsulaMap");
  if (area) {
    if (level.isWalkingLevel) return cue(area.character);
    if (gm.recruitScene) return cue(area.character);
    if (level.isTraining) return cue(area.battle, { isLight: true }); // (sparring too: Jamie, 2026-11-26)
    const touch = level.rival && level.rival.touchPhase;
    // (their intro: the Kaiju part not yet touched. Once touched, the fight's on for good, whatever the phases do after)
    if (touch && phases.has(touch)) gm.isMusicFightOn = true;
    if (touch && !gm.isMusicFightOn) return cue(area.character);
    const isTense = (baseId == "rooftop" && (!!gm.ghostRing || !!gm.isGhostPhase)) || (baseId == "aquarium" && (!!gm.aquariumFlood || !!gm.isShattered));
    return cue(area.battle, { intensity: isTense ? 1 : 0 });
  }
  if (baseId == "street") return cue("agent");
  if (level.trap) return cue((gm.getPieces ? gm.getPieces() : []).some(piece => piece.isChaser) ? "labEscape" : "lab");
  if (level.agentDrops || level.showdown) return cue(gm.cutscene && !gm.cutscene.isMidFight ? "agent" : "labEscape");
  if (baseId == "labIntro" || baseId == "labBeforeTrap" || baseId == "lab") return cue("lab");
  if (baseId == "sewer1" || baseId == "sewer2") return cue("sewers", { intensity: phases.has("glow") || phases.has("blinding") ? 1 : 0 });
  if (level.kaijuEntry || baseId == "peninsula" || baseId == "finalBattle") return cue("kaijuFight");
  return cue(undefined);
};
