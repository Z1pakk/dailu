import { addDays } from 'date-fns/addDays';
import { endOfWeek } from 'date-fns/endOfWeek';
import { format } from 'date-fns/format';
import { startOfWeek } from 'date-fns/startOfWeek';

export type HeatLevel = 0 | 1 | 2 | 3 | 4;

export interface HeatCell {
  /** yyyy-MM-dd */
  date: string;
  count: number;
  level: HeatLevel;
}

export interface MonthLabel {
  week: number;
  label: string;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function heatLevel(count: number, maxPerDay: number): HeatLevel {
  if (count <= 0 || maxPerDay <= 0) {
    return 0;
  }
  return Math.min(4, Math.ceil((count / maxPerDay) * 4)) as HeatLevel;
}

/**
 * GitHub-style year grid: one column per week, rows Mon…Sun.
 * Days outside `year` are `null` so the first and last columns line up.
 */
export function buildYearWeeks(
  year: number,
  counts: ReadonlyMap<string, number>,
  maxPerDay: number,
): (HeatCell | null)[][] {
  const weekStartsOn = 1;
  const first = startOfWeek(new Date(year, 0, 1), { weekStartsOn });
  const last = endOfWeek(new Date(year, 11, 31), { weekStartsOn });

  const weeks: (HeatCell | null)[][] = [];
  for (let day = first; day <= last; day = addDays(day, 7)) {
    const week: (HeatCell | null)[] = [];
    for (let i = 0; i < 7; i++) {
      const date = addDays(day, i);
      if (date.getFullYear() !== year) {
        week.push(null);
        continue;
      }
      const key = format(date, 'yyyy-MM-dd');
      const count = counts.get(key) ?? 0;
      week.push({ date: key, count, level: heatLevel(count, maxPerDay) });
    }
    weeks.push(week);
  }
  return weeks;
}

/**
 * The last `weeks` Monday-first weeks up to and including `end`'s week.
 * Days after `end` are `null` (not yet happened).
 */
export function buildRecentWeeks(
  end: Date,
  weeks: number,
  counts: ReadonlyMap<string, number>,
  maxPerDay: number,
): (HeatCell | null)[][] {
  const endKey = format(end, 'yyyy-MM-dd');
  const firstMonday = addDays(startOfWeek(end, { weekStartsOn: 1 }), -7 * (weeks - 1));
  const result: (HeatCell | null)[][] = [];
  for (let w = 0; w < weeks; w++) {
    const week: (HeatCell | null)[] = [];
    for (let d = 0; d < 7; d++) {
      const key = format(addDays(firstMonday, w * 7 + d), 'yyyy-MM-dd');
      if (key > endKey) {
        week.push(null);
        continue;
      }
      const count = counts.get(key) ?? 0;
      week.push({ date: key, count, level: heatLevel(count, maxPerDay) });
    }
    result.push(week);
  }
  return result;
}

/** The column where each month's 1st falls. */
export function monthLabels(weeks: readonly (HeatCell | null)[][]): MonthLabel[] {
  const labels: MonthLabel[] = [];
  weeks.forEach((week, index) => {
    const firstOfMonth = week.find((cell) => cell?.date.endsWith('-01'));
    if (firstOfMonth) {
      const month = Number(firstOfMonth.date.slice(5, 7)) - 1;
      labels.push({ week: index, label: MONTHS[month]! });
    }
  });
  return labels;
}
