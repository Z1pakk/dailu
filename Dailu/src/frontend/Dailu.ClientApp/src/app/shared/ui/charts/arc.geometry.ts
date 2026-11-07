/**
 * Pure SVG geometry for Dailu's dials.
 * Angles are in degrees, SVG convention (y grows down): 0° = right, 90° = down,
 * 180° = left, 270° = up.
 */

export interface Point {
  x: number;
  y: number;
}

export interface AngleRange {
  start: number;
  end: number;
}

/** Day clock: 06:00 sits at 180° (left), 24:00 at 360° (right), 10° per hour. */
export const CLOCK_START_MINUTES = 6 * 60;
export const CLOCK_END_MINUTES = 24 * 60;

const round2 = (value: number): number => Math.round(value * 100) / 100 + 0;

export function minutesToClockAngle(minutes: number): number {
  const angle = 180 + (minutes - CLOCK_START_MINUTES) / 6;
  return Math.min(360, Math.max(180, angle));
}

export function polarToPoint(
  cx: number,
  cy: number,
  r: number,
  angleDeg: number,
): Point {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: round2(cx + r * Math.cos(rad)), y: round2(cy + r * Math.sin(rad)) };
}

/** Clockwise stroke arc from startDeg to endDeg (endDeg > startDeg, span < 360). */
export function describeArc(
  cx: number,
  cy: number,
  r: number,
  startDeg: number,
  endDeg: number,
): string {
  const from = polarToPoint(cx, cy, r, startDeg);
  const to = polarToPoint(cx, cy, r, endDeg);
  const largeArc = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${from.x} ${from.y} A ${r} ${r} 0 ${largeArc} 1 ${to.x} ${to.y}`;
}

/** `count` equal slices of a full ring, each shrunk by gapDeg/2 at both ends. */
export function ringSegments(
  count: number,
  gapDeg: number,
  startDeg = -90,
): AngleRange[] {
  if (count <= 0) {
    return [];
  }
  const slice = 360 / count;
  const half = gapDeg / 2;
  return Array.from({ length: count }, (_, i) => ({
    start: round2(startDeg + i * slice + half),
    end: round2(startDeg + (i + 1) * slice - half),
  }));
}

/** Minutes since midnight → 'HH:mm' (24h). */
export function formatMinutes(minutes: number): string {
  const normalized = ((Math.round(minutes) % 1440) + 1440) % 1440;
  const h = Math.floor(normalized / 60);
  const m = normalized % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
