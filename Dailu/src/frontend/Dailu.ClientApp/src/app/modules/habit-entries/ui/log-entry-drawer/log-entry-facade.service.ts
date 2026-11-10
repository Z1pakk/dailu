import { computed, inject, Injectable, signal, Signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Store } from '@ngxs/store';
import { MessageService } from 'primeng/api';
import * as v from 'valibot';
import { addDays } from 'date-fns/addDays';
import { parseISO } from 'date-fns/parseISO';
import { catchError, EMPTY, finalize, map, Observable, startWith, tap } from 'rxjs';
import { HabitStateSelectors } from '@habits/state/habit.selector';
import { habitTypes } from '@habits/enums/habit-type.enum';
import { HabitEntryStateSelectors } from '@habit-entries/state/habit-entry.selector';
import {
  HabitEntryCreateHabitEntry,
  HabitEntryGetHabitEntries,
  HabitEntryUpdateHabitEntry,
} from '@habit-entries/state/habit-entry.action';
import { HabitEntryModel } from '@habit-entries/models/habit-entry.model';
import { HabitEntryNotesSchema, HabitEntryValueSchema } from '@habit-entries/schemas/habit-entry.schemas';
import { DayMode, entryDay, entrySummary, habitOptions, toEntryRequest } from '@habit-entries/lib/log-entry';
import { partialStreak } from '@habits/lib/habit-streaks';
import { anyTimeLane, formatDuration } from '@habits/lib/habit-today';
import { localDay } from '@shared/lib/date/local-day';
import { valibotCrossFieldValidator, valibotValidator } from '@shared/lib/form/valibot.validator';
import { applyServerErrors } from '@shared/lib/form/apply-server-errors';

export interface LogEntryPrefill {
  habitId?: string;
  /** 'yyyy-MM-dd', e.g. a missed day from the Entries feed. */
  day?: string;
  /** Edit this entry instead of logging a new one. */
  entry?: HabitEntryModel;
}

/** Form state and saving for the Log entry drawer. Provided per drawer instance. */
@Injectable()
export class LogEntryFacadeService {
  private readonly _fb = inject(NonNullableFormBuilder);
  private readonly _store = inject(Store);
  private readonly _messageService = inject(MessageService);

  private readonly _$habits = this._store.selectSignal(HabitStateSelectors.getSlices.habits);
  private readonly _$entries = this._store.selectSignal(HabitEntryStateSelectors.getSlices.habitEntries);
  private readonly _now = new Date();
  public readonly today = localDay(this._now);

  public readonly form = this._fb.group({
    habitId: this._fb.control('', valibotValidator(v.pipe(v.string(), v.nonEmpty('Pick a habit')))),
    dayMode: this._fb.control<DayMode>('today'),
    pickedDate: this._fb.control<Date | null>(null),
    time: this._fb.control<Date>(this._now),
    // Only measurable habits have an amount.
    value: this._fb.control<number | null>(
      null,
      valibotCrossFieldValidator('habitId', () => (this._isMeasurable() ? HabitEntryValueSchema : v.unknown())),
    ),
    notes: this._fb.control('', valibotValidator(HabitEntryNotesSchema)),
  });

  private readonly _$value = toSignal(this.form.valueChanges.pipe(map(() => this.form.getRawValue())), {
    initialValue: this.form.getRawValue(),
  });

  private readonly _$editing = signal<HabitEntryModel | null>(null);
  public readonly $isEditing = computed(() => this._$editing() !== null);

  private readonly _$isSubmitting = signal(false);
  public readonly $isSubmitting: Signal<boolean> = this._$isSubmitting.asReadonly();
  public readonly $isFormValid: Signal<boolean> = toSignal(
    this.form.statusChanges.pipe(startWith(this.form.status), map((s) => s === 'VALID')),
    { initialValue: false },
  );

  public readonly $options = computed(() => {
    const options = habitOptions(this._$habits(), this._$entries(), this.today);
    // An entry can't move to another habit (the update request has no habit).
    const editing = this._$editing();
    return editing ? options.filter((o) => o.id === editing.habitId) : options;
  });
  public readonly $habit = computed(() => this._$habits().find((h) => h.id === this._$value().habitId) ?? null);
  public readonly $isMeasurable = computed(() => this.$habit()?.type === habitTypes.measurable);
  public readonly $day = computed(() => entryDay(this._$value().dayMode, this._$value().pickedDate, this.today));

  /** "Today so far": the same counts as the any-time lane. */
  public readonly $today = computed(() => anyTimeLane(this._$habits(), this._$entries(), this._now));
  public readonly $timeLeft = computed(() => formatDuration(this.$today().minutesLeft));

  public readonly $summary = computed(() => {
    const habit = this.$habit();
    if (!habit || this.$isEditing()) {
      return null;
    }
    const entries = this._$entries();
    const alreadyToday = entries.some((e) => !e.isArchived && e.habitId === habit.id && localDay(e.completedAtUtc) === this.today);
    return entrySummary(habit, this.$day(), this.today, partialStreak(entries, this.today).current, alreadyToday);
  });

  constructor() {
    // A new habit brings its own target as the default amount.
    this.form.controls.habitId.valueChanges.subscribe(() => this._resetAmount());
  }

  public init(prefill: LogEntryPrefill): void {
    const entry = prefill.entry ?? null;
    this._$editing.set(entry);
    if (entry) {
      prefill = { habitId: entry.habitId, day: localDay(entry.completedAtUtc) };
    }
    const habitId = prefill.habitId ?? this.$options()[0]?.id ?? '';
    const yesterday = localDay(addDays(parseISO(this.today), -1));
    let dayMode: DayMode = 'today';
    let pickedDate: Date | null = null;
    if (prefill.day === yesterday) {
      dayMode = 'yesterday';
    } else if (prefill.day && prefill.day !== this.today) {
      dayMode = 'pick';
      pickedDate = parseISO(prefill.day);
    }
    this.form.patchValue({ dayMode, pickedDate });
    this.form.controls.habitId.setValue(habitId);
    this._resetAmount();
    if (entry) {
      this.form.patchValue({ time: new Date(entry.completedAtUtc), value: entry.value, notes: entry.notes ?? '' });
    }
  }

  /** Emits once on success; errors stay in the form. */
  public submit(): Observable<void> {
    const habit = this.$habit();
    if (this._$isSubmitting() || !habit) {
      return EMPTY;
    }
    this._$isSubmitting.set(true);
    const request = toEntryRequest(this.form.getRawValue(), habit, this.today);
    const changes = { value: request.value, notes: request.notes, completedAt: request.completedAt };
    const editing = this._$editing();
    const action = editing
      ? new HabitEntryUpdateHabitEntry(editing.id, changes)
      : new HabitEntryCreateHabitEntry({ habitId: habit.id, ...changes });
    return this._store.dispatch(action).pipe(
      tap(() => {
        this._store.dispatch(new HabitEntryGetHabitEntries());
        const detail = editing ? `${habit.name} entry updated.` : `${habit.name} logged.`;
        this._messageService.add({ severity: 'success', summary: editing ? 'Saved' : 'Logged', detail, life: 3000 });
      }),
      catchError((error: HttpErrorResponse) => {
        applyServerErrors(this.form, error);
        return EMPTY;
      }),
      finalize(() => this._$isSubmitting.set(false)),
    );
  }

  private _isMeasurable(): boolean {
    const id = this.form?.controls.habitId.value;
    return this._$habits().find((h) => h.id === id)?.type === habitTypes.measurable;
  }

  private _resetAmount(): void {
    const habit = this._$habits().find((h) => h.id === this.form.controls.habitId.value);
    const amount = habit?.type === habitTypes.measurable ? habit.target.value : null;
    this.form.controls.value.setValue(amount);
  }
}
