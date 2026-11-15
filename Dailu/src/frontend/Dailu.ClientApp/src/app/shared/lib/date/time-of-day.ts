/*
 * A wall-clock time of day in its three shapes: the API's "HH:mm:ss" (TimeOnly),
 * minutes since midnight for the clock, and a Date for the time picker.
 */

/** "07:30:00" → 450 */
export function timeOfDayToMinutes(value: string): number {
  const [hours = 0, minutes = 0] = value.split(':').map(Number);
  return hours * 60 + minutes;
}

/** 450 → "07:30" (display) */
export function formatTimeOfDay(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Picker Date → "07:30:00" (wire). Seconds are dropped. */
export function dateToTimeOfDay(date: Date): string {
  return `${formatTimeOfDay(date.getHours() * 60 + date.getMinutes())}:00`;
}

/** "07:30:00" → a Date on `day` (default: today) at 07:30, for the time picker. */
export function timeOfDayToDate(value: string, day: Date = new Date()): Date {
  const minutes = timeOfDayToMinutes(value);
  const date = new Date(day);
  date.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  return date;
}
