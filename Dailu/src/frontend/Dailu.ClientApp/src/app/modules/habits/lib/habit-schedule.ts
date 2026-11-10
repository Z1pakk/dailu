import { FrequencyModel } from '@habits/models/frequency.model';
import { FrequencyType, frequencyTypes } from '@habits/enums/frequency-type.enum';

/*
 * The drawer's Daily / Weekdays / Custom choice on top of the stored frequency.
 * The backend has no weekday picking yet, so "Weekdays" is stored as weekly × 5.
 */

export type ScheduleMode = 'daily' | 'weekdays' | 'custom';

const WEEKDAYS_PER_WEEK = 5;

const PERIOD_NAMES: Partial<Record<FrequencyType, string>> = {
  [frequencyTypes.daily]: 'day',
  [frequencyTypes.weekly]: 'week',
  [frequencyTypes.monthly]: 'month',
};

export function isWeekdays(frequency: FrequencyModel): boolean {
  return frequency.type === frequencyTypes.weekly && frequency.timesPerPeriod === WEEKDAYS_PER_WEEK;
}

export function scheduleModeOf(frequency: FrequencyModel): ScheduleMode {
  if (frequency.type === frequencyTypes.daily && frequency.timesPerPeriod === 1) {
    return 'daily';
  }
  if (isWeekdays(frequency)) {
    return 'weekdays';
  }
  return 'custom';
}

export function frequencyFor(mode: ScheduleMode, custom: FrequencyModel): FrequencyModel {
  if (mode === 'daily') {
    return { type: frequencyTypes.daily, timesPerPeriod: 1 };
  }
  if (mode === 'weekdays') {
    return { type: frequencyTypes.weekly, timesPerPeriod: WEEKDAYS_PER_WEEK };
  }
  return { ...custom };
}

export function scheduleLabel(frequency: FrequencyModel): string {
  const mode = scheduleModeOf(frequency);
  if (mode === 'daily') {
    return 'Daily';
  }
  if (mode === 'weekdays') {
    return 'Weekdays';
  }
  return `${frequency.timesPerPeriod}× / ${PERIOD_NAMES[frequency.type] ?? 'period'}`;
}
