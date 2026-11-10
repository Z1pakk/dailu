import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { Store } from '@ngxs/store';
import { MessageService } from 'primeng/api';
import { of, Subject } from 'rxjs';
import { HabitModel } from '@habits/models/habit.model';
import { frequencyTypes } from '@habits/enums/frequency-type.enum';
import { habitStatuses } from '@habits/enums/habit-status.enum';
import { habitTypes } from '@habits/enums/habit-type.enum';
import { HabitStateSelectors } from '@habits/state/habit.selector';
import { HabitEntryCreateHabitEntry, HabitEntryGetHabitEntries, HabitEntryUpdateHabitEntry } from '@habit-entries/state/habit-entry.action';
import { HabitEntryModel } from '@habit-entries/models/habit-entry.model';
import { habitEntrySources } from '@habit-entries/enums/habit-entry-source.enum';
import { localDay } from '@shared/lib/date/local-day';
import { LogEntryFacadeService } from './log-entry-facade.service';

const habit = (overrides: Partial<HabitModel> = {}): HabitModel => ({
  id: 'read', name: 'Read a book', type: habitTypes.measurable,
  frequency: { type: frequencyTypes.daily, timesPerPeriod: 1 }, target: { value: 2, unit: 'chapters' },
  status: habitStatuses.ongoing, isArchived: false, tags: [],
  createdAtUtc: new Date('2026-01-01T10:00:00Z'), lastCompletedAtUtc: new Date('2026-01-01T10:00:00Z'),
  ...overrides,
});

describe('LogEntryFacadeService', () => {
  let store: jasmine.SpyObj<Store>;
  let saveResult: Subject<void>;
  let facade: LogEntryFacadeService;
  const habits = signal<HabitModel[]>([habit(), habit({ id: 'pill', name: 'Take a pill', type: habitTypes.binary })]);

  const saves = () => store.dispatch.calls.allArgs().map(([a]) => a).filter((a) => a instanceof HabitEntryCreateHabitEntry) as HabitEntryCreateHabitEntry[];

  beforeEach(() => {
    habits.set([habit(), habit({ id: 'pill', name: 'Take a pill', type: habitTypes.binary })]);
    saveResult = new Subject<void>();
    store = jasmine.createSpyObj<Store>('Store', ['dispatch', 'selectSignal']);
    store.selectSignal.and.callFake(((selector: unknown) =>
      selector === HabitStateSelectors.getSlices.habits ? habits : signal([])) as never);
    store.dispatch.and.callFake((action: unknown) => (action instanceof HabitEntryCreateHabitEntry || action instanceof HabitEntryUpdateHabitEntry ? saveResult : of(undefined)));
    TestBed.configureTestingModule({
      providers: [
        LogEntryFacadeService,
        { provide: Store, useValue: store },
        { provide: MessageService, useValue: jasmine.createSpyObj('MessageService', ['add']) },
      ],
    });
    facade = TestBed.inject(LogEntryFacadeService);
  });

  it('should pick the first habit and default the amount to its target', () => {
    facade.init({});
    expect(facade.form.controls.habitId.value).toBe('read');
    expect(facade.form.controls.value.value).toBe(2);
  });

  it('should open a missed day on that habit and day', () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    facade.init({ habitId: 'pill', day: localDay(yesterday) });
    expect(facade.form.controls.habitId.value).toBe('pill');
    expect(facade.form.controls.dayMode.value).toBe('yesterday');
  });

  it('should send one entry for the chosen habit, even when submitted twice', () => {
    facade.init({});
    facade.submit().subscribe();
    facade.submit().subscribe();
    expect(saves().length).toBe(1);
    expect(saves()[0]!.payload).toEqual(jasmine.objectContaining({ habitId: 'read', value: 2, notes: null }));
  });

  it('should refresh entries after a successful save', () => {
    facade.init({});
    facade.submit().subscribe();
    saveResult.next();
    saveResult.complete();
    expect(store.dispatch).toHaveBeenCalledWith(jasmine.any(HabitEntryGetHabitEntries));
    expect(facade.$isSubmitting()).toBeFalse();
  });

  it('should reset the amount when switching to another measurable habit', () => {
    habits.set([habit(), habit({ id: 'run', name: 'Run', target: { value: 5, unit: 'km' } })]);
    facade.init({});
    facade.form.controls.habitId.setValue('run');
    expect(facade.form.controls.value.value).toBe(5);
  });

  describe('editing', () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(13, 10, 0, 0);
    const existing: HabitEntryModel = {
      id: 42, habitId: 'read', habitName: 'Read a book', habitType: habitTypes.measurable, value: 3, notes: 'Chapter 7',
      source: habitEntrySources.manual, externalId: null, completedAtUtc: yesterday.toISOString(), isArchived: false,
      createdAtUtc: yesterday, updatedAtUtc: yesterday,
    };

    it('should fill the form from the entry', () => {
      facade.init({ entry: existing });
      expect(facade.$isEditing()).toBeTrue();
      expect(facade.form.controls.habitId.value).toBe('read');
      expect(facade.form.controls.dayMode.value).toBe('yesterday');
      expect(facade.form.controls.value.value).toBe(3);
      expect(facade.form.controls.notes.value).toBe('Chapter 7');
      expect(facade.form.controls.time.value.getHours()).toBe(13);
      expect(facade.form.controls.time.value.getMinutes()).toBe(10);
    });

    it('should update the entry instead of creating one', () => {
      facade.init({ entry: existing });
      facade.form.controls.value.setValue(4);
      facade.submit().subscribe();
      const update = store.dispatch.calls.allArgs().map(([a]) => a).find((a) => a instanceof HabitEntryUpdateHabitEntry) as HabitEntryUpdateHabitEntry;
      expect(saves().length).toBe(0);
      expect(update.id).toBe(42);
      expect(update.payload).toEqual({ value: 4, notes: 'Chapter 7', completedAt: yesterday.toISOString() });
    });

    it('should not offer other habits or the new-entry summary', () => {
      facade.init({ entry: existing });
      expect(facade.$options().map((o) => o.id)).toEqual(['read']);
      expect(facade.$summary()).toBeNull();
    });
  });
});
