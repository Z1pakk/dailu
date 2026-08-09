import { SelectItem } from '@shared/lib/select-item/select-item.type';
import { ValueOf } from '@shared/lib/types/value-of.type';

export const habitTypes = {
  none: 0,
  binary: 1,
  measurable: 2,
} as const;

export type HabitType = ValueOf<typeof habitTypes>;

export const habitTypeSelectItems: SelectItem<HabitType>[] = [
  <SelectItem<HabitType>>{
    label: 'Binary',
    value: habitTypes.binary,
  },
  <SelectItem<HabitType>>{
    label: 'Measurable',
    value: habitTypes.measurable,
  },
];
