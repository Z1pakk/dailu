import { format } from 'date-fns/format';
import { parseISO } from 'date-fns/parseISO';

/** Local calendar day as 'yyyy-MM-dd' — how entries are bucketed into days. */
export function localDay(value: string | Date): string {
  const date = typeof value === 'string' ? parseISO(value) : value;
  return format(date, 'yyyy-MM-dd');
}
