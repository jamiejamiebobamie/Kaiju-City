import { addUnlock, getBattlegroundUnlockId, getUnlocks, saveRecruitChoice } from './Unlocks';
import { storage } from 'Utils/storage';

/*
  Everyone the player can be, or have as a teammate.
  'unlock' is the id that opens a character. Without one, they are open from the start.
*/
export const ROSTER = [
  { id: 'guy', name: 'Guy' },
  { id: 'girl', name: 'Girl' },
  { id: 'punk', name: 'Punk Guy', unlock: 'punk' },
  { id: 'black_female', name: 'Punk Girl', unlock: 'black_female' },
  { id: 'mermaid', name: 'Aquarium Worker', unlock: 'mermaid' },
  { id: 'hazmat', name: 'Hazmat Worker', unlock: 'hazmat' },
  { id: 'agent', name: 'Agent', unlock: 'agent' }
];

// powers no one picks or rolls: Kaiju Fire is the Kaiju's own, and Water (Tidal Wave) is kept for the Aquarium fight's hazard (Jamie, 2026-11-05)
export const OUT_OF_PLAY_POWERS = ['kaijuFire', 'water', 'phaseGhost', 'seaGhost', 'flood']; // and the bosses' own statuses

// powers that are closed until the recruit who wields them is terminated
export const SKILL_UNLOCKS = [
  { element: 'wood', name: 'Overgrowth', recruit: 'punk', recruitName: 'Punk Guy' },
  { element: 'death', name: 'Haunt', recruit: 'black_female', recruitName: 'Punk Girl' },
  { element: 'wink', name: 'Charm', recruit: 'mermaid', recruitName: 'the Aquarium Worker' },
  // (Teleport, 'glass', is open from the start: the Agent says to bring it to the Subway. Jamie, 2026-11-06)
];

const getSkillId = (element: string) => `skill-${element}`;

export const getSkillUnlock = (element: string) => SKILL_UNLOCKS.find(skill => skill.element == element);

export const getIsSkillOpen = (element: string) => !getSkillUnlock(element) || getUnlocks().includes(getSkillId(element));

export const unlockRecruitSkill = (recruit: string) => {
  const skill = SKILL_UNLOCKS.find(({ recruit: id }) => id == recruit);
  if (skill) addUnlock(getSkillId(skill.element));
  return skill;
};

export const getIsAvatarOpen = ({ unlock }: { unlock?: string }) => !unlock || getUnlocks().includes(unlock);

// the Lab's tools. each is listed on the home screen once the player has found it.
export const TOOL_UNLOCKS = { avatars: 'tool-avatars', colors: 'tool-colors', abilityEditor: 'tool-ability-editor' };

export const getIsToolOpen = (tool: string) => getUnlocks().includes(TOOL_UNLOCKS[tool]);

export const unlockTool = (tool: string) => addUnlock(TOOL_UNLOCKS[tool]);

// dev testing: every character, power, tool and battleground open at once (and every recruit recruited, for their calls)
export const unlockEverything = (battlegroundIds: Array<string>) => {
  ROSTER.forEach(({ unlock }) => unlock && addUnlock(unlock));
  SKILL_UNLOCKS.forEach(({ element }) => addUnlock(getSkillId(element)));
  Object.values(TOOL_UNLOCKS).forEach(id => addUnlock(id));
  battlegroundIds.forEach(levelId => addUnlock(getBattlegroundUnlockId(levelId)));
  SKILL_UNLOCKS.filter(({ recruit }) => recruit != 'agent').forEach(({ recruit }) => saveRecruitChoice(recruit, 'recruit'));
};

const TEAM_KEY = 'kaiju-team-avatars';
const COLORS_KEY = 'kaiju-avatar-colors';

const load = (key: string) => {
  try {
    return JSON.parse(storage.getItem(key) || '{}');
  } catch {
    return {};
  }
};

const save = (key: string, value: unknown) => {
  try {
    storage.setItem(key, JSON.stringify(value));
  } catch { /* (not remembered) */ }
};

export const loadTeamAvatars = () => {
  const { player, teammate } = load(TEAM_KEY);
  const getIsOnRoster = (id: string) => ROSTER.some(avatar => avatar.id == id);
  return { player: getIsOnRoster(player) ? player : undefined, teammate: getIsOnRoster(teammate) ? teammate : undefined };
};

export const saveTeamAvatars = (player: string, teammate: string) => save(TEAM_KEY, { player, teammate });

// the color a character came out of the vat with, if they have been in it
export const getAvatarColor = (avatar: string): string | undefined => load(COLORS_KEY)[avatar];

export const saveAvatarColor = (avatar: string, color: string) => save(COLORS_KEY, { ...load(COLORS_KEY), [avatar]: color });
