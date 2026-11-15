import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { Store } from '@ngxs/store';
import { MessageService } from 'primeng/api';
import { of, Subject, throwError } from 'rxjs';
import { HabitModel } from '@habits/models/habit.model';
import { frequencyTypes } from '@habits/enums/frequency-type.enum';
import { habitStatuses } from '@habits/enums/habit-status.enum';
import { habitTypes } from '@habits/enums/habit-type.enum';
import { HabitCreateHabit, HabitFetchHabits, HabitUpdateHabit } from '@habits/state/habit.action';
import { drawerValueFromHabit, toHabitRequest } from '@habits/lib/habit-form-mapping';
import { IntegrationApi } from '@integrations/api/integration.api';
import { IntegrationStateSelectors } from '@integrations/state/integration.selector';
import { IntegrationSummary } from '@integrations/models/integration-summary.model';
import { automationSources } from '@habits/enums/automation-source.enum';
import { githubEventTypes } from '@habits/enums/github-event-type.enum';
import { HabitDrawerFacadeService } from './habit-drawer-facade.service';

const habit = (overrides: Partial<HabitModel> = {}): HabitModel => ({
  id: 'h1',
  name: 'Read',
  type: habitTypes.binary,
  frequency: { type: frequencyTypes.daily, weekDays: [], monthDays: [], timesPerPeriod: 1 },
  timing: { at: null, durationMinutes: null },
  target: { value: 1, unit: 'Session' },
  status: habitStatuses.ongoing,
  isArchived: false,
  tags: [],
  createdAtUtc: new Date('2026-01-01T10:00:00Z'),
  lastCompletedAtUtc: new Date('2026-01-01T10:00:00Z'),
  ...overrides,
});

describe('HabitDrawerFacadeService', () => {
  let store: jasmine.SpyObj<Store>;
  let messages: jasmine.SpyObj<MessageService>;
  let saveResult: Subject<void>;
  let facade: HabitDrawerFacadeService;
  let integrationApi: jasmine.SpyObj<IntegrationApi>;
  const summaries = signal<IntegrationSummary[] | null>([]);

  const saveCalls = () =>
    store.dispatch.calls
      .allArgs()
      .map(([action]) => action)
      .filter((action) => action instanceof HabitCreateHabit || action instanceof HabitUpdateHabit);

  beforeEach(() => {
    saveResult = new Subject<void>();
    store = jasmine.createSpyObj<Store>('Store', ['dispatch', 'selectSignal']);
    summaries.set([]);
    store.selectSignal.and.callFake(((selector: unknown) =>
      selector === IntegrationStateSelectors.getSlices.summaries ? summaries : signal([])) as never);
    store.dispatch.and.callFake((action: unknown) =>
      action instanceof HabitCreateHabit || action instanceof HabitUpdateHabit ? saveResult : of(undefined),
    );
    messages = jasmine.createSpyObj<MessageService>('MessageService', ['add']);
    integrationApi = jasmine.createSpyObj<IntegrationApi>('IntegrationApi', ['getGithubRepos']);

    TestBed.configureTestingModule({
      providers: [
        HabitDrawerFacadeService,
        { provide: Store, useValue: store },
        { provide: MessageService, useValue: messages },
        { provide: IntegrationApi, useValue: integrationApi },
      ],
    });
    facade = TestBed.inject(HabitDrawerFacadeService);
  });

  it('should create a habit from the form value', () => {
    facade.init(null);
    facade.form.controls.name.setValue('Read');

    facade.submit().subscribe();

    expect(saveCalls().length).toBe(1);
    const action = saveCalls()[0] as HabitCreateHabit;
    expect(action).toEqual(jasmine.any(HabitCreateHabit));
    expect(action.payload).toEqual(toHabitRequest(facade.form.getRawValue(), null));
  });

  it('should update an existing habit', () => {
    const existing = habit({ milestone: { target: 50, current: 12 } });
    facade.init(existing);

    facade.submit().subscribe();

    const action = saveCalls()[0] as HabitUpdateHabit;
    expect(action).toEqual(jasmine.any(HabitUpdateHabit));
    expect(action.id).toBe('h1');
    expect(action.payload).toEqual(toHabitRequest(drawerValueFromHabit(existing), existing));
  });

  it('should save once when submitted twice before the first save finishes', () => {
    facade.init(null);
    facade.form.controls.name.setValue('Read');

    facade.submit().subscribe();
    facade.submit().subscribe();

    expect(saveCalls().length).toBe(1);
    expect(facade.$isSubmitting()).toBeTrue();
  });

  it('should refresh habits and allow saving again after a successful save', () => {
    facade.init(null);
    facade.form.controls.name.setValue('Read');

    facade.submit().subscribe();
    saveResult.next();
    saveResult.complete();

    expect(store.dispatch).toHaveBeenCalledWith(jasmine.any(HabitFetchHabits));
    expect(messages.add).toHaveBeenCalled();
    expect(facade.$isSubmitting()).toBeFalse();
  });

  it('should require a name', () => {
    facade.init(null);
    expect(facade.form.valid).toBeFalse();
    facade.form.controls.name.setValue('Read');
    expect(facade.form.valid).toBeTrue();
  });

  it('should require a unit once "At least" has an amount', () => {
    facade.init(null);
    facade.form.controls.name.setValue('Run');
    facade.form.controls.targetValue.setValue(3);
    expect(facade.form.valid).toBeFalse();
    facade.form.controls.targetUnit.setValue('km');
    expect(facade.form.valid).toBeTrue();
  });

  it('should open an existing habit as a valid form', () => {
    facade.init(habit({ type: habitTypes.measurable, target: { value: 3, unit: 'km' } }));
    expect(facade.form.valid).toBeTrue();
  });

  it('should fall back to the stored repository when loading repositories fails', async () => {
    integrationApi.getGithubRepos.and.returnValue(throwError(() => new Error('401')));
    summaries.set([{ type: 'github', expiresAtUtc: null, lastSync: null }]);
    facade.init(
      habit({
        automationSource: automationSources.github,
        automationFilter: {
          type: 'github',
          repositoryId: 7,
          repositoryName: 'vlad/dailu-api',
          eventTypes: [githubEventTypes.push],
        },
      }),
    );
    TestBed.tick();
    await new Promise((resolve) => setTimeout(resolve));
    TestBed.tick();

    expect(() => facade.$githubRepoSelectItems()).not.toThrow();
    expect(facade.$githubRepoSelectItems()).toEqual([{ label: 'vlad/dailu-api', value: 7 }]);
  });

  it('should show why an edited habit with a past end date cannot be saved', () => {
    facade.init(habit({ endDate: new Date(2020, 0, 1) }));
    expect(facade.form.controls.endDate.invalid).toBeTrue();
    expect(facade.form.controls.endDate.touched).toBeTrue();
  });

  it('should flag the missing unit as soon as an amount is entered', () => {
    facade.init(null);
    facade.form.controls.targetValue.setValue(3);
    expect(facade.form.controls.targetUnit.invalid).toBeTrue();
    expect(facade.form.controls.targetUnit.touched).toBeTrue();
  });

  describe('schedule', () => {
    const controls = () => facade.form.controls;
    const weeklyMonday = () =>
      habit({
        frequency: { type: frequencyTypes.weekly, weekDays: [1], monthDays: [], timesPerPeriod: 1 },
        timing: { at: '07:00:00', durationMinutes: 45 },
      });

    it('should add and remove a weekday', () => {
      facade.init(null);
      facade.setFrequencyType(frequencyTypes.weekly);
      facade.toggleWeekDay(1);
      facade.toggleWeekDay(3);
      expect(controls().weekDays.value).toEqual([1, 3]);
      facade.toggleWeekDay(1);
      expect(controls().weekDays.value).toEqual([3]);
    });

    it('should clear the weekdays when switching to Monthly', () => {
      facade.init(null);
      facade.setFrequencyType(frequencyTypes.weekly);
      facade.toggleWeekDay(2);
      facade.setFrequencyType(frequencyTypes.monthly);
      expect(controls().weekDays.value).toEqual([]);
    });

    it('should drop the time when the last picked day is removed', () => {
      facade.init(weeklyMonday());
      expect(controls().timeMode.value).toBe('at');
      facade.toggleWeekDay(1);
      expect(controls().timeMode.value).toBe('any');
      expect(controls().at.value).toBeNull();
      expect(controls().durationMinutes.value).toBe(45);
    });

    it('should keep the count within the new period limit', () => {
      facade.init(null);
      facade.setFrequencyType(frequencyTypes.monthly);
      controls().timesPerPeriod.setValue(20);
      facade.setFrequencyType(frequencyTypes.weekly);
      expect(controls().timesPerPeriod.value).toBe(7);
      facade.setFrequencyType(frequencyTypes.daily);
      expect(controls().timesPerPeriod.value).toBe(1);
    });

    it('should reset the count once a day is picked', () => {
      facade.init(null);
      facade.setFrequencyType(frequencyTypes.weekly);
      controls().timesPerPeriod.setValue(3);
      facade.toggleWeekDay(2);
      expect(controls().timesPerPeriod.value).toBe(1);
    });

    it('should reject a count above the weekly limit', () => {
      facade.init(null);
      controls().name.setValue('Read');
      facade.setFrequencyType(frequencyTypes.weekly);
      controls().timesPerPeriod.setValue(8);
      expect(controls().timesPerPeriod.invalid).toBeTrue();
      controls().timesPerPeriod.setValue(7);
      expect(facade.form.valid).toBeTrue();
    });

    it('should require a start time with "At a time"', () => {
      facade.init(null);
      controls().name.setValue('Read');
      controls().timeMode.setValue('at');
      expect(controls().at.invalid).toBeTrue();
      controls().at.setValue(new Date(2026, 10, 16, 7, 0));
      expect(facade.form.valid).toBeTrue();
    });

    it('should reject a time that runs past midnight', () => {
      facade.init(null);
      controls().timeMode.setValue('at');
      controls().at.setValue(new Date(2026, 10, 16, 23, 30));
      controls().durationMinutes.setValue(45);
      expect(controls().at.getError('issue')).toContain('midnight');
      controls().durationMinutes.setValue(30);
      expect(controls().at.valid).toBeTrue();
    });

    it('should show the edited habit and the other timed habits today on the clock strip', () => {
      const other = habit({ id: 'other', timing: { at: '12:00:00', durationMinutes: 60 } });
      store.selectSignal.and.callFake(((selector: unknown) =>
        selector === IntegrationStateSelectors.getSlices.summaries ? summaries : signal([other])) as never);
      const withHabits = TestBed.runInInjectionContext(() => new HabitDrawerFacadeService());
      withHabits.init(weeklyMonday());
      withHabits.form.controls.weekDays.setValue([0, 1, 2, 3, 4, 5, 6]);
      const preview = withHabits.$clockPreview();
      expect(preview.meta).toBe('07:00–07:45');
      expect(preview.own?.left).toBeCloseTo(60 / 1080, 5);
      expect(preview.busy.length).toBe(1);
      expect(preview.busy[0]!.left).toBeCloseTo(360 / 1080, 5);
    });
  });
});
