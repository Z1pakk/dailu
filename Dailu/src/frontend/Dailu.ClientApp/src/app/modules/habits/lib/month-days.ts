import { getDate } from 'date-fns/getDate';
import { getDaysInMonth } from 'date-fns/getDaysInMonth';
import { parseISO } from 'date-fns/parseISO';

/*
 * Days of the month (1–31) as the API sends them. The TS twin of the domain's MonthDays:
 * a picked day the month doesn't have (29–31) falls on its last day.
 */

/** Same rule as MonthDays.Matches. `day` is 'yyyy-MM-dd', like localDay output. */
export function matchesMonthDay(monthDays: readonly number[], day: string): boolean {
  if (monthDays.length === 0) {
    return false;
  }
  const date = parseISO(day);
  const dayOfMonth = getDate(date);
  const last = getDaysInMonth(date);
  return monthDays.includes(dayOfMonth) || (dayOfMonth === last && Math.max(...monthDays) > last);
}

/** 1 → "1st", 2 → "2nd", 11 → "11th", 22 → "22nd", 31 → "31st" */
export function ordinalDay(day: number): string {
  const lastTwo = day % 100;
  if (lastTwo >= 11 && lastTwo <= 13) {
    return `${day}th`;
  }
  switch (day % 10) {
    case 1:
      return `${day}st`;
    case 2:
      return `${day}nd`;
    case 3:
      return `${day}rd`;
    default:
      return `${day}th`;
  }
}

/** [15, 1, 31] → "1st, 15th and 31st" */
export function formatMonthDays(monthDays: readonly number[]): string {
  const ordinals = [...monthDays].sort((a, b) => a - b).map(ordinalDay);
  if (ordinals.length <= 1) {
    return ordinals.join('');
  }
  return `${ordinals.slice(0, -1).join(', ')} and ${ordinals[ordinals.length - 1]}`;
}

const SHORT_MONTH_EXAMPLES: Record<number, string> = {
  29: '28 Feb (in non-leap years)',
  30: '28 Feb',
  31: '30 Nov, 28 Feb',
};

/** The drawer's info message; null unless 29–31 is picked. Names the highest picked day. */
export function shortMonthWarning(monthDays: readonly number[]): string | null {
  const highest = monthDays.length > 0 ? Math.max(...monthDays) : 0;
  if (highest < 29) {
    return null;
  }
  return (
    `Not every month has a ${ordinalDay(highest)}. In those months this habit moves to the last ` +
    `day of the month — e.g. ${SHORT_MONTH_EXAMPLES[highest]}.`
  );
}
