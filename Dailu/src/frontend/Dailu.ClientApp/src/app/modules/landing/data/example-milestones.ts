export interface ExampleMilestone {
  name: string;
  current: number;
  target: number;
}

/** Figma long-game `5:49` → Milestones card. */
export const EXAMPLE_MILESTONES: readonly ExampleMilestone[] = [
  { name: '100 commits', current: 67, target: 100 },
  { name: '50 morning runs', current: 50, target: 50 },
  { name: '30 nights before 23:00', current: 21, target: 30 },
  { name: 'Read 20 books', current: 8, target: 20 },
];
