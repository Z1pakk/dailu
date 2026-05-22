import { SelectItem } from '@shared/lib/select-item/select-item.type';
import { ValueOf } from '@shared/lib/types/value-of.type';

export const automationSources = {
  none: 0,
  github: 1,
} as const;

export type AutomationSource = ValueOf<typeof automationSources>;

export const automationSourceSelectItems: SelectItem<AutomationSource>[] = [
  { label: 'None', value: automationSources.none },
  { label: 'GitHub', value: automationSources.github },
];
