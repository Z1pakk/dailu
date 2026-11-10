import { HabitModel } from '@habits/models/habit.model';
import { CreateHabitRequestModel } from '@habits/models/requests/create-habit.request';
import { frequencyTypes } from '@habits/enums/frequency-type.enum';
import { habitStatuses } from '@habits/enums/habit-status.enum';
import { habitTypes } from '@habits/enums/habit-type.enum';
import { automationSources } from '@habits/enums/automation-source.enum';
import { stravaActivityTypes } from '@habits/enums/strava-activity-type.enum';
import { githubEventTypes } from '@habits/enums/github-event-type.enum';
import { googleHealthMetrics } from '@habits/enums/google-health-metric.enum';
import {
  autoCheckSummary,
  drawerValueFromHabit,
  emptyDrawerValue,
  HabitDrawerValue,
  toHabitRequest,
} from './habit-form-mapping';

const habit = (overrides: Partial<HabitModel> = {}): HabitModel => ({
  id: 'h1',
  name: 'Read',
  description: 'A chapter a day',
  type: habitTypes.binary,
  frequency: { type: frequencyTypes.daily, timesPerPeriod: 1 },
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
      ['weekly × 5', habit({ frequency: { type: frequencyTypes.weekly, timesPerPeriod: 5 } })],
      ['daily × 3', habit({ frequency: { type: frequencyTypes.daily, timesPerPeriod: 3 } })],
      ['monthly × 2', habit({ frequency: { type: frequencyTypes.monthly, timesPerPeriod: 2 } })],
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
    it('should open daily × 3 on Custom with its own frequency', () => {
      const v = drawerValueFromHabit(habit({ frequency: { type: frequencyTypes.daily, timesPerPeriod: 3 } }));
      expect(v.scheduleMode).toBe('custom');
      expect(v.customFrequencyType).toBe(frequencyTypes.daily);
      expect(v.customTimesPerPeriod).toBe(3);
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
          frequency: { type: frequencyTypes.daily, timesPerPeriod: 1 },
          automationSource: null,
          automationFilter: null,
          milestone: null,
          endDate: null,
        }),
      );
    });

    it('should save Weekdays as weekly × 5', () => {
      expect(toHabitRequest(value({ scheduleMode: 'weekdays' }), null).frequency).toEqual({
        type: frequencyTypes.weekly,
        timesPerPeriod: 5,
      });
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
