/** 468 → "7 h 48 m", 45 → "45 m", 120 → "2 h". */
export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0 && m > 0) {
    return `${h} h ${m} m`;
  }
  if (h > 0) {
    return `${h} h`;
  }
  return `${m} m`;
}
