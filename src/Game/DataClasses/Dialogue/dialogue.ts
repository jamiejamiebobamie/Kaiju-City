import DIALOGUE from './dialogue.json';

/*
  Every line in the game lives in dialogue.json, by scene. The game reads its lines from here; /dialogue edits that file.
  A line: { id, speaker, text } with, as needed:
    'when': said only if the player made this choice ({ recruit, choice }).
    'isAlarm': the line that tells of Kaiju coming, in a radio call: the monitor's red siren starts with it.
    'note': 'jamie' for Jamie's own words; anything else is a draft.
    'choices': in place of a line, what the player can say: each { text, reply: [lines] }.
  In a line's text, {power} is one of the player's powers.
*/
// 'recruit' and 'choice': said only if the player did this with that recruit. 'past': the recruit lines, by how the earlier choices went
export type DialogueWhen = { recruit?: string; choice?: string; past?: string };

export type DialogueLine = {
  id: string;
  [field: string]: any; // what the scene does with it: 'phase', 'ifRecruits', 'isFlipped', 'isBalloon', 'key', or a step like 'ray'
  speaker?: string;
  text?: string;
  when?: DialogueWhen;
  isAlarm?: boolean;
  note?: string;
  choices?: Array<{ text: string; reply: Array<DialogueLine> }>;
};

export type DialogueScene = { label: string; lines: Array<DialogueLine> };

// what a scene's lines can depend on: the player's power, and what they did with each recruit
export type DialogueContext = { powerName?: string; choices?: Record<string, string>; avatar?: string };

const SCENES = DIALOGUE.scenes as Record<string, DialogueScene>;

export const getDialogueScene = (sceneId: string): DialogueScene => {
  const scene = SCENES[sceneId];
  if (!scene) throw new Error(`no dialogue scene '${sceneId}'`);
  return scene;
};

const getIsSaid = ({ when }: DialogueLine, { choices = {} }: DialogueContext) => !when || !when.recruit || choices[when.recruit] == when.choice;

const fill = (text: string, { powerName = '', avatar }: DialogueContext) => fillPronouns(text.replace(/\{power\}/g, powerName), avatar);

// a radio call's lines, for this player: only those their choices call for, with the blanks filled
export const getRadioLines = (sceneId: string, context: DialogueContext) => {
  const toRadio = (lines: Array<DialogueLine>) => lines.filter(line => getIsSaid(line, context)).map(line => line.choices
    ? { choices: line.choices.map(({ text, reply }) => ({ text: fill(text, context), reply: toRadio(reply) })) }
    : { speaker: line.speaker, text: fill(line.text || '', context), ...(line.isAlarm ? { isAlarm: true } : {}) });
  return toRadio(getDialogueScene(sceneId).lines);
};

// what belongs to the dialogue file itself, not to the scene that plays a line
const getStageFields = ({ id, speaker, text, note, isBalloon, when, key, ...rest }: any) => rest;

// a scene's lines as the plain words (a speech element's lines, the visit lines)
export const getDialogueTexts = (sceneId: string) => getDialogueScene(sceneId).lines.map(({ text }) => text || '');

// a scene's lines as a script: { who, text } and whatever the scene does with them ('phase', 'ifRecruits'), or a step with no words ({ ray })
export const getDialogueScript = (sceneId: string) => getDialogueScene(sceneId).lines.map((line: any) =>
  line.speaker ? { who: line.speaker, text: line.text, ...getStageFields(line) } : getStageFields(line));

// a bystander's intro: their own lines by name, and the teammate's. 'shot': the viewer's camera choice for the line, if any
export const getIntroLines = (sceneId: string) => getDialogueScene(sceneId).lines.map((line: any) => {
  const intro = line.speaker == 'teammate'
    ? { isTeammate: true, text: line.text }
    : { name: line.speaker, text: line.text, ...('isFlipped' in line ? { isFlipped: line.isFlipped } : {}) };
  return line.shot ? { ...intro, shot: line.shot } : intro;
});

// a scene's lines with who says each (a role like 'agent' or 'teammate', or a name): for scenes whose speakers can change
export const getSpokenLines = (sceneId: string) => getDialogueScene(sceneId).lines.map(({ speaker, text }: any) => ({ speaker, text: text || '' }));

// one line, by name and words
export const getDialogueLine = (sceneId: string) => {
  const [line] = getDialogueScene(sceneId).lines as Array<any>;
  return { name: line.speaker, text: line.text };
};

// lines looked up by their 'key' (the Lab trap's chase: what the Agent and the teammate shout)
export const getKeyedLines = (sceneId: string) => Object.fromEntries(getDialogueScene(sceneId).lines.map((line: any) => [line.key, line.text]));

// the teammate over a downed bystander: the lines for how the earlier choices went ('allSame', 'mixed', 'recruit', 'terminate' or 'none'),
// with {him}, {his} and {last} filled in
export const getRecruitChoiceLines = (past: string, fills: Record<string, string>) => getDialogueScene('recruit.choice').lines
  .filter(({ when }: any) => when && when.past == past)
  .map(({ text = '' }) => text.replace(/\{(\w+)\}/g, (_, name) => fills[name] ?? `{${name}}`));

/*
  Pronoun words: {you:he} or {teammate:his} in a line becomes he/she, him/her, his/her or himself/herself
  for whoever is playing (you) and the other of Guy and Girl (the teammate). Write either gender's form; it fits itself.
*/
const PRONOUNS = {
  he: ['he', 'she'], she: ['he', 'she'],
  him: ['him', 'her'], her: ['him', 'her'],
  his: ['his', 'her'],
  himself: ['himself', 'herself'], herself: ['himself', 'herself']
};
const TOKEN = /\{(you|teammate):(\w+)\}/g;

export const fillPronouns = (text: string, playerAvatar = 'guy') => {
  if (!text || !text.includes('{')) return text;
  return text.replace(TOKEN, (all, who, word) => {
    const forms = PRONOUNS[word.toLowerCase()];
    if (!forms) return all;
    const avatar = who == 'you' ? playerAvatar : playerAvatar == 'guy' ? 'girl' : 'guy';
    const filled = forms[avatar == 'girl' ? 1 : 0];
    return word[0] == word[0].toUpperCase() ? filled[0].toUpperCase() + filled.slice(1) : filled;
  });
};
