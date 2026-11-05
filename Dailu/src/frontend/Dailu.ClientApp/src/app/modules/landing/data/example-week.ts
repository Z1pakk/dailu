import { DialSegment, DialSegmentState } from '@shared/ui/ring-dial/ring-dial';

export interface ExampleWeekDay {
  day: string;
  segments: DialSegment[];
  future: boolean;
  today: boolean;
}

const HABITS = ['Morning run', 'Review a PR', 'Read', 'Ship a commit', 'Evening walk', 'Lights out'];

const day = (
  name: string,
  states: DialSegmentState[],
  options: Partial<Pick<ExampleWeekDay, 'future' | 'today'>> = {},
): ExampleWeekDay => ({
  day: name,
  segments: states.map((state, i) => ({
    state,
    label: HABITS[i]!,
    detail: state === 'manual' ? 'by you' : state,
  })),
  future: options.future ?? false,
  today: options.today ?? false,
});

/** Week 45 — "3 of 4 days closed" (Figma streaks `4:165`). */
export const EXAMPLE_WEEK: readonly ExampleWeekDay[] = [
  day('Mon', ['auto', 'auto', 'manual', 'auto', 'auto', 'auto']),
  day('Tue', ['auto', 'auto', 'manual', 'auto', 'auto', 'auto']),
  day('Wed', ['auto', 'auto', 'manual', 'auto', 'missed', 'auto']),
  day('Thu', ['auto', 'auto', 'manual', 'auto', 'scheduled', 'scheduled'], { today: true }),
  day('Fri', [], { future: true }),
  day('Sat', [], { future: true }),
  day('Sun', [], { future: true }),
];
