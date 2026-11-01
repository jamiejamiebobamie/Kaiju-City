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
  kills?: number; // Kaiju to beat on the Peninsula
  hasArrival?: boolean; // the level opens with the teammate running in
  radio?: (context: RadioContext) => Array<RadioLine>;
};

const agent = (text: string) => ({ speaker: 'agent', text });
const teammate = (text: string) => ({ speaker: 'teammate', text });

// the Agent's report on each recruit: how they are holding up in mind, body and looks
const RECRUIT_REPORTS: Record<string, Record<string, (name: string) => string>> = {
  punk: {
    recruit: name => `${name} finished re-education. Mentally compliant. Physically, stronger than he should be. The mohawk stays, apparently.`,
    terminate: name => `${name} won't be a problem anymore. Cold, but clean.`
  },
  black_female: {
    recruit: name => `${name} is through re-education. She still hears voices, so: stable, for her. Physically flawless. We could not get her out of the black.`,
    terminate: name => `${name} is in the ground. Fitting, for that address.`
  },
  mermaid: {
    recruit: name => `${name} is in re-education. Mental state: she is a mermaid. Physically, she's scaling nicely. The tail is a lot.`,
    terminate: name => `${name} is off the board. The Aquarium wants to know who's paying for the repairs...`
  }
};

const getRecruitNews = (context: RadioContext, id: string, name: string) => {
  const choice = context.choices[id];
  return choice ? [agent(RECRUIT_REPORTS[id][choice](name))] : [];
};

const getOrders = (question: string, answer: string) => ({
  choices: [
    { text: "What's the mission?", reply: [] },
    { text: question, reply: [agent(answer)] }
  ]
});

export const CAMPAIGN_SECTIONS: Array<CampaignSection> = [
  {
    label: 'Peninsula 1',
    levelId: 'peninsula',
    kills: 10,
    hasArrival: true,
    radio: () => [
      agent('Reports of more Kaiju incoming to Kaiju City! Protect the Peninsula!!'), // Jamie's line
      agent("It's your job to protect this city, so do it!") // Jamie's line
    ]
  },
  { label: 'Street', levelId: 'street' },
  { label: 'Map to Subway', levelId: 'mapSubway' },
  { label: 'Subway', levelId: 'rapidTransit' },
  {
    label: 'Peninsula 2',
    levelId: 'peninsula',
    kills: 15,
    radio: context => [
      ...getRecruitNews(context, 'punk', 'The punk from the station'),
      agent('Sonar is showing a second wave off the coast. Bigger than the first.'),
      agent('Get back to the Peninsula. Hold the line!')
    ]
  },
  {
    label: 'Map to Rooftop',
    levelId: 'mapRooftop',
    radio: context => [
      agent('Another wave down. You two are holding this city together.'),
      teammate('They are coming faster than they used to.'),
      agent(`Keep it up. I'm seeing good numbers on your ${context.powerName} power.`),
      getOrders('Where are they all coming from?', "That's above your pay grade. For now."),
      // Jamie's line
      agent('There have been reports of Kaiju body parts falling onto rooftops in the Cemetary district. Go investigate and try not to let another citizen touch them!')
    ]
  },
  { label: 'Rooftop', levelId: 'rooftop' },
  {
    label: 'Peninsula 3',
    levelId: 'peninsula',
    kills: 20,
    radio: context => [
      ...getRecruitNews(context, 'black_female', 'The woman from the rooftop cemetery'),
      agent('No time to rest. The shipping lanes just went dark.'),
      teammate("Oh no..."),
      agent('It\'s the biggest group yet... But the Peninsula will not fall today!')
    ]
  },
  {
    label: 'Map to Aquarium',
    levelId: 'mapAquarium',
    radio: context => [
      agent('The harbor is quiet again. The Mayor sends his thanks.'),
      teammate('Quiet never lasts around here.'),
      agent(`No, it doesn't. Keep that ${context.powerName} power charged.`),
      getOrders('Is anyone looking into all these Kaiju parts?', 'Yeah, we got our best guys on it. You will meet them soon enough...'),
      agent('Something has happened at the Aquarium. Go.')
    ]
  },
  { label: 'Aquarium', levelId: 'aquarium' },
  {
    label: 'Peninsula 4',
    levelId: 'peninsula',
    kills: 25,
    radio: context => [
      ...getRecruitNews(context, 'mermaid', 'The mermaid'),
      agent('All units, all units: Kaiju on every approach.'),
      agent('This is everything they have. Hold the Peninsula, whatever it takes!')
    ]
  },
  {
    label: 'Map to Lab',
    levelId: 'mapLab',
    radio: () => [
      // Jamie's line, with one spelling fix
      agent('Soldier, report to the lab, on the double. The brains have been cooking-up something special for you.')
    ]
  },
  { label: 'Lab trap', levelId: 'labTrap' },
  { label: 'Sewer 1', levelId: 'sewer1' },
  { label: 'Sewer 2', levelId: 'sewer2' },
  { label: 'Lab fight', levelId: 'lab' },
  { label: 'Final battle', levelId: 'peninsula', kills: 30 }
];

export const getIsLastSection = (index: number) => index == CAMPAIGN_SECTIONS.length - 1;
