import { format } from 'date-fns/format';

export type HeatIntensity = 0 | 1 | 2 | 3 | 4;

export interface HeatCell {
  day: number;
  date: Date;
  intensity: HeatIntensity;
  count: number;
  today: boolean;
  tooltip: string;
}

const COUNT_BY_INTENSITY: Record<HeatIntensity, number> = {
  0: 0,
  1: 1,
  2: 3,
  3: 6,
  4: 10,
};

export const INTENSITY_CLASSES: Record<HeatIntensity, string> = {
  0: 'bg-zinc-100',
  1: 'bg-blue-100',
  2: 'bg-blue-200',
  3: 'bg-blue-400',
  4: 'bg-blue-500',
};

function pickIntensity(isToday: boolean, r: number): HeatIntensity {
  if (isToday) {
    return Math.random() > 0.4 ? 2 : 1;
  }
  if (r < 0.35) {
    return 1;
  }
  if (r < 0.65) {
    return 2;
  }
  if (r < 0.87) {
    return 3;
  }
  return 4;
}

export function buildHeatCells(cols: number): HeatCell[] {
  const today = new Date();
  const cells: HeatCell[] = [];

  for (let i = cols * 3 - 1; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);

    const isToday = i === 0;
    const intensity = pickIntensity(isToday, Math.random());
    const count = COUNT_BY_INTENSITY[intensity] + Math.floor(Math.random() * 2);
    const dateLabel = format(date, 'MMM d, yyyy');

    let tooltip: string;
    if (count === 0) {
      tooltip = `${dateLabel} — no entries`;
    } else {
      const entryLabel = count === 1 ? 'entry' : 'entries';
      tooltip = `${dateLabel} — ${count} ${entryLabel}`;
    }

    cells.push({
      day: date.getDate(),
      date,
      intensity,
      count,
      today: isToday,
      tooltip,
    });
  }
  return cells;
}
