import { HabitEntryModel } from '@habit-entries/models/habit-entry.model';
import {
  addDays,
  addMonths,
  addYears,
  format,
  startOfDay,
  startOfMonth,
  startOfYear,
} from 'date-fns';

export type TrendRangeUnit = 'day' | 'month' | 'year';

export interface TrendPoint {
  date: Date;
  value: number;
}

function bucketKey(date: Date, unit: TrendRangeUnit): string {
  switch (unit) {
    case 'day':
      return format(date, 'yyyy-MM-dd');
    case 'month':
      return format(date, 'yyyy-MM');
    case 'year':
      return format(date, 'yyyy');
  }
}

function startOfBucket(date: Date, unit: TrendRangeUnit): Date {
  switch (unit) {
    case 'day':
      return startOfDay(date);
    case 'month':
      return startOfMonth(date);
    case 'year':
      return startOfYear(date);
  }
}

function stepBucket(date: Date, unit: TrendRangeUnit, amount: number): Date {
  switch (unit) {
    case 'day':
      return addDays(date, amount);
    case 'month':
      return addMonths(date, amount);
    case 'year':
      return addYears(date, amount);
  }
}

/**
 * Buckets a habit's entries by day/month/year and sums the values in each bucket.
 * With `bucketCount`, returns that many buckets ending today. Without it, spans
 * from the habit's earliest entry to today (empty when there are no entries).
 */
export function getTrendSeries(
  entries: HabitEntryModel[],
  habitId: string,
  unit: TrendRangeUnit,
  bucketCount?: number,
): TrendPoint[] {
  const relevant = entries.filter((entry) => entry.habitId === habitId && !entry.isArchived);

  const sums = new Map<string, number>();
  for (const entry of relevant) {
    const key = bucketKey(new Date(entry.completedAtUtc), unit);
    sums.set(key, (sums.get(key) ?? 0) + entry.value);
  }

  const today = startOfBucket(new Date(), unit);

  let firstBucket: Date;
  if (bucketCount !== undefined) {
    firstBucket = stepBucket(today, unit, -(bucketCount - 1));
  } else if (relevant.length > 0) {
    const earliestTimestamp = Math.min(
      ...relevant.map((entry) => new Date(entry.completedAtUtc).getTime()),
    );
    firstBucket = startOfBucket(new Date(earliestTimestamp), unit);
  } else {
    firstBucket = today;
  }

  const points: TrendPoint[] = [];
  for (let cursor = firstBucket; cursor <= today; cursor = stepBucket(cursor, unit, 1)) {
    points.push({ date: cursor, value: sums.get(bucketKey(cursor, unit)) ?? 0 });
  }

  return points;
}
