import { SelectItem } from '@shared/lib/select-item/select-item.type';
import { ValueOf } from '@shared/lib/types/value-of.type';

export const automationSources = {
  none: 0,
  github: 1,
  strava: 2,
} as const;

export type AutomationSource = ValueOf<typeof automationSources>;

export const automationSourceLabels: Record<AutomationSource, string> = {
  [automationSources.none]: 'None',
  [automationSources.github]: 'Github',
  [automationSources.strava]: 'Strava',
};

export const automationSourceSelectItems: SelectItem<AutomationSource>[] = [
  {
    label: automationSourceLabels[automationSources.none],
    value: automationSources.none,
  },
  {
    label: automationSourceLabels[automationSources.github],
    value: automationSources.github,
  },
  {
    label: automationSourceLabels[automationSources.strava],
    value: automationSources.strava,
  },
];
