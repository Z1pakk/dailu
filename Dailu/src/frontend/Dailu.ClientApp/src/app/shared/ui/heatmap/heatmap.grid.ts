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
