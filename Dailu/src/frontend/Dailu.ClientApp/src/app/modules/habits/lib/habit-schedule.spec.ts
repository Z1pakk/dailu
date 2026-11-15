import { HabitModel } from '@habits/models/habit.model';
import { FrequencyModel } from '@habits/models/frequency.model';
import { TimingModel } from '@habits/models/timing.model';
import { frequencyTypes } from '@habits/enums/frequency-type.enum';
import { habitStatuses } from '@habits/enums/habit-status.enum';
import { habitTypes } from '@habits/enums/habit-type.enum';
import {
  daysHint,
  hasFixedDays,
  hasTime,
  isScheduledOn,
  isWeekdays,
  scheduleLabel,
  timeHint,
  timesPerPeriod,
} from './habit-schedule';

const ANY_TIME: TimingModel = { at: null, durationMinutes: null };

const daily = (): FrequencyModel => ({ type: frequencyTypes.daily, weekDays: [], monthDays: [], timesPerPeriod: 1 });
const weekly = (weekDays: number[] = [], times = 1): FrequencyModel => ({
  type: frequencyTypes.weekly,
  weekDays: weekDays as FrequencyModel['weekDays'],
  monthDays: [],
  timesPerPeriod: times,
});
const monthly = (monthDays: number[] = [], times = 1): FrequencyModel => ({
  type: frequencyTypes.monthly,
  weekDays: [],
  monthDays,
  timesPerPeriod: times,
});

const habit = (frequency: FrequencyModel, overrides: Partial<HabitModel> = {}): HabitModel => ({
  id: 'h1',
  name: 'Read',
  type: habitTypes.binary,
  frequency,
  timing: ANY_TIME,
  target: { value: 1, unit: 'Session' },
  status: habitStatuses.ongoing,
  isArchived: false,
  tags: [],
  createdAtUtc: new Date(2026, 9, 1, 12, 0),
  lastCompletedAtUtc: new Date(2026, 9, 1, 12, 0),
  ...overrides,
});

const MON_WED_FRI = [1, 3, 5];
const MON_TO_FRI = [1, 2, 3, 4, 5];

describe('habit-schedule', () => {
  describe('isScheduledOn', () => {
    // The same table as the domain's IsScheduledOn tests (docs/habit-schedule, phase 1, step 1.7).
    const cases: [string, FrequencyModel, string, boolean][] = [
      ['daily', daily(), '2026-11-05', true],
      ['weekly Mon/Wed/Fri on a Tuesday', weekly(MON_WED_FRI), '2026-11-03', false],
      ['weekly Mon/Wed/Fri on a Wednesday', weekly(MON_WED_FRI), '2026-11-04', true],
      ['weekly Sun on a Sunday', weekly([0]), '2026-11-08', true],
      ['weekly, no days', weekly(), '2026-11-03', true],
      ['weekly, no days, × 2', weekly([], 2), '2026-11-03', true],
      ['monthly 1st and 15th on the 15th', monthly([1, 15]), '2026-11-15', true],
      ['monthly 1st and 15th on the 16th', monthly([1, 15]), '2026-11-16', false],
      ['monthly 31st on 30 November', monthly([31]), '2026-11-30', true],
      ['monthly 31st on 29 November', monthly([31]), '2026-11-29', false],
      ['monthly 29th and 30th on 28 February', monthly([29, 30]), '2027-02-28', true],
      ['monthly, no days', monthly(), '2026-11-17', true],
      ['anything before it was created', daily(), '2026-09-30', false],
    ];

    for (const [name, frequency, day, expected] of cases) {
      it(`should be ${expected} for ${name}`, () => {
        expect(isScheduledOn(habit(frequency), day)).toBe(expected);
      });
    }

    it('should not be scheduled after the end date', () => {
      const h = habit(daily(), { endDate: '2026-11-20' as unknown as Date });
      expect(isScheduledOn(h, '2026-11-20')).toBeTrue();
      expect(isScheduledOn(h, '2026-11-21')).toBeFalse();
    });

    it('should not be scheduled when archived or completed', () => {
      expect(isScheduledOn(habit(daily(), { isArchived: true }), '2026-11-05')).toBeFalse();
      expect(isScheduledOn(habit(daily(), { status: habitStatuses.completed }), '2026-11-05')).toBeFalse();
    });
  });

  describe('hasFixedDays', () => {
    it('should be true for daily or picked days only', () => {
      expect(hasFixedDays(daily())).toBeTrue();
      expect(hasFixedDays(weekly([1]))).toBeTrue();
      expect(hasFixedDays(monthly([1]))).toBeTrue();
      expect(hasFixedDays(weekly())).toBeFalse();
      expect(hasFixedDays(monthly())).toBeFalse();
    });
  });

  describe('timesPerPeriod', () => {
    it('should use the count only without days', () => {
      expect(timesPerPeriod(weekly([], 2))).toBe(2);
      expect(timesPerPeriod(monthly([], 3))).toBe(3);
      expect(timesPerPeriod(weekly([1], 4))).toBe(1);
      expect(timesPerPeriod(daily())).toBe(1);
    });
  });

  describe('isWeekdays', () => {
    it('should be true only for weekly Mon–Fri', () => {
      expect(isWeekdays(weekly(MON_TO_FRI))).toBeTrue();
      expect(isWeekdays(weekly([5, 4, 3, 2, 1]))).toBeTrue();
      expect(isWeekdays(weekly(MON_WED_FRI))).toBeFalse();
      expect(isWeekdays(weekly([0, 1, 2, 3, 4]))).toBeFalse();
      expect(isWeekdays(weekly([], 5))).toBeFalse();
    });
  });

  describe('hasTime', () => {
    it('should follow timing.at', () => {
      expect(hasTime(habit(daily()))).toBeFalse();
      expect(hasTime(habit(daily(), { timing: { at: '07:00:00', durationMinutes: null } }))).toBeTrue();
    });
  });

  describe('scheduleLabel', () => {
    const cases: [FrequencyModel, string][] = [
      [daily(), 'Daily'],
      [weekly(MON_TO_FRI), 'Weekdays'],
      [weekly([5, 1, 3]), 'Mon, Wed, Fri'],
      [weekly([0, 1]), 'Mon, Sun'],
      [weekly(), 'Weekly'],
      [weekly([], 2), '2× a week'],
      [monthly([15, 1]), 'Monthly · 1st, 15th'],
      [monthly([31]), 'Monthly · last day'],
      [monthly(), 'Monthly'],
      [monthly([], 3), '3× a month'],
    ];

    for (const [frequency, label] of cases) {
      it(`should label ${label}`, () => {
        expect(scheduleLabel(habit(frequency))).toBe(label);
      });
    }

    it('should append the time and duration', () => {
      const timed = habit(weekly(MON_WED_FRI), { timing: { at: '07:00:00', durationMinutes: 45 } });
      const duration = habit(weekly([], 2), { timing: { at: null, durationMinutes: 30 } });
      expect(scheduleLabel(timed)).toBe('Mon, Wed, Fri · 07:00 · 45 m');
      expect(scheduleLabel(duration)).toBe('2× a week · 30 m');
    });
  });

  describe('daysHint', () => {
    it('should describe the picked days', () => {
      expect(daysHint(daily())).toBe('Every day · amounts go in "At least" below');
      expect(daysHint(weekly(MON_WED_FRI))).toBe('Mon, Wed, Fri · pick Mon–Fri for weekdays');
      expect(daysHint(weekly(MON_TO_FRI))).toBe('Weekdays · Mon–Fri');
      expect(daysHint(monthly([1, 15, 31]))).toBe('1st, 15th and 31st of every month');
    });

    it('should describe the count when no days are picked', () => {
      expect(daysHint(weekly())).toBe('No days picked · once a week, any day');
      expect(daysHint(weekly([], 2))).toBe('No days picked · 2 times a week, any days');
      expect(daysHint(monthly())).toBe('No days picked · once a month, any day');
      expect(daysHint(monthly([], 3))).toBe('No days picked · 3 times a month, any days');
    });
  });

  describe('timeHint', () => {
    it('should describe a timed habit', () => {
      expect(timeHint(weekly(MON_WED_FRI), { at: '07:00:00', durationMinutes: 45 })).toBe(
        '07:00–07:45 · on your clock',
      );
      expect(timeHint(monthly([1]), { at: '10:00:00', durationMinutes: null })).toBe('10:00 · on your clock');
    });

    it('should describe an any-time fixed-day habit', () => {
      expect(timeHint(daily(), ANY_TIME)).toBe('Due by midnight · not on your clock');
    });

    it('should ask for days on a flexible habit', () => {
      expect(timeHint(weekly(), ANY_TIME)).toBe('Pick days to set a time · due until done this week');
      expect(timeHint(weekly([], 2), ANY_TIME)).toBe('Pick days to set a time · due until done 2× this week');
      expect(timeHint(monthly([], 3), ANY_TIME)).toBe('Pick days to set a time · due until done 3× this month');
    });
  });
});
