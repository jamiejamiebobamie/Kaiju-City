/*
  The story, in order. Each section is a level, played after its radio call if it has one.
  A radio call is built when it starts, so it can mention what the player has done.
  A line is { speaker, text }, or { choices } where each choice has the 'text' the player says and a 'reply'.
  A 'speaker' is 'agent', 'player' or 'teammate'. All of the words here are drafts to rewrite, except where marked.
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
  hasArrival?: boolean; // the level opens with the teammate running in
  radio?: (context: RadioContext) => Array<RadioLine>;
};

const agent = (text: string) => ({ speaker: 'agent', text });
const teammate = (text: string) => ({ speaker: 'teammate', text });

const incoming = () => [agent('Reports of more Kaiju incoming to Kaiju City! Protect the Peninsula!!')]; // Jamie's line

const getRecruitNews = (context: RadioContext, id: string, name: string) => {
  const choice = context.choices[id];
  if (choice == 'recruit') return [agent(`${name} is with us now. A risky call, soldier. I hope it pays off.`)];
  if (choice == 'terminate') return [agent(`${name} won't be a problem anymore. Cold, but clean.`)];
  return [];
};

const getBriefing = (context: RadioContext) => [
  agent('Another wave down. You two are holding this city together.'),
  teammate('They are coming faster than they used to.'),
  agent('Sonar agrees. Bigger waves, and shorter gaps between them.'),
  agent(`I'm seeing good numbers on your ${context.powerName}. Keep using what works.`)
];

const getOrders = () => ({
  choices: [
    { text: "What's the mission?", reply: [] },
    { text: 'Where are they all coming from?', reply: [agent("That's above your pay grade. For now.")] }
  ]
});

export const CAMPAIGN_SECTIONS: Array<CampaignSection> = [
  { label: 'Peninsula 1', levelId: 'peninsula', hasArrival: true, radio: incoming },
  { label: 'Street', levelId: 'street' },
  { label: 'Map to Subway', levelId: 'mapSubway' },
  { label: 'Subway', levelId: 'rapidTransit' },
  { label: 'Peninsula 2', levelId: 'peninsula', radio: incoming },
  {
    label: 'Map to Rooftop',
    levelId: 'mapRooftop',
    radio: context => [
      ...getBriefing(context),
      ...getRecruitNews(context, 'punk', 'The punk from the station'),
      getOrders(),
      // Jamie's line
      agent('There have been reports of Kaiju body parts falling onto rooftops in the Cemetary district. Go investigate and try not to let another citizen touch it!')
    ]
  },
  { label: 'Rooftop', levelId: 'rooftop' },
  { label: 'Peninsula 3', levelId: 'peninsula', radio: incoming },
  {
    label: 'Map to Aquarium',
    levelId: 'mapAquarium',
    radio: context => [
      ...getBriefing(context),
      ...getRecruitNews(context, 'black_female', 'The woman from the cemetery'),
      getOrders(),
      agent('Something has happened at the Aquarium. Go.')
    ]
  },
  { label: 'Aquarium', levelId: 'aquarium' },
  { label: 'Peninsula 4', levelId: 'peninsula', radio: incoming },
  {
    label: 'Map to Lab',
    levelId: 'mapLab',
    radio: context => [
      ...getRecruitNews(context, 'mermaid', 'The mermaid'),
      // Jamie's line
      agent('Soldier, report to the lab, on the double. The brains have been cooking-up something special for you.')
    ]
  },
  { label: 'Lab', levelId: 'labIntro' },
  { label: 'Sewer 1', levelId: 'sewer1' },
  { label: 'Sewer 2', levelId: 'sewer2' },
  { label: 'Lab fight', levelId: 'lab' },
  { label: 'Final battle', levelId: 'peninsula' }
];

export const getIsLastSection = (index: number) => index == CAMPAIGN_SECTIONS.length - 1;
