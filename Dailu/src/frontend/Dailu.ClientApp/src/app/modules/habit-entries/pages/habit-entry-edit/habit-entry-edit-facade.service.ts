import { inject, Injectable, Signal } from '@angular/core';
import { parseISO, startOfDay, getHours, getMinutes, getSeconds } from 'date-fns';
import { NonNullableFormBuilder } from '@angular/forms';
import { MessageService } from 'primeng/api';
import {
  HabitEntryEditForm,
  HabitEntryEditFormGroup,
  HabitEntryEditFormValue,
} from '@habit-entries/pages/habit-entry-edit/type/habit-entry-edit-form.type';
import { valibotValidator } from '@shared/lib/form/valibot.validator';
import { toSignal } from '@angular/core/rxjs-interop';
import { catchError, EMPTY, map, Observable, startWith, tap } from 'rxjs';
import { Store } from '@ngxs/store';
import {
  HabitEntryGetHabitEntries,
  HabitEntryUpdateHabitEntry,
} from '@habit-entries/state/habit-entry.action';
import { HttpErrorResponse } from '@angular/common/http';
import { applyServerErrors } from '@shared/lib/form/apply-server-errors';
import { UpdateHabitEntryRequestModel } from '@habit-entries/models/requests/update-habit-entry.request';
import { HabitEntryModel } from '@habit-entries/models/habit-entry.model';
import {
  HabitEntryCompletedAtSchema,
  HabitEntryNotesSchema,
  HabitEntryValueSchema,
} from '@habit-entries/schemas/habit-entry.schemas';

@Injectable()
export class HabitEntryEditFacadeService {
  private readonly _fb = inject(NonNullableFormBuilder);
  private readonly _store = inject(Store);
  private readonly _messageService = inject(MessageService);

  public readonly editHabitEntryForm: HabitEntryEditFormGroup =
    this._fb.group<HabitEntryEditForm>({
      value: this._fb.control<number>(1, valibotValidator(HabitEntryValueSchema)),
      notes: this._fb.control<string>('', valibotValidator(HabitEntryNotesSchema)),
      completedAt: this._fb.control<Date>(new Date(), valibotValidator(HabitEntryCompletedAtSchema)),
      includeTime: this._fb.control<boolean>(false),
    });

  public readonly $isFormValid: Signal<boolean> = toSignal(
    this.editHabitEntryForm.statusChanges.pipe(
      startWith(this.editHabitEntryForm.status),
      map((status) => status === 'VALID'),
    ),
    { initialValue: false },
  );

  public initForm(entry: HabitEntryModel): void {
    const completedAt = parseISO(entry.completedAtUtc);
    const hasTime =
      getHours(completedAt) !== 0 ||
      getMinutes(completedAt) !== 0 ||
      getSeconds(completedAt) !== 0;

    this.editHabitEntryForm.setValue({
      value: entry.value,
      notes: entry.notes ?? '',
      completedAt,
      includeTime: hasTime,
    });
  }

  public updateHabitEntry(entryId: number): Observable<void> {
    const formValue: HabitEntryEditFormValue = this.editHabitEntryForm.getRawValue();

    const { notes, includeTime } = formValue;

    const completedAt = includeTime
      ? formValue.completedAt
      : startOfDay(formValue.completedAt);

    const request = (<UpdateHabitEntryRequestModel>{
      value: formValue.value,
      notes: notes || null,
      completedAt: completedAt.toISOString(),
    }) satisfies UpdateHabitEntryRequestModel;

    return this._store.dispatch(new HabitEntryUpdateHabitEntry(entryId, request)).pipe(
      tap({
        next: () => {
          this._store.dispatch(new HabitEntryGetHabitEntries());
          this._messageService.add({
            severity: 'success',
            summary: 'Success',
            detail: 'Entry updated successfully.',
            life: 3000,
          });
        },
      }),
      catchError((error: HttpErrorResponse) => {
        applyServerErrors(this.editHabitEntryForm, error);
        return EMPTY;
      }),
    );
  }
}
