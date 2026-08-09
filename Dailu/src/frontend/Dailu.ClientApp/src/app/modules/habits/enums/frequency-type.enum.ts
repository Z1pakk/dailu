import { ValueOf } from '@shared/lib/types/value-of.type';
import { SelectItem } from '@shared/lib/select-item/select-item.type';

export const frequencyTypes = {
  none: 0,
  daily: 1,
  weekly: 2,
  monthly: 3,
} as const;

export type FrequencyType = ValueOf<typeof frequencyTypes>;

export const frequencyTypesLabels: Record<FrequencyType, string> = {
  [frequencyTypes.none]: 'None',
  [frequencyTypes.daily]: 'Daily',
  [frequencyTypes.weekly]: 'Weekly',
  [frequencyTypes.monthly]: 'Monthly',
};

export const frequencyTypeSelectItems: SelectItem<FrequencyType>[] = [
  <SelectItem<FrequencyType>>{
    label: frequencyTypesLabels[frequencyTypes.daily],
    value: frequencyTypes.daily,
  },
  <SelectItem<FrequencyType>>{
    label: frequencyTypesLabels[frequencyTypes.weekly],
    value: frequencyTypes.weekly,
  },
  <SelectItem<FrequencyType>>{
    label: frequencyTypesLabels[frequencyTypes.monthly],
    value: frequencyTypes.monthly,
  },
];
