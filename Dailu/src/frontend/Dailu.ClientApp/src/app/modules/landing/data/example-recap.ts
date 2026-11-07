export interface RecapRow {
  time: string;
  name: string;
  source: 'STRAVA' | 'GITHUB' | 'YOU' | 'GOOGLE';
}

/** Figma day-recap `5:521` receipt rows. */
export const EXAMPLE_RECAP: readonly RecapRow[] = [
  { time: '06:52', name: 'Morning run', source: 'STRAVA' },
  { time: '11:04', name: 'Review a PR', source: 'GITHUB' },
  { time: '13:10', name: 'Read', source: 'YOU' },
  { time: '14:21', name: 'Ship a commit', source: 'GITHUB' },
  { time: '18:14', name: 'Evening walk', source: 'GOOGLE' },
  { time: '23:02', name: 'Lights out', source: 'GOOGLE' },
];
