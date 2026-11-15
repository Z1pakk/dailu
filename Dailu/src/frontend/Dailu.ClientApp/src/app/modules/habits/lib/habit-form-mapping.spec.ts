import { HabitModel } from '@habits/models/habit.model';
import { CreateHabitRequestModel } from '@habits/models/requests/create-habit.request';
import { frequencyTypes } from '@habits/enums/frequency-type.enum';
import { habitStatuses } from '@habits/enums/habit-status.enum';
import { habitTypes } from '@habits/enums/habit-type.enum';
import { automationSources } from '@habits/enums/automation-source.enum';
import { stravaActivityTypes } from '@habits/enums/strava-activity-type.enum';
import { githubEventTypes } from '@habits/enums/github-event-type.enum';
import { googleHealthMetrics } from '@habits/enums/google-health-metric.enum';
import { FrequencyModel } from '@habits/models/frequency.model';
import {
  autoCheckSummary,
  drawerValueFromHabit,
  emptyDrawerValue,
  HabitDrawerValue,
  toHabitRequest,
} from './habit-form-mapping';

const frequency = (overrides: Partial<FrequencyModel> = {}): FrequencyModel => ({
  type: frequencyTypes.daily,
  weekDays: [],
  monthDays: [],
  timesPerPeriod: 1,
  ...overrides,
});

const habit = (overrides: Partial<HabitModel> = {}): HabitModel => ({
  id: 'h1',
  name: 'Read',
  description: 'A chapter a day',
  type: habitTypes.binary,
  frequency: frequency(),
  timing: { at: null, durationMinutes: null },
  target: { value: 1, unit: 'Session' },
  status: habitStatuses.ongoing,
  isArchived: false,
  tags: [{ id: 't1', name: 'focus' } as HabitModel['tags'][number]],
  createdAtUtc: new Date('2026-01-01T10:00:00Z'),
  lastCompletedAtUtc: new Date('2026-01-01T10:00:00Z'),
  ...overrides,
});

/** The request the habit itself describes — what saving it untouched must send. */
const ownRequest = (h: HabitModel): CreateHabitRequestModel => ({
  name: h.name,
  description: h.description ?? null,
  type: h.type,
  frequency: h.frequency,
  timing: h.timing,
  target: h.target,
  endDate: null,
  milestone: h.milestone ?? null,
  tagIds: h.tags.map((t) => t.id),
  automationSource: h.automationSource ?? null,
  automationFilter: h.automationFilter ?? null,
});

const value = (overrides: Partial<HabitDrawerValue>): HabitDrawerValue => ({
  ...emptyDrawerValue(),
  name: 'Read',
  ...overrides,
});

describe('habit-form-mapping', () => {
  describe('round trip: saving an untouched habit', () => {
    const cases: [string, HabitModel][] = [
      ['daily × 1', habit()],
      ['weekdays (Mon–Fri)', habit({ frequency: frequency({ type: frequencyTypes.weekly, weekDays: [1, 2, 3, 4, 5] }) })],
      ['weekly × 2, any days', habit({ frequency: frequency({ type: frequencyTypes.weekly, weekDays: [], monthDays: [], timesPerPeriod: 2 }) })],
      ['monthly × 2, any days', habit({ frequency: frequency({ type: frequencyTypes.monthly, weekDays: [], monthDays: [], timesPerPeriod: 2 }) })],
      [
        'Mon, Wed, Fri at 07:00 for 45 min (set through the API)',
        habit({
          frequency: frequency({ type: frequencyTypes.weekly, weekDays: [1, 3, 5] }),
          timing: { at: '07:00:00', durationMinutes: 45 },
        }),
      ],
      [
        'monthly on the 1st and 15th (set through the API)',
        habit({ frequency: frequency({ type: frequencyTypes.monthly, monthDays: [1, 15] }) }),
      ],
      ['daily, any time, 30 min', habit({ timing: { at: null, durationMinutes: 30 } })],
      [
        'measurable Strava',
        habit({
          type: habitTypes.measurable,
          target: { value: 3, unit: 'km' },
          automationSource: automationSources.strava,
          automationFilter: { type: 'strava', activityTypes: [stravaActivityTypes.run] },
          milestone: { target: 50, current: 12 },
        }),
      ],
      [
        'GitHub',
        habit({
          automationSource: automationSources.github,
          automationFilter: {
            type: 'github',
            repositoryId: 7,
            repositoryName: 'vlad/dailu-api',
            eventTypes: [githubEventTypes.push],
          },
        }),
      ],
    ];

    for (const [name, h] of cases) {
      it(`should keep a ${name} habit unchanged`, () => {
        expect(toHabitRequest(drawerValueFromHabit(h), h)).toEqual(ownRequest(h));
      });
    }
  });

  describe('drawerValueFromHabit', () => {
    it('should copy the schedule', () => {
      const v = drawerValueFromHabit(
        habit({ frequency: frequency({ type: frequencyTypes.weekly, weekDays: [1, 3, 5] }) }),
      );
      expect([v.frequencyType, v.weekDays, v.monthDays, v.timesPerPeriod]).toEqual([frequencyTypes.weekly, [1, 3, 5], [], 1]);
    });

    it('should open a timed habit on "At a time" with the time on today', () => {
      const v = drawerValueFromHabit(habit({ timing: { at: '07:30:00', durationMinutes: 45 } }));
      expect(v.timeMode).toBe('at');
      expect([v.at?.getHours(), v.at?.getMinutes()]).toEqual([7, 30]);
      expect(v.durationMinutes).toBe(45);
    });

    it('should open an untimed habit on "Any time"', () => {
      const v = drawerValueFromHabit(habit({ timing: { at: null, durationMinutes: 30 } }));
      expect([v.timeMode, v.at, v.durationMinutes]).toEqual(['any', null, 30]);
    });

    it('should leave "At least" empty for a binary habit', () => {
      const v = drawerValueFromHabit(habit());
      expect(v.targetValue).toBeNull();
      expect(v.targetUnit).toBe('');
    });

    it('should treat a missing source as Manual', () => {
      expect(drawerValueFromHabit(habit()).automationSource).toBe(automationSources.none);
    });
  });

  describe('toHabitRequest', () => {
    it('should create a binary daily habit with defaults', () => {
      const request = toHabitRequest(value({}), null);
      expect(request).toEqual(
        jasmine.objectContaining({
          name: 'Read',
          description: null,
          type: habitTypes.binary,
          target: { value: 1, unit: 'Session' },
          frequency: frequency(),
          timing: { at: null, durationMinutes: null },
          automationSource: null,
          automationFilter: null,
          milestone: null,
          endDate: null,
        }),
      );
    });

    it('should save Weekly with the picked days in order', () => {
      const request = toHabitRequest(value({ frequencyType: frequencyTypes.weekly, weekDays: [5, 1, 3] }), null);
      expect(request.frequency).toEqual(frequency({ type: frequencyTypes.weekly, weekDays: [1, 3, 5] }));
    });

    it('should save Monthly with the picked days of the month', () => {
      const request = toHabitRequest(value({ frequencyType: frequencyTypes.monthly, monthDays: [15, 1] }), null);
      expect(request.frequency).toEqual(frequency({ type: frequencyTypes.monthly, monthDays: [1, 15] }));
    });

    it('should never send days left over from another period', () => {
      const request = toHabitRequest(
        value({ frequencyType: frequencyTypes.weekly, weekDays: [2], monthDays: [1, 15] }),
        null,
      );
      expect(request.frequency.monthDays).toEqual([]);
    });

    it('should send the count only without days', () => {
      const flexible = toHabitRequest(value({ frequencyType: frequencyTypes.weekly, timesPerPeriod: 3 }), null);
      const stale = toHabitRequest(value({ frequencyType: frequencyTypes.weekly, weekDays: [1], timesPerPeriod: 3 }), null);
      expect(flexible.frequency.timesPerPeriod).toBe(3);
      expect(stale.frequency.timesPerPeriod).toBe(1);
    });

    it('should send the time with "At a time" on fixed days', () => {
      const request = toHabitRequest(
        value({ frequencyType: frequencyTypes.weekly, weekDays: [1, 3, 5], timeMode: 'at', at: new Date(2026, 10, 16, 7, 0), durationMinutes: 45 }),
        null,
      );
      expect(request.timing).toEqual({ at: '07:00:00', durationMinutes: 45 });
    });

    it('should not send a time without picked days, but keep the duration', () => {
      const request = toHabitRequest(
        value({ frequencyType: frequencyTypes.weekly, timeMode: 'at', at: new Date(2026, 10, 16, 7, 0), durationMinutes: 30 }),
        null,
      );
      expect(request.timing).toEqual({ at: null, durationMinutes: 30 });
    });

    it('should not send a time with "Any time"', () => {
      const request = toHabitRequest(value({ timeMode: 'any', at: new Date(2026, 10, 16, 7, 0) }), null);
      expect(request.timing.at).toBeNull();
    });

    it('should make a habit measurable when "At least" has an amount', () => {
      const request = toHabitRequest(value({ targetValue: 3, targetUnit: ' km ' }), null);
      expect(request.type).toBe(habitTypes.measurable);
      expect(request.target).toEqual({ value: 3, unit: 'km' });
    });

    it('should turn a measurable habit binary when "At least" is cleared', () => {
      const measurable = habit({ type: habitTypes.measurable, target: { value: 3, unit: 'km' } });
      const request = toHabitRequest({ ...drawerValueFromHabit(measurable), targetValue: null }, measurable);
      expect(request.type).toBe(habitTypes.binary);
      expect(request.target).toEqual({ value: 1, unit: 'Session' });
    });

    it('should keep the stored milestone progress when the target changes', () => {
      const h = habit({ milestone: { target: 50, current: 12 } });
      const request = toHabitRequest({ ...drawerValueFromHabit(h), milestoneTarget: 60 }, h);
      expect(request.milestone).toEqual({ target: 60, current: 12 });
    });

    it('should keep the stored GitHub filter when the integration was disconnected', () => {
      const filter = {
        type: 'github' as const,
        repositoryId: 7,
        repositoryName: 'vlad/dailu-api',
        eventTypes: [githubEventTypes.pullRequest],
      };
      const h = habit({ automationSource: automationSources.github, automationFilter: filter });
      const request = toHabitRequest(
        { ...drawerValueFromHabit(h), githubRepositoryId: null, githubRepositoryName: null },
        h,
      );
      expect(request.automationSource).toBe(automationSources.github);
      expect(request.automationFilter).toEqual(filter);
    });

    it('should drop the filter when switching to Manual', () => {
      const h = habit({
        automationSource: automationSources.strava,
        automationFilter: { type: 'strava', activityTypes: [stravaActivityTypes.run] },
      });
      const request = toHabitRequest({ ...drawerValueFromHabit(h), automationSource: automationSources.none }, h);
      expect(request.automationSource).toBeNull();
      expect(request.automationFilter).toBeNull();
    });

    it('should send the end date as a local date', () => {
      expect(toHabitRequest(value({ endDate: new Date(2026, 11, 31) }), null).endDate).toBe('2026-12-31');
    });
  });

  describe('autoCheckSummary', () => {
    it('should describe Strava without a threshold', () => {
      expect(
        autoCheckSummary(
          value({ automationSource: automationSources.strava, stravaActivityTypes: [stravaActivityTypes.run] }),
        ),
      ).toBe('Checked every 5 min. Any Strava run ticks this habit.');
    });

    it('should join several Strava types with "or"', () => {
      expect(
        autoCheckSummary(
          value({
            automationSource: automationSources.strava,
            stravaActivityTypes: [stravaActivityTypes.run, stravaActivityTypes.ride],
          }),
        ),
      ).toBe('Checked every 5 min. Any Strava run or ride ticks this habit.');
    });

    it('should name the GitHub event and repository', () => {
      expect(
        autoCheckSummary(
          value({
            automationSource: automationSources.github,
            githubRepositoryName: 'dailu-api',
            githubEventTypes: [githubEventTypes.push],
          }),
        ),
      ).toBe('Checked every 2 min. Any push to dailu-api ticks this habit.');
    });

    it('should fall back when nothing is picked yet', () => {
      expect(autoCheckSummary(value({ automationSource: automationSources.github }))).toBe(
        'Checked every 2 min. Any push or pull request to your repository ticks this habit.',
      );
      expect(autoCheckSummary(value({ automationSource: automationSources.googleHealth }))).toBe(
        'Checked every 5 min. Any Google Health activity ticks this habit.',
      );
    });

    it('should describe Google Health metrics', () => {
      expect(
        autoCheckSummary(
          value({ automationSource: automationSources.googleHealth, googleHealthMetrics: [googleHealthMetrics.steps] }),
        ),
      ).toBe('Checked every 5 min. Any Google Health steps ticks this habit.');
    });

    it('should return null for Manual', () => {
      expect(autoCheckSummary(value({}))).toBeNull();
    });
  });
});
