import { SelectItem } from '@shared/lib/select-item/select-item.type';
import { ValueOf } from '@shared/lib/types/value-of.type';

export const stravaActivityTypes = {
  ride: 0,
  run: 1,
  swim: 2,
  walk: 3,
  hike: 4,
  weightTraining: 5,
  yoga: 6,
  virtualRide: 7,
  virtualRun: 8,
} as const;

export type StravaActivityType = ValueOf<typeof stravaActivityTypes>;

export const stravaActivityTypeLabels: Record<StravaActivityType, string> = {
  [stravaActivityTypes.ride]: 'Ride',
  [stravaActivityTypes.run]: 'Run',
  [stravaActivityTypes.swim]: 'Swim',
  [stravaActivityTypes.walk]: 'Walk',
  [stravaActivityTypes.hike]: 'Hike',
  [stravaActivityTypes.weightTraining]: 'Weight Training',
  [stravaActivityTypes.yoga]: 'Yoga',
  [stravaActivityTypes.virtualRide]: 'Virtual Ride',
  [stravaActivityTypes.virtualRun]: 'Virtual Run',
};

export const stravaActivityTypeSelectItems: SelectItem<StravaActivityType>[] = [
  {
    label: stravaActivityTypeLabels[stravaActivityTypes.ride],
    value: stravaActivityTypes.ride,
  },
  {
    label: stravaActivityTypeLabels[stravaActivityTypes.run],
    value: stravaActivityTypes.run,
  },
  {
    label: stravaActivityTypeLabels[stravaActivityTypes.swim],
    value: stravaActivityTypes.swim,
  },
  {
    label: stravaActivityTypeLabels[stravaActivityTypes.walk],
    value: stravaActivityTypes.walk,
  },
  {
    label: stravaActivityTypeLabels[stravaActivityTypes.hike],
    value: stravaActivityTypes.hike,
  },
  {
    label: stravaActivityTypeLabels[stravaActivityTypes.weightTraining],
    value: stravaActivityTypes.weightTraining,
  },
  {
    label: stravaActivityTypeLabels[stravaActivityTypes.yoga],
    value: stravaActivityTypes.yoga,
  },
  {
    label: stravaActivityTypeLabels[stravaActivityTypes.virtualRide],
    value: stravaActivityTypes.virtualRide,
  },
  {
    label: stravaActivityTypeLabels[stravaActivityTypes.virtualRun],
    value: stravaActivityTypes.virtualRun,
  },
];
