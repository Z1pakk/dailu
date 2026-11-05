import { ClockHabit } from '@shared/ui/day-clock/day-clock.model';

const at = (h: number, m: number): number => h * 60 + m;

/** The example day shown on the landing page (Figma: Day clock `3:306`, sources `4:265`). */
export const EXAMPLE_DAY: readonly ClockHabit[] = [
  {
    id: 'morning-run',
    name: 'Morning run',
    startMinutes: at(6, 45),
    endMinutes: at(7, 36),
    source: 'strava',
    doneLabel: 'auto · Strava 06:52',
    waitingLabel: 'at 06:45',
  },
  {
    id: 'review-pr',
    name: 'Review a PR',
    startMinutes: at(9, 30),
    endMinutes: at(11, 0),
    source: 'github',
    doneLabel: 'auto · GitHub PR #479',
    waitingLabel: 'at 09:30',
  },
  {
    id: 'read',
    name: 'Read',
    startMinutes: at(12, 30),
    endMinutes: at(13, 18),
    source: 'manual',
    doneLabel: 'checked by you',
    waitingLabel: 'at 12:30',
  },
  {
    id: 'ship-commit',
    name: 'Ship a commit',
    startMinutes: at(14, 0),
    endMinutes: at(14, 48),
    source: 'github',
    doneLabel: 'auto · GitHub #482',
    waitingLabel: 'at 14:00',
  },
  {
    id: 'evening-walk',
    name: 'Evening walk',
    startMinutes: at(18, 0),
    endMinutes: at(18, 30),
    source: 'google-health',
    doneLabel: 'auto · Google Health 18:14',
    waitingLabel: 'at 18:00',
  },
  {
    id: 'lights-out',
    name: 'Lights out',
    startMinutes: at(22, 30),
    endMinutes: at(23, 48),
    source: 'google-health',
    doneLabel: 'auto · Google Health 23:02',
    waitingLabel: 'at 22:30',
  },
];
