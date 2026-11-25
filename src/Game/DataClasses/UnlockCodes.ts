import { ROSTER, SKILL_UNLOCKS, unlockEverything } from './Avatars';
import { GAME_BEATEN_UNLOCK, getBattlegroundUnlockId, getUnlocks } from './Unlocks';

/*
  Unlock codes (Jamie, 2026-11-24): typed into the Lab monitor's UNLOCK.EXE (LabTerminal), in the walking Lab or from
  Settings on the start screen. Caps or not, it doesn't matter. Each says what it opened, and shows a card for each
  thing it opened that wasn't open already (Jamie: none shown again).
  KAIJU: shown when the game is beaten. Everything a full playthrough opens: Multiplayer, every avatar, power, tool and
  battleground.
*/
export const BEATEN_CODE = 'KAIJU';

const BATTLEGROUNDS = [
  { id: 'rapidTransit', name: 'Rapid Transit Station' },
  { id: 'rooftop', name: 'Rooftop Cemetary' },
  { id: 'aquarium', name: 'Kaiju City Aquarium' }
];

// a card for something opened: a face, a battleground's picture, or a power's tile
export type UnlockCardInfo = { id: string; label: string; image?: string; power?: string };

// what KAIJU opens that a player can see, as cards (the Lab's tools open too, but they're hidden for now: no cards)
export const getEverythingCards = (): Array<UnlockCardInfo> => [
  ...ROSTER.filter(({ unlock }) => unlock && unlock != 'hazmat').map(({ id, name, unlock }) => ({ id: unlock as string, label: `${name} unlocked!`, image: `/levels/portraits/${id}.png` })),
  ...SKILL_UNLOCKS.map(({ element, name }) => ({ id: `skill-${element}`, label: `${name} power unlocked!`, power: element })),
  ...BATTLEGROUNDS.map(({ id, name }) => ({ id: getBattlegroundUnlockId(id), label: `${name} unlocked!`, image: `/levels/${id}.png` })),
  { id: GAME_BEATEN_UNLOCK, label: 'Multiplayer unlocked!' }
];

export const UNLOCK_CODES: Record<string, { result: string; getCards: () => Array<UnlockCardInfo>; apply: () => void }> = {
  [BEATEN_CODE]: { result: 'ALL UNLOCKED. MULTIPLAYER OPEN.', getCards: getEverythingCards, apply: () => unlockEverything(BATTLEGROUNDS.map(({ id }) => id)) }
};

// the code typed: what it opened and the cards for what's new, or undefined if it's not a code
export const enterUnlockCode = (typed: string) => {
  const code = UNLOCK_CODES[String(typed || '').trim().toUpperCase()];
  if (!code) return undefined;
  const opened = getUnlocks();
  const cards = code.getCards().filter(({ id }) => !opened.includes(id));
  code.apply();
  return { result: code.result, cards };
};
