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
import { UserProfileApi } from '@user-profile/api/user-profile.api';
import { UserProfileStateSelectors } from '@user-profile/state/user-profile.selector';
import { IntegrationSummary } from '@user-profile/models/integration-summary.model';
import { automationSources } from '@habits/enums/automation-source.enum';
import { githubEventTypes } from '@habits/enums/github-event-type.enum';
import { HabitDrawerFacadeService } from './habit-drawer-facade.service';

const habit = (overrides: Partial<HabitModel> = {}): HabitModel => ({
  id: 'h1',
  name: 'Read',
  type: habitTypes.binary,
  frequency: { type: frequencyTypes.daily, timesPerPeriod: 1 },
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
  let userProfileApi: jasmine.SpyObj<UserProfileApi>;
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
      selector === UserProfileStateSelectors.getSlices.integrationSummaries ? summaries : signal([])) as never);
    store.dispatch.and.callFake((action: unknown) =>
      action instanceof HabitCreateHabit || action instanceof HabitUpdateHabit ? saveResult : of(undefined),
    );
    messages = jasmine.createSpyObj<MessageService>('MessageService', ['add']);
    userProfileApi = jasmine.createSpyObj<UserProfileApi>('UserProfileApi', ['getGithubRepos']);

    TestBed.configureTestingModule({
      providers: [
        HabitDrawerFacadeService,
        { provide: Store, useValue: store },
        { provide: MessageService, useValue: messages },
        { provide: UserProfileApi, useValue: userProfileApi },
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
    userProfileApi.getGithubRepos.and.returnValue(throwError(() => new Error('401')));
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

  it('should ignore an empty times field once Custom is no longer selected', () => {
    facade.init(null);
    facade.form.controls.name.setValue('Read');
    facade.form.controls.scheduleMode.setValue('custom');
    facade.form.controls.customTimesPerPeriod.setValue(null as unknown as number);
    expect(facade.form.valid).toBeFalse();
    facade.form.controls.scheduleMode.setValue('daily');
    expect(facade.form.valid).toBeTrue();
  });
});
