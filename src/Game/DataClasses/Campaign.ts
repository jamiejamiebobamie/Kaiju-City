/*
  The story, in order. Each section is a level, or just a story page if it has no 'levelId'.
  'text' is shown before the section starts. It is all placeholder for now.
*/
type CampaignSection = {
  label: string; // for the dev panel
  levelId?: string;
  text: Array<string>;
};

export const CAMPAIGN_SECTIONS: Array<CampaignSection> = [
  { label: 'Peninsula 1', levelId: 'peninsula', text: ['Wild Kaiju have appeared!'] },
  { label: 'Street 1', levelId: 'street', text: ['Agent: Good work. Meet me at the cleanup site.'] },
  { label: 'Subway', levelId: 'rapidTransit', text: ['Agent: Trouble at Rapid Transit. A bystander touched something glowing.'] },
  { label: 'Peninsula 2', levelId: 'peninsula', text: ['More Kaiju are coming in from the sea!'] },
  { label: 'Street 2', levelId: 'street', text: ['Agent: The cleanup continues. Keep your distance from the parts.'] },
  { label: 'Rooftop', levelId: 'rooftop', text: ['Agent: Reports of strange lights on a rooftop cemetery. Go.'] },
  { label: 'Peninsula 3', levelId: 'peninsula', text: ['The Kaiju are getting bolder.'] },
  { label: 'Lab visit', levelId: 'labIntro', text: ['Agent: Report to the Lab. See what your work is paying for.'] },
  { label: 'Aquarium', levelId: 'aquarium', text: ['Agent: Something has happened at the Aquarium.'] },
  { label: 'Peninsula 4', levelId: 'peninsula', text: ['This is the biggest wave yet!'] },
  { label: 'Lab call', text: ['Agent: You have done enough. Hand over your powers.', 'Everything goes dark...'] },
  { label: 'Sewer 1', levelId: 'sewer1', text: ['Someone pulled you out. You wake below the city, powerless.'] },
  { label: 'Sewer 2', levelId: 'sewer2', text: ['Deeper in, the Kaiju parts are glowing.'] },
  { label: 'Lab fight', levelId: 'lab', text: ['Your powers are back. Time to pay the Agent a visit.'] },
  { label: 'Final battle', levelId: 'peninsula', text: ['Something huge is heading for the city!'] }
];

export const getIsLastSection = (index: number) => index == CAMPAIGN_SECTIONS.length - 1;
