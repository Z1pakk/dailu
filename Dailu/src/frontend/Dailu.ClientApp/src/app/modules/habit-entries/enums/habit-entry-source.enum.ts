import { ValueOf } from '@shared/lib/types/value-of.type';

export const habitEntrySources = { none: 0, manual: 1, automation: 2 } as const;
export type HabitEntrySource = ValueOf<typeof habitEntrySources>;

export const habitEntrySourceLabels: Record<HabitEntrySource, string> = {
  [habitEntrySources.none]: 'None',
  [habitEntrySources.manual]: 'Manual',
  [habitEntrySources.automation]: 'Automation',
};