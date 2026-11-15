import { computed, inject, Injectable, resource, signal, Signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { AbstractControl, FormControl, NonNullableFormBuilder, ValidationErrors } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Store } from '@ngxs/store';
import { MessageService } from 'primeng/api';
import * as v from 'valibot';
import { catchError, EMPTY, finalize, firstValueFrom, map, Observable, startWith, tap } from 'rxjs';
import { HabitModel } from '@habits/models/habit.model';
import { HabitCreateHabit, HabitFetchHabits, HabitUpdateHabit } from '@habits/state/habit.action';
import { AutomationSource, automationSources } from '@habits/enums/automation-source.enum';
import { FrequencyType, frequencyTypes } from '@habits/enums/frequency-type.enum';
import { DayOfWeek } from '@habits/enums/day-of-week.enum';
import { FrequencyModel } from '@habits/models/frequency.model';
import { TimingModel } from '@habits/models/timing.model';
import {
  habitTimesPerPeriodSchema,
  HabitDescriptionSchema,
  HabitDurationSchema,
  HabitEndDateSchema,
  HabitMilestoneTargetSchema,
  HabitNameSchema,
  HabitTargetUnitSchema,
  HabitTargetValueOptionalSchema,
} from '@habits/schemas/habit.schemas';
import {
  autoCheckSummary,
  drawerValueFromHabit,
  emptyDrawerValue,
  frequencyOf,
  HabitDrawerValue,
  TimeMode,
  timingOf,
  toHabitRequest,
} from '@habits/lib/habit-form-mapping';
import {
  clockSpan,
  daysHint,
  hasFixedDays,
  isScheduledOn,
  maxTimesPerPeriod,
  timeHint,
} from '@habits/lib/habit-schedule';
import { shortMonthWarning } from '@habits/lib/month-days';
import { HabitStateSelectors } from '@habits/state/habit.selector';
import { localDay } from '@shared/lib/date/local-day';
import { formatTimeOfDay } from '@shared/lib/date/time-of-day';
import { HabitDrawerFormGroup } from '@habits/ui/habit-drawer/habit-drawer-form.type';
import { TagStateSelectors } from '@tags/state/tag.selector';
import { IntegrationStateSelectors } from '@integrations/state/integration.selector';
import { IntegrationApi } from '@integrations/api/integration.api';
import { IntegrationProviderType } from '@integrations/models/integration-summary.model';
import { SelectItem } from '@shared/lib/select-item/select-item.type';
import { valibotCrossFieldValidator, valibotValidator } from '@shared/lib/form/valibot.validator';
import { applyServerErrors } from '@shared/lib/form/apply-server-errors';

/** A segment on the drawer's 06:00 → 24:00 strip, as 0..1 shares of its width. */
export interface ClockStripSegment {
  left: number;
  width: number;
}

export interface ClockPreview {
  title: string;
  meta: string;
  /** Other timed habits scheduled today. */
  busy: ClockStripSegment[];
  /** The habit being edited, when it has a time. */
  own: ClockStripSegment | null;
}

const STRIP_START = 6 * 60;
const STRIP_LENGTH = 18 * 60;
const MINUTES_PER_DAY = 24 * 60;
const PERIOD_NAMES: Partial<Record<FrequencyType, string>> = {
  [frequencyTypes.weekly]: 'week',
  [frequencyTypes.monthly]: 'month',
};

function stripSegment(span: { start: number; end: number }): ClockStripSegment | null {
  const toShare = (minutes: number) => Math.min(1, Math.max(0, (minutes - STRIP_START) / STRIP_LENGTH));
  const left = toShare(span.start);
  const width = toShare(span.end) - left;
  return width > 0 ? { left, width } : null;
}

/** "At a time" needs a start time, and the habit must end by midnight (the domain rule). */
function atValidator(control: AbstractControl): ValidationErrors | null {
  const parent = control.parent;
  if (!parent || parent.get('timeMode')?.value !== 'at') {
    return null;
  }
  const at = control.value as Date | null;
  if (!at) {
    return { issue: 'Start time is required' };
  }
  const duration = parent.get('durationMinutes')?.value as number | null;
  if (duration !== null && at.getHours() * 60 + at.getMinutes() + duration > MINUTES_PER_DAY) {
    return { issue: 'Ends after midnight · pick an earlier time or a shorter duration' };
  }
  return null;
}

const PROVIDER_SOURCES: Record<IntegrationProviderType, AutomationSource> = {
  github: automationSources.github,
  strava: automationSources.strava,
  'google-health': automationSources.googleHealth,
};

/** Form state and saving for the New / Edit habit drawer. Provided per drawer instance. */
@Injectable()
export class HabitDrawerFacadeService {
  private readonly _fb = inject(NonNullableFormBuilder);
  private readonly _store = inject(Store);
  private readonly _messageService = inject(MessageService);
  private readonly _integrationApi = inject(IntegrationApi);

  private _existing: HabitModel | null = null;
  private readonly _$existingId = signal<string | null>(null);
  private readonly _$isSubmitting = signal(false);

  public readonly form: HabitDrawerFormGroup = this._buildForm(emptyDrawerValue());

  public readonly $isSubmitting: Signal<boolean> = this._$isSubmitting.asReadonly();

  public readonly $isFormValid: Signal<boolean> = toSignal(
    this.form.statusChanges.pipe(
      startWith(this.form.status),
      map((status) => status === 'VALID'),
    ),
    { initialValue: false },
  );

  private readonly _$value = toSignal(this.form.valueChanges.pipe(map(() => this.form.getRawValue())), {
    initialValue: this.form.getRawValue(),
  });

  public readonly $summary: Signal<string | null> = computed(() => autoCheckSummary(this._$value()));

  public readonly $automationSource: Signal<AutomationSource> = computed(() => this._$value().automationSource);

  // ---- Schedule (section 2) --------------------------------------------------
  public readonly $frequencyType: Signal<FrequencyType> = computed(() => this._$value().frequencyType);
  public readonly $weekDays: Signal<readonly DayOfWeek[]> = computed(() => this._$value().weekDays);
  public readonly $monthDays: Signal<readonly number[]> = computed(() => this._$value().monthDays);
  public readonly $timeMode: Signal<TimeMode> = computed(() => this._$value().timeMode);
  /** The schedule as it would be saved. */
  public readonly $frequency: Signal<FrequencyModel> = computed(() => frequencyOf(this._$value()));
  public readonly $timing: Signal<TimingModel> = computed(() => timingOf(this._$value(), this.$frequency()));
  public readonly $hasFixedDays: Signal<boolean> = computed(() => hasFixedDays(this.$frequency()));
  public readonly $maxTimes: Signal<number> = computed(() => maxTimesPerPeriod(this.$frequencyType()));
  /** "week" or "month" for the times stepper. */
  public readonly $periodName: Signal<string> = computed(() => PERIOD_NAMES[this.$frequencyType()] ?? 'period');
  public readonly $daysHint: Signal<string> = computed(() => daysHint(this.$frequency()));
  public readonly $timeHint: Signal<string> = computed(() => timeHint(this.$frequency(), this.$timing()));
  public readonly $shortMonthWarning: Signal<string | null> = computed(() =>
    this.$frequencyType() === frequencyTypes.monthly ? shortMonthWarning(this._$value().monthDays) : null,
  );

  private readonly _$habits = this._store.selectSignal(HabitStateSelectors.getSlices.habits);

  /** The strip at the top: other timed habits today, and this one when it has a time. */
  public readonly $clockPreview: Signal<ClockPreview> = computed(() => {
    const today = localDay(new Date());
    const busy = this._$habits()
      .filter((h) => h.id !== this._$existingId() && isScheduledOn(h, today))
      .map((h) => clockSpan(h.timing))
      .map((span) => (span ? stripSegment(span) : null))
      .filter((segment): segment is ClockStripSegment => segment !== null);
    const span = clockSpan(this.$timing());
    if (!span) {
      return { title: 'Any time today', meta: 'due by 24:00 · not on your clock', busy, own: null };
    }
    return {
      title: 'On your clock',
      meta: `${formatTimeOfDay(span.start)}–${formatTimeOfDay(span.end)}`,
      busy,
      own: stripSegment(span),
    };
  });

  private readonly _$summaries = this._store.selectSignal(IntegrationStateSelectors.getSlices.summaries);

  public readonly $connectedSources: Signal<ReadonlySet<AutomationSource>> = computed(
    () => new Set((this._$summaries() ?? []).map((s) => PROVIDER_SOURCES[s.type])),
  );

  private readonly _$tags = this._store.selectSignal(TagStateSelectors.getSlices.tags);

  public readonly $tagSelectItems: Signal<SelectItem[]> = computed(() =>
    this._$tags().map((tag) => ({ label: tag.name, value: tag.id })),
  );

  private readonly _githubReposResource = resource({
    params: () =>
      this.$automationSource() === automationSources.github &&
      this.$connectedSources().has(automationSources.github)
        ? {}
        : undefined,
    loader: () => firstValueFrom(this._integrationApi.getGithubRepos()),
  });

  /** The connected account's repositories, or just the stored one when GitHub was disconnected. */
  public readonly $githubRepoSelectItems: Signal<SelectItem<number>[]> = computed(() => {
    // value() throws while the resource is in an error state (e.g. an expired GitHub token).
    const repos = this._githubReposResource.hasValue()
      ? this._githubReposResource.value().repositories
      : undefined;
    if (repos) {
      return repos.map((r) => ({ label: r.fullName, value: r.id }));
    }
    const { githubRepositoryId, githubRepositoryName } = this._$value();
    return githubRepositoryId !== null && githubRepositoryName !== null
      ? [{ label: githubRepositoryName, value: githubRepositoryId }]
      : [];
  });

  public readonly $githubReposLoading: Signal<boolean> = this._githubReposResource.isLoading;

  public get existingHabit(): HabitModel | null {
    return this._existing;
  }

  public init(habit: HabitModel | null): void {
    this._existing = habit;
    this._$existingId.set(habit?.id ?? null);
    this.form.reset(habit ? drawerValueFromHabit(habit) : emptyDrawerValue());
    if (habit) {
      // A stored value that no longer validates (e.g. an end date in the past) must say why Save is off.
      this._markInvalidAsTouched();
    }
  }

  public submit(): Observable<void> {
    if (this._$isSubmitting()) {
      return EMPTY;
    }
    this._$isSubmitting.set(true);

    const existing = this._existing;
    const request = toHabitRequest(this.form.getRawValue(), existing);
    const action = existing ? new HabitUpdateHabit(existing.id, request) : new HabitCreateHabit(request);

    return this._store.dispatch(action).pipe(
      tap(() => {
        this._store.dispatch(new HabitFetchHabits());
        this._messageService.add({
          severity: 'success',
          summary: 'Success',
          detail: existing ? 'Habit updated successfully.' : 'Habit created successfully.',
          life: 3000,
        });
      }),
      catchError((error: HttpErrorResponse) => {
        applyServerErrors(this.form, error);
        return EMPTY;
      }),
      finalize(() => this._$isSubmitting.set(false)),
    );
  }

  public toggleWeekDay(day: DayOfWeek): void {
    const days = this.form.controls.weekDays.value;
    this._setDays(this.form.controls.weekDays, days.includes(day) ? days.filter((d) => d !== day) : [...days, day]);
  }

  public toggleMonthDay(day: number): void {
    const days = this.form.controls.monthDays.value;
    this._setDays(this.form.controls.monthDays, days.includes(day) ? days.filter((d) => d !== day) : [...days, day]);
  }

  /**
   * Switches the period: clears the other period's days, keeps the count within the new limit
   * (31 → 7 going to Weekly, 1 for Daily) and drops the time if nothing fixed is left.
   */
  public setFrequencyType(type: FrequencyType): void {
    this.form.controls.frequencyType.setValue(type);
  }

  private _setDays<T extends number>(control: FormControl<T[]>, days: T[]): void {
    const wasEmpty = control.value.length === 0;
    control.setValue(days);
    control.markAsDirty();
    if (wasEmpty && days.length > 0) {
      // Picked days say how often; the count only applies without them.
      this.form.controls.timesPerPeriod.setValue(1);
    }
    this._dropTimeWithoutFixedDays();
  }

  private _applyFrequencyType(): void {
    const { frequencyType, weekDays, monthDays, timesPerPeriod } = this.form.controls;
    const type = frequencyType.value;
    if (type !== frequencyTypes.weekly && weekDays.value.length > 0) {
      weekDays.setValue([]);
    }
    if (type !== frequencyTypes.monthly && monthDays.value.length > 0) {
      monthDays.setValue([]);
    }
    const times = Math.min(Math.max(1, timesPerPeriod.value ?? 1), maxTimesPerPeriod(type));
    if (times !== timesPerPeriod.value) {
      timesPerPeriod.setValue(times);
    }
    timesPerPeriod.updateValueAndValidity();
    this._dropTimeWithoutFixedDays();
  }

  /** A time only makes sense on known days: without them, fall back to "Any time". */
  private _dropTimeWithoutFixedDays(): void {
    if (hasFixedDays(frequencyOf(this.form.getRawValue()))) {
      return;
    }
    const { timeMode, at } = this.form.controls;
    if (timeMode.value !== 'any') {
      timeMode.setValue('any');
    }
    if (at.value !== null) {
      at.setValue(null);
    }
  }

  private _markInvalidAsTouched(): void {
    for (const control of Object.values(this.form.controls)) {
      if (control.invalid) {
        control.markAsTouched();
      }
    }
  }

  private _buildForm(value: HabitDrawerValue): HabitDrawerFormGroup {
    const fb = this._fb;
    const form = fb.group({
      name: fb.control(value.name, valibotValidator(HabitNameSchema)),
      description: fb.control(value.description, valibotValidator(HabitDescriptionSchema)),
      frequencyType: fb.control(value.frequencyType),
      weekDays: fb.control(value.weekDays),
      monthDays: fb.control(value.monthDays),
      // The stepper's limit depends on the period; Daily has no count.
      timesPerPeriod: fb.control(
        value.timesPerPeriod,
        valibotCrossFieldValidator('frequencyType', (type) => {
          const frequencyType = type as FrequencyType;
          return frequencyType === frequencyTypes.daily
            ? v.unknown()
            : habitTimesPerPeriodSchema(maxTimesPerPeriod(frequencyType), PERIOD_NAMES[frequencyType] ?? 'period');
        }),
      ),
      timeMode: fb.control(value.timeMode),
      at: fb.control(value.at, atValidator),
      durationMinutes: fb.control(value.durationMinutes, valibotValidator(HabitDurationSchema)),
      targetValue: fb.control(value.targetValue, valibotValidator(HabitTargetValueOptionalSchema)),
      // The unit only matters once "At least" has an amount.
      targetUnit: fb.control(
        value.targetUnit,
        valibotCrossFieldValidator('targetValue', (amount) =>
          amount == null ? v.string() : HabitTargetUnitSchema,
        ),
      ),
      endDate: fb.control(value.endDate, valibotValidator(HabitEndDateSchema)),
      milestoneTarget: fb.control(value.milestoneTarget, valibotValidator(HabitMilestoneTargetSchema)),
      tagIds: fb.control(value.tagIds),
      automationSource: fb.control(value.automationSource),
      // GitHub habits need a repository; other sources don't.
      githubRepositoryId: fb.control(
        value.githubRepositoryId,
        valibotCrossFieldValidator('automationSource', (source) =>
          source === automationSources.github ? v.number('Repository is required') : v.nullable(v.number()),
        ),
      ),
      githubRepositoryName: fb.control(value.githubRepositoryName),
      githubEventTypes: fb.control(value.githubEventTypes),
      stravaActivityTypes: fb.control(value.stravaActivityTypes),
      googleHealthMetrics: fb.control(value.googleHealthMetrics),
    });

    form.controls.targetValue.valueChanges.subscribe(() => {
      form.controls.targetUnit.updateValueAndValidity();
      if (form.controls.targetUnit.invalid) {
        form.controls.targetUnit.markAsTouched();
      }
    });
    form.controls.frequencyType.valueChanges.subscribe(() => this._applyFrequencyType());
    // The start time's checks depend on the mode and the duration.
    form.controls.timeMode.valueChanges.subscribe(() => form.controls.at.updateValueAndValidity());
    form.controls.durationMinutes.valueChanges.subscribe(() => {
      form.controls.at.updateValueAndValidity();
      if (form.controls.at.invalid) {
        form.controls.at.markAsTouched();
      }
    });
    form.controls.automationSource.valueChanges.subscribe(() =>
      form.controls.githubRepositoryId.updateValueAndValidity(),
    );
    return form;
  }
}
