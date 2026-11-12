/*
  Objectives (Jamie, 2026-11-10): what the player is to do now, a short line. A new one shows as a green title on the
  screen, and runs as a ticker in the display in the casing. None: the display shows nothing.
  'Defeat the Kaiju' shows the Kaiju count there, as it always has.
*/

export type Objective = { text: string; isKaijuCount?: boolean } | null;

export const KAIJU_OBJECTIVE = { text: 'Defeat the Kaiju', isKaijuCount: true };

// the map walks: where they lead
export const MAP_OBJECTIVES: Record<string, string> = {
  mapSubway: 'Go to the Transit Station',
  mapRooftop: 'Go to the Rooftop',
  mapAquarium: 'Go to the Aquarium',
  mapLab: 'Go to the Lab'
};

export const OBJECTIVES = {
  street: { talk: 'Talk to Agent', leave: 'Go to the Transit Station' },
  rivals: { punk: 'Defeat Punk Guy', black_female: 'Defeat Ghost Girl', mermaid: 'Defeat Aquarium Worker' } as Record<string, string>,
  ghosts: 'Survive the Ghosts',
  ghostForm: 'Defeat Ghostly Ghost Girl', // (Jamie: with "Punk Girl" now "Ghost Girl")
  flood: 'Survive the Flood',
  escape: 'Escape the Lab',
  glow: 'Investigate the Glow',
  agents: 'Defeat the Agents', // (Jamie, playtest 18)
  stopTeammate: (name: string) => `Stop Kaiju ${name}!` // what he's become, named (Jamie, playtest 21)
};

// a detour off a map walk (the walking Lab, a battleground visited again): the walk's objective carries over
export const getIsDetourLevel = (levelId: string) => levelId == 'labIntro' || levelId.startsWith('visit-');

export const getIsSameObjective = (a: Objective, b: Objective) => (a && a.text) == (b && b.text);
