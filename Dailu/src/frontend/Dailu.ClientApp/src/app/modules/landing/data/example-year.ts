import { addDays } from 'date-fns/addDays';
import { format } from 'date-fns/format';

/** Small deterministic PRNG so the example heatmap is stable between renders. */
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Example check counts (0–6 per day) up to `until`, mostly high with quieter
 * weekends — the "long game" heatmap is meant to look like a good year.
 */
export function exampleYearCounts(year: number, until: Date): Map<string, number> {
  const random = mulberry32(year);
  const counts = new Map<string, number>();
  for (let date = new Date(year, 0, 1); date <= until && date.getFullYear() === year; date = addDays(date, 1)) {
    const weekend = date.getDay() === 0 || date.getDay() === 6;
    const roll = random();
    const count = weekend
      ? Math.floor(roll * 5)
      : roll < 0.08 ? Math.floor(roll * 30) : 4 + Math.floor(random() * 3);
    counts.set(format(date, 'yyyy-MM-dd'), count);
  }
  return counts;
}

export function totalChecks(counts: ReadonlyMap<string, number>): number {
  let total = 0;
  counts.forEach((count) => (total += count));
  return total;
}
