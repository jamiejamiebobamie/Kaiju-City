import { DialogueLine, DialogueScene, fillPronouns } from 'Game/DataClasses/Dialogue/dialogue';
import { ROSTER } from 'Game/DataClasses/Avatars';

/*
  The story in the order it is played, and which of dialogue.json's scenes play in each part.
  The viewer reads one path through it at a time: the player's avatar, a power, and what they did with each bystander.
*/
export type StorySection = { label: string; scenes: Array<string>; rival?: string };

export const STORY: Array<StorySection> = [
  { label: 'Peninsula 1', scenes: ['radio.peninsula1', 'peninsula.arrival'] },
  { label: 'Street', scenes: ['street.greeting', 'street.talk'] },
  { label: 'Map to Subway', scenes: [] },
  { label: 'The Lab (a stop on any map walk)', scenes: ['labIntro.welcome', 'labIntro.nervous', 'labIntro.vatPraise'] },
  { label: 'Subway', scenes: ['rapidTransit.intro', 'recruit.choice'], rival: 'punk' },
  { label: 'Peninsula 2', scenes: ['radio.peninsula2'] },
  { label: 'Map to Rooftop', scenes: ['radio.mapRooftop'] },
  { label: 'Rooftop', scenes: ['rooftop.intro', 'rooftop.afterTouch', 'rooftop.ghostScream', 'recruit.choice'], rival: 'black_female' },
  { label: 'Peninsula 3', scenes: ['radio.peninsula3'] },
  { label: 'Map to Aquarium', scenes: ['radio.mapAquarium'] },
  { label: 'Aquarium', scenes: ['aquarium.intro', 'aquarium.stopScream', 'aquarium.toCreatures', 'recruit.choice'], rival: 'mermaid' },
  { label: 'Peninsula 4', scenes: ['radio.peninsula4'] },
  { label: 'Map to Lab', scenes: ['radio.mapLab'] },
  { label: 'Lab trap', scenes: ['labTrap.trap', 'labTrap.chase'] },
  { label: 'Sewer 1', scenes: ['sewer1.walkIn', 'sewer1.reveal'] },
  { label: 'Sewer 2', scenes: ['sewer2.walkIn'] },
  { label: 'Lab fight', scenes: ['lab.showdown', 'lab.transformation'] },
  { label: 'Final battle', scenes: ['radio.final', 'peninsula.finalTurn'] }, // (the giant's lines, finalBattle.*, are kept for GIANT_KAIJU.isFinalBattle)
  { label: 'Visiting a battleground (any map walk, after its fight)', scenes: ['visit'] }
];

// the bystanders, in the order they are met, and how they are spoken of
export const RIVALS = [
  { id: 'punk', name: 'Punk Guy', pronoun: 'him' },
  { id: 'black_female', name: 'Punk Girl', pronoun: 'her' },
  { id: 'mermaid', name: 'Aquarium Worker', pronoun: 'her' }
];
const POSSESSIVES = { him: 'his', her: 'her' };

// 'neutral': the summaries' own reading, with the player and the teammate by role, not as Guy or Girl
export type StoryPath = { avatar: 'guy' | 'girl' | 'neutral'; powerName: string; choices: Record<string, 'recruit' | 'terminate'> };

export const DEFAULT_PATH: StoryPath = { avatar: 'guy', powerName: 'Wildfire', choices: { punk: 'recruit', black_female: 'recruit', mermaid: 'recruit' } };

// what the viewer shows: a line, or a branch point with its versions (each a run of lines), one of which this path takes
export type StoryLine = { kind: 'line'; key: string; sceneId: string; line: DialogueLine; speakerName: string; text: string; tags: Array<string> };
export type StoryVersion = { label: string; items: Array<StoryLine> };
export type StoryBranch = { kind: 'branch'; key: string; sceneId: string; label: string; versions: Array<StoryVersion>; taken: number };
export type StoryItem = StoryLine | StoryBranch;

const getName = (id: string) => (ROSTER.find(entry => entry.id == id) || { name: id }).name;

// who says it, by name, on this path: the teammate is whichever of Guy and Girl the player isn't
export const getSpeakerName = (speaker: string | undefined, path: StoryPath) => {
  if (!speaker) return '';
  if (speaker == 'player') return path.avatar == 'neutral' ? 'The player' : `${getName(path.avatar)} (you)`;
  if (speaker == 'teammate') return path.avatar == 'neutral' ? 'The teammate' : getName(path.avatar == 'guy' ? 'girl' : 'guy');
  if (speaker == 'agent') return 'Agent';
  if (speaker == 'recruit') return 'A recruit';
  return speaker;
};

// how the earlier choices went, as the teammate's recruit lines see it, at this bystander
const getPast = (rival: string, path: StoryPath) => {
  const earlier = RIVALS.slice(0, RIVALS.findIndex(({ id }) => id == rival)).map(({ id }) => path.choices[id]);
  const last = earlier[earlier.length - 1];
  if (earlier.length >= 2) return earlier.every(choice => choice == last) ? (last == 'terminate' ? 'allTerminate' : 'allSame') : 'mixed';
  return last || 'none';
};

const PAST_LABELS = { none: 'No one met yet', recruit: 'Recruited the last one', terminate: 'Terminated the last one', allSame: 'Recruited everyone', allTerminate: 'Terminated everyone', mixed: 'Recruited some, terminated some' };

// pronoun words fit the avatar; in the summaries' own reading they stay as written, for either
const fillAvatar = (text: string, path: StoryPath) => path.avatar == 'neutral' ? text : fillPronouns(text, path.avatar);

const fill = (text: string, values: Record<string, string>) => text.replace(/\{(\w+)\}/g, (all, name) => values[name] ?? all);

const getIsAnyRecruited = (path: StoryPath, sectionIndex: number) => RIVALS.some(({ id }) => {
  const metAt = STORY.findIndex(section => section.rival == id);
  return metAt < sectionIndex && path.choices[id] == 'recruit';
});

// one section's lines and branch points, on this path
// 'scenes': the dialogue being read: the viewer's own copy, which it edits
export const getSectionItems = (sectionIndex: number, path: StoryPath, scenes: Record<string, DialogueScene>): Array<StoryItem> => {
  const section = STORY[sectionIndex];
  const items: Array<StoryItem> = [];
  section.scenes.forEach(sceneId => {
    const scene = scenes[sceneId];
    if (!scene) return;
    const rival = RIVALS.find(({ id }) => id == section.rival);
    const values = { power: path.powerName, him: rival ? rival.pronoun : 'them', his: rival ? POSSESSIVES[rival.pronoun] : 'their', last: '' };
    // with no recruits, the game gives a recruit's lines to the player
    const getLineSpeaker = (speaker?: string) => speaker == 'recruit' && !getIsAnyRecruited(path, sectionIndex) ? 'player' : speaker;
    const toLine = (line: DialogueLine, extraTags: Array<string> = []): StoryLine => ({
      kind: 'line', key: line.id, sceneId, line, speakerName: line.ray ? '' : getSpeakerName(getLineSpeaker(line.speaker), path),
      text: line.ray ? '[ The Agent fires the ray: the team\'s powers drain away ]' : fillAvatar(fill(line.text || '', values), path),
      tags: [...(line.isBalloon ? ['balloon'] : []), ...(line.isAlarm ? ['siren'] : []), ...(line.note == 'jamie' ? ['Jamie'] : []), ...extraTags]
    });

    if (sceneId == 'recruit.choice') {
      // one version for each way the earlier choices could have gone
      const pasts = ['none', 'recruit', 'terminate', 'allSame', 'allTerminate', 'mixed'];
      const taken = getPast(section.rival as string, path);
      const versions = pasts.map(past => {
        const last = past == 'allSame' ? path.choices[RIVALS[0].id] : '';
        return {
          label: PAST_LABELS[past],
          items: scene.lines.filter(line => line.when && line.when.past == past).map(line => ({ ...toLine(line), text: fillAvatar(fill(line.text || '', { ...values, last }), path) }))
        };
      });
      items.push({ kind: 'branch', key: `${sceneId}@${sectionIndex}`, sceneId, label: 'The teammate, over the downed bystander', versions, taken: pasts.indexOf(taken) });
      return;
    }

    let index = 0;
    while (index < scene.lines.length) {
      const line = scene.lines[index];
      if (line.when && line.when.recruit) {
        // a run of lines that depend on what was done with one recruit: a branch
        const { recruit } = line.when;
        const run = [];
        while (index < scene.lines.length && scene.lines[index].when && scene.lines[index].when.recruit == recruit) run.push(scene.lines[index++]);
        const name = getName(recruit as string);
        const choices = ['recruit', 'terminate'];
        items.push({
          kind: 'branch', key: `${run[0].id}@branch`, sceneId, label: `What became of ${name}`,
          versions: choices.map(choice => ({ label: `${choice == 'recruit' ? 'Recruited' : 'Terminated'} ${name}`, items: run.filter(l => l.when && l.when.choice == choice).map(l => toLine(l)) })),
          taken: choices.indexOf(path.choices[recruit as string])
        });
        continue;
      }
      if (line.choices) {
        // what the player says: a branch, each choice with the reply it gets
        items.push({
          kind: 'branch', key: `${line.id}@choice`, sceneId, label: 'The player chooses what to say',
          versions: line.choices.map(({ text, reply }) => ({ label: `"${text}"`, items: reply.map(l => toLine(l)) })),
          taken: 0
        });
        index++;
        continue;
      }
      if (line.ifRecruits) {
        items.push({
          kind: 'branch', key: `${line.id}@recruits`, sceneId, label: 'Only if there are recruits',
          versions: [{ label: 'With recruits', items: [toLine(line)] }, { label: 'No recruits', items: [] }],
          taken: getIsAnyRecruited(path, sectionIndex) ? 0 : 1
        });
        index++;
        continue;
      }
      items.push(toLine(line));
      index++;
    }
  });
  return items;
};

export const getIsBranchingSection = (sectionIndex: number, scenes: Record<string, DialogueScene>) => getSectionItems(sectionIndex, DEFAULT_PATH, scenes).some(({ kind }) => kind == 'branch');
