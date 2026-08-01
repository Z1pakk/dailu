import { SelectItem } from '@shared/lib/select-item/select-item.type';
import { ValueOf } from '@shared/lib/types/value-of.type';

export const googleHealthMetrics = {
  steps: 0,
  exercise: 1,
} as const;

export type GoogleHealthMetric = ValueOf<typeof googleHealthMetrics>;

export const googleHealthMetricLabels: Record<GoogleHealthMetric, string> = {
  [googleHealthMetrics.steps]: 'Steps',
  [googleHealthMetrics.exercise]: 'Exercise',
};

export const googleHealthMetricSelectItems: SelectItem<GoogleHealthMetric>[] = [
  {
    label: googleHealthMetricLabels[googleHealthMetrics.steps],
    value: googleHealthMetrics.steps,
  },
  {
    label: googleHealthMetricLabels[googleHealthMetrics.exercise],
    value: googleHealthMetrics.exercise,
  },
];
