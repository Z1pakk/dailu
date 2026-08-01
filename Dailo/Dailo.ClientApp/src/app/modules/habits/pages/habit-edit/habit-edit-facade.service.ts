import { computed, inject, Injectable, resource, Signal } from '@angular/core';
import { NonNullableFormBuilder } from '@angular/forms';
import { MessageService } from 'primeng/api';
import {
  HabitEditForm,
  HabitEditFormGroup,
  HabitEditFormValue,
} from '@habits/pages/habit-edit/type/habit-edit-form.type';
import {
  HabitNameSchema,
  HabitDescriptionSchema,
  HabitTypeSchema,
  HabitFrequencyTypeSchema,
  HabitFrequencyTimesPerPeriodSchema,
  HabitTargetValueSchema,
  HabitTargetUnitSchema,
  HabitMilestoneTargetSchema,
  HabitEndDateSchema,
  HabitTagIdsSchema,
  HabitAutomationSourceSchema,
  HabitGithubRepositoryIdSchema,
  HabitGithubRepositoryNameSchema,
  HabitGithubEventTypesSchema,
  HabitStravaActivityTypesSchema,
  HabitGoogleHealthMetricsSchema,
} from '@habits/schemas/habit.schemas';
import { AutomationSource, automationSources } from '@habits/enums/automation-source.enum';
import { GithubEventType } from '@habits/enums/github-event-type.enum';
import { StravaActivityType } from '@habits/enums/strava-activity-type.enum';
import { GoogleHealthMetric } from '@habits/enums/google-health-metric.enum';
import { HabitEditModalData } from '@habits/pages/habit-edit/type/habit-edit-modal.type';
import { valibotValidator } from '@shared/lib/form/valibot.validator';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  catchError,
  EMPTY,
  firstValueFrom,
  map,
  Observable,
  startWith,
  tap,
} from 'rxjs';
import { HabitType } from '@habits/enums/habit-type.enum';
import { FrequencyType } from '@habits/enums/frequency-type.enum';
import { Store } from '@ngxs/store';
import { HabitFetchHabits, HabitUpdateHabit } from '@habits/state/habit.action';
import { HttpErrorResponse } from '@angular/common/http';
import { applyServerErrors } from '@shared/lib/form/apply-server-errors';
import { UpdateHabitRequestModel } from '@habits/models/requests/update-habit.request';
import { AutomationFilterModel } from '@habits/models/automation-filter.model';
import { HabitModel } from '@habits/models/habit.model';
import { DynamicDialogConfig } from 'primeng/dynamicdialog';
import { TagStateSelectors } from '@tags/state/tag.selector';
import { SelectItem } from '@shared/lib/select-item/select-item.type';
import { toLocalDateString } from '@shared/lib/date/to-local-date-string';
import { UserProfileApi } from '@user-profile/api/user-profile.api';

@Injectable()
export class HabitEditFacadeService {
  private readonly _fb = inject(NonNullableFormBuilder);
  private readonly _store = inject(Store);
  private readonly _messageService = inject(MessageService);
  private readonly _userProfileApi = inject(UserProfileApi);
  private readonly _config = inject<DynamicDialogConfig<HabitEditModalData>>(
    DynamicDialogConfig<HabitEditModalData>,
  );

  private get _habit(): HabitModel {
    return this._config.data!.habit;
  }

  private readonly _$tags = this._store.selectSignal(
    TagStateSelectors.getSlices.tags,
  );

  public readonly $tagSelectItems: Signal<SelectItem[]> = computed(() =>
    this._$tags().map((tag) => ({ label: tag.name, value: tag.id })),
  );

  public readonly editHabitForm: HabitEditFormGroup =
    this._fb.group<HabitEditForm>({
      name: this._fb.control<string>(
        this._habit.name,
        valibotValidator(HabitNameSchema),
      ),
      description: this._fb.control<string>(
        this._habit.description ?? '',
        valibotValidator(HabitDescriptionSchema),
      ),
      type: this._fb.control<HabitType>(
        this._habit.type,
        valibotValidator(HabitTypeSchema),
      ),
      frequencyType: this._fb.control<FrequencyType>(
        this._habit.frequency.type,
        valibotValidator(HabitFrequencyTypeSchema),
      ),
      frequencyTimesPerPeriod: this._fb.control<number>(
        this._habit.frequency.timesPerPeriod,
        valibotValidator(HabitFrequencyTimesPerPeriodSchema),
      ),
      targetValue: this._fb.control<number>(
        this._habit.target.value,
        valibotValidator(HabitTargetValueSchema),
      ),
      targetUnit: this._fb.control<string>(
        this._habit.target.unit,
        valibotValidator(HabitTargetUnitSchema),
      ),
      endDate: this._fb.control<Date | null>(
        this._habit.endDate ? new Date(this._habit.endDate) : null,
        valibotValidator(HabitEndDateSchema),
      ),
      milestoneTarget: this._fb.control<number | null>(
        this._habit.milestone?.target ?? null,
        valibotValidator(HabitMilestoneTargetSchema),
      ),
      tagIds: this._fb.control<string[]>(
        this._habit.tags.map((t) => t.id),
        valibotValidator(HabitTagIdsSchema),
      ),
      automationSource: this._fb.control<AutomationSource | null>(
        this._habit.automationSource ?? null,
        valibotValidator(HabitAutomationSourceSchema),
      ),
      githubRepositoryId: this._fb.control<number | null>(
        this._habit.automationFilter?.type === 'github'
          ? this._habit.automationFilter.repositoryId
          : null,
        valibotValidator(HabitGithubRepositoryIdSchema),
      ),
      githubRepositoryName: this._fb.control<string | null>(
        this._habit.automationFilter?.type === 'github'
          ? this._habit.automationFilter.repositoryName
          : null,
        valibotValidator(HabitGithubRepositoryNameSchema),
      ),
      githubEventTypes: this._fb.control<GithubEventType[]>(
        this._habit.automationFilter?.type === 'github'
          ? this._habit.automationFilter.eventTypes
          : [],
        valibotValidator(HabitGithubEventTypesSchema),
      ),
      stravaActivityTypes: this._fb.control<StravaActivityType[]>(
        this._habit.automationFilter?.type === 'strava'
          ? this._habit.automationFilter.activityTypes
          : [],
        valibotValidator(HabitStravaActivityTypesSchema),
      ),
      googleHealthMetrics: this._fb.control<GoogleHealthMetric[]>(
        this._habit.automationFilter?.type === 'google-health'
          ? this._habit.automationFilter.metrics
          : [],
        valibotValidator(HabitGoogleHealthMetricsSchema),
      ),
    });

  private readonly _$automationSource = toSignal(
    this.editHabitForm.controls.automationSource.valueChanges,
    { initialValue: this.editHabitForm.controls.automationSource.value },
  );

  private readonly _githubReposResource = resource({
    params: () =>
      this._$automationSource() === automationSources.github ? {} : undefined,
    loader: () => firstValueFrom(this._userProfileApi.getGithubRepos()),
  });

  public readonly $githubRepoSelectItems: Signal<SelectItem<number>[]> =
    computed(() =>
      (this._githubReposResource.value()?.repositories ?? []).map((r) => ({
        label: r.fullName,
        value: r.id,
      })),
    );

  public readonly $githubReposLoading: Signal<boolean> =
    this._githubReposResource.isLoading;

  public readonly $isFormValid: Signal<boolean> = toSignal(
    this.editHabitForm.statusChanges.pipe(
      startWith(this.editHabitForm.status),
      map((status) => status === 'VALID'),
    ),
    { initialValue: false },
  );

  public updateHabit(): Observable<void> {
    const formValue: HabitEditFormValue = this.editHabitForm.getRawValue();
    const habit = this._habit;

    const {
      name,
      description,
      type,
      frequencyType,
      frequencyTimesPerPeriod,
      targetValue,
      targetUnit,
      endDate,
      milestoneTarget,
      tagIds,
      automationSource,
      githubRepositoryId,
      githubRepositoryName,
      githubEventTypes,
      stravaActivityTypes,
      googleHealthMetrics,
    } = formValue;

    const automationFilter: AutomationFilterModel | null = (() => {
      if (
        automationSource === automationSources.github &&
        githubRepositoryId !== null &&
        githubRepositoryName !== null
      ) {
        return {
          type: 'github',
          repositoryId: githubRepositoryId,
          repositoryName: githubRepositoryName,
          eventTypes: githubEventTypes,
        };
      }
      if (automationSource === automationSources.strava) {
        return { type: 'strava', activityTypes: stravaActivityTypes };
      }
      if (automationSource === automationSources.googleHealth) {
        return { type: 'google-health', metrics: googleHealthMetrics };
      }
      return null;
    })();

    const request = (<UpdateHabitRequestModel>{
      name,
      description: description || null,
      type,
      frequency: {
        type: frequencyType,
        timesPerPeriod: frequencyTimesPerPeriod,
      },
      target: { value: targetValue, unit: targetUnit },
      endDate: endDate ? toLocalDateString(endDate) : null,
      milestone:
        milestoneTarget !== null
          ? { target: milestoneTarget, current: habit.milestone?.current ?? 0 }
          : null,
      tagIds,
      automationSource,
      automationFilter,
    }) satisfies UpdateHabitRequestModel;

    return this._store.dispatch(new HabitUpdateHabit(habit.id, request)).pipe(
      tap({
        next: () => {
          this._store.dispatch(new HabitFetchHabits());
          this._messageService.add({
            severity: 'success',
            summary: 'Success',
            detail: 'Habit updated successfully.',
            life: 3000,
          });
        },
      }),
      catchError((error: HttpErrorResponse) => {
        applyServerErrors(this.editHabitForm, error);
        return EMPTY;
      }),
    );
  }
}
