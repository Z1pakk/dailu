import { computed, inject, Injectable, Signal } from '@angular/core';
import { habitTypes } from '@habits/enums/habit-type.enum';
import { NonNullableFormBuilder } from '@angular/forms';
import { MessageService } from 'primeng/api';
import {
  HabitEntryAddForm,
  HabitEntryAddFormGroup,
  HabitEntryAddFormValue,
} from '@habit-entries/pages/habit-entry-add/type/habit-entry-add-form.type';
import { valibotValidator } from '@shared/lib/form/valibot.validator';
import { toSignal } from '@angular/core/rxjs-interop';
import { catchError, EMPTY, map, Observable, startWith, tap } from 'rxjs';
import { Store } from '@ngxs/store';
import {
  HabitEntryCreateHabitEntry,
  HabitEntryGetHabitEntries,
} from '@habit-entries/state/habit-entry.action';
import { HabitStateSelectors } from '@habits/state/habit.selector';
import { HttpErrorResponse } from '@angular/common/http';
import { applyServerErrors } from '@shared/lib/form/apply-server-errors';
import { CreateHabitEntryRequestModel } from '@habit-entries/models/requests/create-habit-entry.request';
import { SelectItem } from '@shared/lib/select-item/select-item.type';
import {
  HabitEntryCompletedAtSchema,
  HabitEntryHabitIdSchema,
  HabitEntryNotesSchema,
  HabitEntryValueSchema,
} from '@habit-entries/schemas/habit-entry.schemas';

@Injectable()
export class HabitEntryAddFacadeService {
  private readonly _fb = inject(NonNullableFormBuilder);
  private readonly _store = inject(Store);
  private readonly _messageService = inject(MessageService);

  private readonly _$habits = this._store.selectSignal(
    HabitStateSelectors.getSlices.habits,
  );

  public readonly $habitSelectItems: Signal<SelectItem<string>[]> = computed(
    () =>
      this._$habits().map((habit) => ({ label: habit.name, value: habit.id })),
  );

  public readonly addHabitEntryForm: HabitEntryAddFormGroup =
    this._fb.group<HabitEntryAddForm>({
      habitId: this._fb.control<string>(
        '',
        valibotValidator(HabitEntryHabitIdSchema),
      ),
      value: this._fb.control<number>(
        1,
        valibotValidator(HabitEntryValueSchema),
      ),
      notes: this._fb.control<string>(
        '',
        valibotValidator(HabitEntryNotesSchema),
      ),
      completedAt: this._fb.control<Date>(
        new Date(),
        valibotValidator(HabitEntryCompletedAtSchema),
      ),
      includeTime: this._fb.control<boolean>(false),
    });

  private readonly _$selectedHabitId = toSignal(
    this.addHabitEntryForm.controls.habitId.valueChanges.pipe(
      startWith(this.addHabitEntryForm.controls.habitId.value),
    ),
    { initialValue: '' },
  );

  private readonly _$selectedHabit = computed(
    () =>
      this._$habits().find((h) => h.id === this._$selectedHabitId()) ?? null,
  );

  public readonly $isBinaryHabit = computed(
    () => this._$selectedHabit()?.type === habitTypes.binary,
  );

  public readonly $selectedHabitUnit = computed(
    () => this._$selectedHabit()?.target.unit ?? '',
  );

  public readonly $isFormValid: Signal<boolean> = toSignal(
    this.addHabitEntryForm.statusChanges.pipe(
      startWith(this.addHabitEntryForm.status),
      map((status) => status === 'VALID'),
    ),
    { initialValue: false },
  );

  public createHabitEntry(): Observable<void> {
    const formValue: HabitEntryAddFormValue =
      this.addHabitEntryForm.getRawValue();

    const { habitId, notes, includeTime } = formValue;
    const value = this.$isBinaryHabit() ? 1 : formValue.value;

    const completedAt = new Date(formValue.completedAt);
    if (!includeTime) {
      completedAt.setHours(0, 0, 0, 0);
    }

    const request = (<CreateHabitEntryRequestModel>{
      habitId,
      value,
      notes: notes || null,
      completedAt: completedAt.toISOString(),
    }) satisfies CreateHabitEntryRequestModel;

    return this._store.dispatch(new HabitEntryCreateHabitEntry(request)).pipe(
      tap({
        next: () => {
          this._store.dispatch(new HabitEntryGetHabitEntries());
          this._messageService.add({
            severity: 'success',
            summary: 'Success',
            detail: 'Entry created successfully.',
            life: 3000,
          });
        },
      }),
      catchError((error: HttpErrorResponse) => {
        applyServerErrors(this.addHabitEntryForm, error);
        return EMPTY;
      }),
    );
  }
}
