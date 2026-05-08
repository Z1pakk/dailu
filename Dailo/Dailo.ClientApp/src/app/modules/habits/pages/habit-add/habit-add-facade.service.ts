import { computed, inject, Injectable, Signal } from '@angular/core';
import { NonNullableFormBuilder } from '@angular/forms';
import { MessageService } from 'primeng/api';
import * as v from 'valibot';
import {
  HabitAddForm,
  HabitAddFormGroup,
  HabitAddFormValue,
} from '@habits/pages/habit-add/type/habit-add-form.type';
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
} from '@habits/schemas/habit.schemas';
import { valibotValidator } from '@shared/lib/form/valibot.validator';
import { toSignal } from '@angular/core/rxjs-interop';
import { catchError, EMPTY, map, Observable, startWith, tap } from 'rxjs';
import { HabitType, habitTypes } from '@habits/enums/habit-type.enum';
import {
  FrequencyType,
  frequencyTypes,
} from '@habits/enums/frequency-type.enum';
import { Store } from '@ngxs/store';
import { HabitCreateHabit, HabitFetchHabits } from '@habits/state/habit.action';
import { HttpErrorResponse } from '@angular/common/http';
import { applyServerErrors } from '@shared/lib/form/apply-server-errors';
import { CreateHabitRequestModel } from '@habits/models/requests/create-habit.request';
import { TagStateSelectors } from '@tags/state/tag.selector';
import { SelectItem } from '@shared/lib/select-item/select-item.type';
import { toLocalDateString } from '@shared/lib/date/to-local-date-string';

@Injectable()
export class HabitAddFacadeService {
  private readonly _fb = inject(NonNullableFormBuilder);
  private readonly _store = inject(Store);
  private readonly _messageService = inject(MessageService);

  private readonly _$tags = this._store.selectSignal(
    TagStateSelectors.getSlices.tags,
  );

  public readonly $tagSelectItems: Signal<SelectItem[]> = computed(() =>
    this._$tags().map((tag) => ({ label: tag.name, value: tag.id })),
  );

  public readonly addHabitForm: HabitAddFormGroup =
    this._fb.group<HabitAddForm>({
      name: this._fb.control<string>('', valibotValidator(HabitNameSchema)),
      description: this._fb.control<string>(
        '',
        valibotValidator(HabitDescriptionSchema),
      ),
      type: this._fb.control<HabitType>(
        habitTypes.binary,
        valibotValidator(HabitTypeSchema),
      ),
      frequencyType: this._fb.control<FrequencyType>(
        frequencyTypes.daily,
        valibotValidator(HabitFrequencyTypeSchema),
      ),
      frequencyTimesPerPeriod: this._fb.control<number>(
        1,
        valibotValidator(HabitFrequencyTimesPerPeriodSchema),
      ),
      targetValue: this._fb.control<number>(
        1,
        valibotValidator(HabitTargetValueSchema),
      ),
      targetUnit: this._fb.control<string>(
        'Session',
        valibotValidator(HabitTargetUnitSchema),
      ),
      endDate: this._fb.control<Date | null>(
        null,
        valibotValidator(HabitEndDateSchema),
      ),
      milestoneTarget: this._fb.control<number | null>(
        null,
        valibotValidator(v.nullable(HabitMilestoneTargetSchema)),
      ),
      tagIds: this._fb.control<string[]>(
        [],
        valibotValidator(HabitTagIdsSchema),
      ),
    });

  public readonly $isFormValid: Signal<boolean> = toSignal(
    this.addHabitForm.statusChanges.pipe(
      startWith(this.addHabitForm.status),
      map((status) => status === 'VALID'),
    ),
    { initialValue: false },
  );

  public createHabit(): Observable<void> {
    const formValue: HabitAddFormValue = this.addHabitForm.getRawValue();

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
    } = formValue;

    const request = (<CreateHabitRequestModel>{
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
          ? { target: milestoneTarget, current: 0 }
          : null,
      tagIds,
    }) satisfies CreateHabitRequestModel;

    return this._store.dispatch(new HabitCreateHabit(request)).pipe(
      tap({
        next: () => {
          this._store.dispatch(new HabitFetchHabits());
          this._messageService.add({
            severity: 'success',
            summary: 'Success',
            detail: 'Habit created successfully.',
            life: 3000,
          });
        },
      }),
      catchError((error: HttpErrorResponse) => {
        applyServerErrors(this.addHabitForm, error);
        return EMPTY;
      }),
    );
  }
}
