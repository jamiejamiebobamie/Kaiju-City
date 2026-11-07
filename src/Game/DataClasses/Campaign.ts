import { getRadioLines } from './Dialogue/dialogue';
import { GIANT_KAIJU } from './GiantKaiju';
/*
  The story, in order. Each section is a level, played after its radio call if it has one.
  A radio call is built when it starts, so it can mention what the player has done.
  A line is { speaker, text }, or { choices } where each choice has the 'text' the player says and a 'reply'.
  A 'speaker' is 'agent', 'player' or 'teammate'. The words themselves are in Dialogue/dialogue.json.
*/
type RadioContext = {
  powerName: string; // one of the powers the player chose
  choices: Record<string, string>; // what the player did with each recruit: 'recruit' or 'terminate'
};

type RadioLine = {
  speaker?: string;
  text?: string;
  choices?: Array<{ text: string; reply: Array<RadioLine> }>;
};

type CampaignSection = {
  label: string; // for the dev panel
  levelId: string;
  kills?: number; // Kaiju to beat on the Peninsula
  hasArrival?: boolean; // the level opens with the teammate running in
  radio?: (context: RadioContext) => Array<RadioLine>;
};

// the radio calls' words are in Dialogue/dialogue.json, by section
const radioCall = (sceneId: string) => (context: RadioContext) => getRadioLines(sceneId, context);

export const CAMPAIGN_SECTIONS: Array<CampaignSection> = [
  {
    label: 'Peninsula 1',
    levelId: 'peninsula',
    kills: 10,
    hasArrival: true,
    radio: radioCall('radio.peninsula1')
  },
  { label: 'Street', levelId: 'street' },
  { label: 'Map to Subway', levelId: 'mapSubway' },
  { label: 'Subway', levelId: 'rapidTransit' },
  {
    label: 'Peninsula 2',
    levelId: 'peninsula',
    kills: 15,
    radio: radioCall('radio.peninsula2')
  },
  {
    label: 'Map to Rooftop',
    levelId: 'mapRooftop',
    radio: radioCall('radio.mapRooftop')
  },
  { label: 'Rooftop', levelId: 'rooftop' },
  {
    label: 'Peninsula 3',
    levelId: 'peninsula',
    kills: 20,
    radio: radioCall('radio.peninsula3')
  },
  {
    label: 'Map to Aquarium',
    levelId: 'mapAquarium',
    radio: radioCall('radio.mapAquarium')
  },
  { label: 'Aquarium', levelId: 'aquarium' },
  {
    label: 'Peninsula 4',
    levelId: 'peninsula',
    kills: 25,
    radio: radioCall('radio.peninsula4')
  },
  {
    label: 'Map to Lab',
    levelId: 'mapLab',
    radio: radioCall('radio.mapLab')
  },
  { label: 'Lab trap', levelId: 'labTrap' },
  { label: 'Sewer 1', levelId: 'sewer1' },
  { label: 'Sewer 2', levelId: 'sewer2' },
  { label: 'Lab fight', levelId: 'lab' },
  // the teammate as a giant Kaiju (GiantKaiju.ts), or the Peninsula's usual fight: GIANT_KAIJU.isFinalBattle
  // otherwise (Jamie, 2026-11-06): the team's own radio call, the Peninsula's 30 Kaiju, and then the teammate turns (finalPeninsula)
  GIANT_KAIJU.isFinalBattle ? { label: 'Final battle', levelId: 'finalBattle' } : { label: 'Final battle', levelId: 'finalPeninsula', kills: 30, radio: radioCall('radio.final') }
];

export const getIsLastSection = (index: number) => index == CAMPAIGN_SECTIONS.length - 1;
