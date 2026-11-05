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
export type DialogueWhen = { recruit: string; choice: string };

export type DialogueLine = {
  id: string;
  speaker?: string;
  text?: string;
  when?: DialogueWhen;
  isAlarm?: boolean;
  note?: string;
  choices?: Array<{ text: string; reply: Array<DialogueLine> }>;
};

export type DialogueScene = { label: string; lines: Array<DialogueLine> };

// what a scene's lines can depend on: the player's power, and what they did with each recruit
export type DialogueContext = { powerName?: string; choices?: Record<string, string> };

const SCENES = DIALOGUE.scenes as Record<string, DialogueScene>;

export const getDialogueScene = (sceneId: string): DialogueScene => {
  const scene = SCENES[sceneId];
  if (!scene) throw new Error(`no dialogue scene '${sceneId}'`);
  return scene;
};

const getIsSaid = ({ when }: DialogueLine, { choices = {} }: DialogueContext) => !when || choices[when.recruit] == when.choice;

const fill = (text: string, { powerName = '' }: DialogueContext) => text.replace(/\{power\}/g, powerName);

// a radio call's lines, for this player: only those their choices call for, with the blanks filled
export const getRadioLines = (sceneId: string, context: DialogueContext) => {
  const toRadio = (lines: Array<DialogueLine>) => lines.filter(line => getIsSaid(line, context)).map(line => line.choices
    ? { choices: line.choices.map(({ text, reply }) => ({ text: fill(text, context), reply: toRadio(reply) })) }
    : { speaker: line.speaker, text: fill(line.text || '', context), ...(line.isAlarm ? { isAlarm: true } : {}) });
  return toRadio(getDialogueScene(sceneId).lines);
};
