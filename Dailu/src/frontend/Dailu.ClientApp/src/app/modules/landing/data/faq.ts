export interface FaqItem {
  question: string;
  answer: string;
}

/** Verbatim from the spec / Figma FAQ `5:603`. */
export const FAQ_ITEMS: readonly FaqItem[] = [
  {
    question: 'How does Dailu know I did a habit?',
    answer:
      'Link a habit to a connected integration — GitHub, Strava or Google Health. Background workers check them regularly (GitHub every 2 minutes, Strava and Google Health every 5) and turn new activity into a habit entry automatically.',
  },
  {
    question: 'Can I still log habits manually?',
    answer: 'Yes. Manual and automatic entries live side by side, and both count toward your streak.',
  },
  {
    question: 'Which integrations are supported?',
    answer:
      'GitHub, Strava and Google Health today. More are planned, but this is a one-person study project, so they’ll arrive gradually.',
  },
  {
    question: 'What data does Dailu access?',
    answer:
      'Only what a connection needs to see your activity — for example, GitHub asks for the read:user and repo scopes so commits can be matched to habits. Sync logs are kept for 30 days, and you can disconnect an integration at any time.',
  },
  {
    question: 'Who’s behind Dailu?',
    answer:
      'Dailu is a study & pet project built by one developer to learn Angular, PrimeNG and a modular .NET backend. It’s free to use.',
  },
];
