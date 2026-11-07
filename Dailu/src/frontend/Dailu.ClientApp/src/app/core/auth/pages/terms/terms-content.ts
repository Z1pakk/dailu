export type TermsBlock =
  | { kind: 'p'; text: string }
  | { kind: 'list'; items: readonly string[] };

export interface TermsSection {
  /** Fragment slug used by the table of contents. */
  id: string;
  title: string;
  blocks: readonly TermsBlock[];
}

export const TERMS_UPDATED = 'Last updated 5 November 2026';
export const TERMS_READ_TIME = '6 min read';

/** Verbatim from Figma Terms `41:1564`. */
export const TERMS_SHORT_VERSION: readonly string[] = [
  'Dailu is a free study & pet project — no guarantees, no ads, no selling your data.',
  'You connect GitHub, Strava or Google Health; Dailu only reads activity to tick off habits.',
  'You can disconnect integrations anytime, and ask for your account to be removed.',
  'Sync logs are deleted after 30 days.',
];

/** Verbatim from Figma Terms `41:1564`. Replace [contact email] before publishing. */
export const TERMS_SECTIONS: readonly TermsSection[] = [
  {
    id: 'what-dailu-is',
    title: 'What Dailu is',
    blocks: [
      {
        kind: 'p',
        text: 'Dailu is a free study & pet project built by one developer to learn Angular, PrimeNG and a modular .NET backend. It is not a commercial service.',
      },
      {
        kind: 'p',
        text: 'Because of that, Dailu is provided “as is”. Features may change, break or be removed, and the service may be paused or shut down at any time.',
      },
    ],
  },
  {
    id: 'your-account',
    title: 'Your account',
    blocks: [
      {
        kind: 'p',
        text: 'To use Dailu you create an account with your email, first and last name and a password — or sign in with Google or Facebook.',
      },
      {
        kind: 'p',
        text: 'You’re responsible for keeping your login details safe and for what happens on your account. Please use accurate information and one account per person.',
      },
    ],
  },
  {
    id: 'connected-integrations',
    title: 'Connected integrations',
    blocks: [
      {
        kind: 'p',
        text: 'You can connect GitHub, Strava and Google Health. By connecting one, you allow Dailu to read your activity from that service so it can create habit entries automatically.',
      },
      {
        kind: 'list',
        items: [
          'GitHub: Dailu requests the read:user and repo scopes to match commits and pull requests to your habits.',
          'Strava and Google Health: Dailu reads activities such as runs, steps and sleep.',
          'Background workers check for new activity every 2–5 minutes.',
        ],
      },
      {
        kind: 'p',
        text: 'You can disconnect an integration at any time. The terms of GitHub, Strava and Google also apply to your use of their services.',
      },
    ],
  },
  {
    id: 'your-data',
    title: 'Your data',
    blocks: [
      {
        kind: 'p',
        text: 'Dailu stores what it needs to work: your profile, your habits and habit entries, the access tokens for integrations you connect, and short sync logs.',
      },
      {
        kind: 'list',
        items: [
          'Sync logs are deleted automatically after 30 days.',
          'A refresh-token cookie keeps you signed in.',
          'Sign-up and login are protected by ALTCHA, a proof-of-work check, instead of a tracking captcha.',
          'Your data is never sold or shared for advertising.',
        ],
      },
      {
        kind: 'p',
        text: 'Optional AI features, such as search and coaching suggestions, process your habit data to generate results.',
      },
    ],
  },
  {
    id: 'fair-use',
    title: 'Fair use',
    blocks: [
      {
        kind: 'p',
        text: 'Please don’t use Dailu to break the law, attack or overload the service, access other people’s data, or scrape it automatically.',
      },
      { kind: 'p', text: 'Accounts that do may be suspended.' },
    ],
  },
  {
    id: 'no-warranty',
    title: 'No warranty',
    blocks: [
      {
        kind: 'p',
        text: 'Dailu is a learning project with no guarantees of availability, accuracy or data retention. Automatic checks can be wrong or delayed, and data could be lost.',
      },
      {
        kind: 'p',
        text: 'To the extent the law allows, the developer isn’t liable for damages arising from using Dailu.',
      },
    ],
  },
  {
    id: 'changes-to-these-terms',
    title: 'Changes to these terms',
    blocks: [
      {
        kind: 'p',
        text: 'These terms may be updated as Dailu evolves. The date at the top shows the latest version, and continuing to use Dailu means you accept the updated terms.',
      },
    ],
  },
  {
    id: 'contact',
    title: 'Contact',
    blocks: [
      {
        kind: 'p',
        text: 'Questions, or want your account and data removed? Write to [contact email].',
      },
    ],
  },
];
