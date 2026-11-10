import { computed, inject, Injectable, resource, signal, Signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Store } from '@ngxs/store';
import { MessageService } from 'primeng/api';
import * as v from 'valibot';
import { catchError, EMPTY, finalize, firstValueFrom, map, Observable, startWith, tap } from 'rxjs';
import { HabitModel } from '@habits/models/habit.model';
import { HabitCreateHabit, HabitFetchHabits, HabitUpdateHabit } from '@habits/state/habit.action';
import { AutomationSource, automationSources } from '@habits/enums/automation-source.enum';
import {
  HabitDescriptionSchema,
  HabitEndDateSchema,
  HabitFrequencyTimesPerPeriodSchema,
  HabitMilestoneTargetSchema,
  HabitNameSchema,
  HabitTargetUnitSchema,
  HabitTargetValueOptionalSchema,
} from '@habits/schemas/habit.schemas';
import {
  autoCheckSummary,
  drawerValueFromHabit,
  emptyDrawerValue,
  HabitDrawerValue,
  toHabitRequest,
} from '@habits/lib/habit-form-mapping';
import { HabitDrawerFormGroup } from '@habits/ui/habit-drawer/habit-drawer-form.type';
import { TagStateSelectors } from '@tags/state/tag.selector';
import { UserProfileStateSelectors } from '@user-profile/state/user-profile.selector';
import { UserProfileApi } from '@user-profile/api/user-profile.api';
import { IntegrationProviderType } from '@user-profile/models/integration-summary.model';
import { SelectItem } from '@shared/lib/select-item/select-item.type';
import { valibotCrossFieldValidator, valibotValidator } from '@shared/lib/form/valibot.validator';
import { applyServerErrors } from '@shared/lib/form/apply-server-errors';

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
  private readonly _userProfileApi = inject(UserProfileApi);

  private _existing: HabitModel | null = null;
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

  private readonly _$summaries = this._store.selectSignal(UserProfileStateSelectors.getSlices.integrationSummaries);

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
    loader: () => firstValueFrom(this._userProfileApi.getGithubRepos()),
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
      scheduleMode: fb.control(value.scheduleMode),
      customFrequencyType: fb.control(value.customFrequencyType),
      // Only Custom uses the times field; a hidden, emptied one must not block Save.
      customTimesPerPeriod: fb.control(
        value.customTimesPerPeriod,
        valibotCrossFieldValidator('scheduleMode', (mode) =>
          mode === 'custom' ? HabitFrequencyTimesPerPeriodSchema : v.unknown(),
        ),
      ),
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
    form.controls.scheduleMode.valueChanges.subscribe(() =>
      form.controls.customTimesPerPeriod.updateValueAndValidity(),
    );
    form.controls.automationSource.valueChanges.subscribe(() =>
      form.controls.githubRepositoryId.updateValueAndValidity(),
    );
    return form;
  }
}
