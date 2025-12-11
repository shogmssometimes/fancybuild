import { WorldEvent } from '../domain/worldEvents';

export const worldEvents: WorldEvent[] = [
  {
    id: 'missing',
    name: 'The Missing',
    description:
      '1% of the global population disappeared one day. No explanation. No Answers. They have never been found or detected.',
    effects: [
      { meter: 'surveillance', change: 1 },
    ],
  },
  {
    id: 'broken-keystone',
    name: 'Broken Keystone',
    description:
      'Many Keystone Species have gone extinct irrevocably changing the amount and types of food available.',
    effects: [
      { meter: 'collapse', change: 1 },
    ],
  },
  {
    id: 'bifurcation',
    name: 'The Bifurcation',
    description:
      'Society has stratified into the haves and the have nots. Those below are just that. Literally and Philosophically below. The powerful have the money, weapons, influence, and power.',
    effects: [
      { meter: 'carteBlanche', change: 1 },
    ],
  },
  {
    id: 'doubling',
    name: 'Doubling',
    description:
      'People around the world have been replaced with Automotons that look, act, and live normally. No one agrees on what created the doubles. Some accept, some eliminate perceived perpetrators.',
    effects: [
      { meter: 'distrust', change: 1 },
    ],
  },
  {
    id: 'brave-new-world',
    name: 'Brave New World',
    description:
      'Media, Entertainment, Influencers, Government, Corporations, and Gangs inundate the world with experiences, goods, and services. The Show MUST Go On!',
    effects: [
      { meter: 'trust', change: 1 },
    ],
  },
];
