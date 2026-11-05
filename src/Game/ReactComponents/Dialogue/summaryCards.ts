import type { DialogueScene } from 'Game/DataClasses/Dialogue/dialogue';
import { fillPronouns } from 'Game/DataClasses/Dialogue/dialogue';
import { getSectionItems, RIVALS, STORY, StoryPath } from './storyPath';

/*
  The story-so-far summaries, one card per section version.
  A section's version is what the player sees there: its place and its lines on a path. Paths that see the same thing share a card,
  and cards don't depend on Guy or Girl: they are written with {player} and {teammate}, and pronoun words, filled when shown.
  Each card is written to build on the cards before it. It is out of date when anything before it changes on a path that uses it;
  a change after it never touches it. The cards are written in a Claude Code session, into summaries.json.
*/

// what the art of each part of the story shows: the summaries carry its meaning in words
export const SETTINGS: Record<string, string> = {
  'Peninsula 1': 'A night map of Kaiju City on its peninsula, seen from above: a grid of streets and parks, dark sea on both coasts with boats, and a purple glow out in the water where Kaiju come ashore. The team stands on the hex grid laid over the city; Kaiju wade in from the edges.',
  'Street': 'A sunny downtown street cordoned off after a battle: a giant clawed Kaiju hand lies in a pool of pink goo, a severed tail drips green slime over a building, a staring eyeball sits in the road, a tentacle hangs over the skyline and another hand rests on a rooftop. Hazmat workers sweep and hurry about; a van stands with its doors open and glowing cargo inside. The Agent waits down the street.',
  'Map to Subway': 'The night map of the peninsula again, now with places to go marked by glowing icons: the subway station ahead, and the Lab, which the team can stop by.',
  'The Lab (a stop on any map walk)': 'A clean, high-tech laboratory: tilted glass tanks hold suspended figures (avatar bodies, and insect-winged humanoid specimens), technicians in white coats watch monitors at a desk, and a huge dark window fills the back wall. A side room holds a glowing irradiation vat where the player dips to change their glow.',
  'Subway': 'A grimy underground rapid transit station: two platforms either side of the tracks, graffiti and pink flowering vines on the walls, red signal lights over the tunnel, and a giant Kaiju eye that has fallen onto the platform. Trains rush through and close the tracks.',
  'Peninsula 2': 'The peninsula night map again, a second and larger wave of Kaiju coming in from the coast.',
  'Map to Rooftop': 'The night map, with the rooftop cemetery district marked and the battlegrounds already won still showing.',
  'Rooftop': 'A cemetery on top of a city building: rows of gravestones, a small mausoleum and a stone marked RIP, a crane over the next building, the city and the sea below under a grey sky. A giant Kaiju head part has landed among the graves.',
  'Peninsula 3': 'The peninsula night map, with the shipping lanes gone dark and the biggest wave yet coming in.',
  'Map to Aquarium': 'The night map, with the Kaiju City Aquarium marked up the east coast.',
  'Aquarium': 'The grand hall of the Kaiju City Aquarium: tall glass tanks of fish, an eel and an octopus, Kaiju skeletons displayed like dinosaur fossils, staircases to the upper floors, and a giant Kaiju tongue lying in the hall. A skylight shatters and the floor floods.',
  'Peninsula 4': 'The peninsula night map, Kaiju coming from every approach.',
  'Map to Lab': 'The night map, with only the Lab marked: the team is called in.',
  'Lab trap': 'The Lab again, now with clones of the Agent stepping out of the tanks along both walls; the Agent fires a ray that drains the team, and they flee for the exit.',
  'Sewer 1': 'A dark, wet sewer under the Lab: brick tunnels, a catwalk over murky water, and a doorway that starts to glow.',
  'Sewer 2': 'A deeper sewer chamber filled with glowing, pulsing Kaiju parts flushed down from the Lab: an eye, a tail, a tooth, viscera, a bone and a claw. Touching them, the team is lost in a blinding white light.',
  'Lab fight': 'The Lab\'s great window room high over the city, with a catwalk above and tanks holding Kaiju silhouettes. The Agent is joined by his clones, who drop from the catwalk.',
  'Final battle': 'The peninsula night map once more: the final battle for the city.',
  'Visiting a battleground (any map walk, after its fight)': 'A battleground already won, quiet now, visited from the map.'
};

// every path the summaries read: each bystander recruited or terminated (Guy and Girl read alike)
export const getSummaryPaths = (): Array<StoryPath> => {
  const paths: Array<StoryPath> = [];
  for (let k = 0; k < 2 ** RIVALS.length; k++) {
    const choices = Object.fromEntries(RIVALS.map(({ id }, bit) => [id, (k >> bit) & 1 ? 'terminate' : 'recruit'])) as StoryPath['choices'];
    paths.push({ avatar: 'neutral', powerName: '{power}', choices });
  }
  return paths;
};

// a section as the summary's writer sees it on a path: its place, its lines, and what the player chose there
export const getSectionContent = (sectionIndex: number, path: StoryPath, scenes: Record<string, DialogueScene>) => {
  const section = STORY[sectionIndex];
  const lines = getSectionItems(sectionIndex, path, scenes).flatMap(item => item.kind == 'line' ? [item] : (item.versions[item.taken] ? item.versions[item.taken].items : []))
    .map(({ speakerName, text }) => speakerName ? `${speakerName}: ${text}` : text);
  const rival = RIVALS.find(({ id }) => id == section.rival);
  const choice = rival ? [`The player's choice: ${path.choices[rival.id] == 'recruit' ? 'recruit' : 'terminate'} ${rival.name}.`] : [];
  return [`Place: ${SETTINGS[section.label] || section.label}`, ...lines, ...choice].join('\n');
};

// a short, steady hash: the same words always give the same value
export const hashText = (text: string) => {
  let hash = 2166136261;
  for (let k = 0; k < text.length; k++) {
    hash ^= text.charCodeAt(k);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
};

export type SummaryCard = { id: string; sectionIndex: number; label: string; content: string; ancestorHashes: Array<string>; paths: Array<StoryPath> };

// every card the story needs, in story order
export const getSummaryCards = (scenes: Record<string, DialogueScene>): Array<SummaryCard> => {
  const cards = new Map<string, SummaryCard>();
  const paths = getSummaryPaths();
  STORY.forEach((section, sectionIndex) => paths.forEach(path => {
    const content = getSectionContent(sectionIndex, path, scenes);
    const id = `${sectionIndex}:${hashText(content)}`;
    const before = STORY.slice(0, sectionIndex).map((_, earlier) => getSectionContent(earlier, path, scenes)).join('\n---\n');
    const card = cards.get(id) || { id, sectionIndex, label: section.label, content, ancestorHashes: [], paths: [] };
    const ancestorHash = hashText(before);
    if (!card.ancestorHashes.includes(ancestorHash)) card.ancestorHashes.push(ancestorHash);
    card.paths.push(path);
    cards.set(id, card);
  }));
  return [...cards.values()];
};

// what summaries.json keeps for a card: its words, and what came before it when they were written
export type StoredSummary = { text: string; section: string; ancestorHashes: Array<string> };

export const getCardStatus = (card: SummaryCard, stored: Record<string, StoredSummary>) => {
  const saved = stored[card.id];
  if (!saved) return 'missing';
  return card.ancestorHashes.every(hash => saved.ancestorHashes.includes(hash)) ? 'ok' : 'stale';
};

// one path's cards, from the start up to and including a section
export const getPathCards = (cards: Array<SummaryCard>, path: StoryPath, upToSection: number) => cards
  .filter(({ sectionIndex, paths }) => sectionIndex <= upToSection && paths.some(({ choices }) => Object.keys(choices).every(id => choices[id] == path.choices[id])))
  .sort((a, b) => a.sectionIndex - b.sectionIndex);

// a card's words for whoever is playing
export const fillSummary = (text: string, avatar: string) => fillPronouns(text
  .replace(/\{player\}/g, avatar == 'girl' ? 'Girl' : 'Guy')
  .replace(/\{teammate\}/g, avatar == 'girl' ? 'Guy' : 'Girl'), avatar);
