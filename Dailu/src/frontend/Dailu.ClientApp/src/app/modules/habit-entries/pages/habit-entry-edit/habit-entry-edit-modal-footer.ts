import {
  ChangeDetectionStrategy,
  Component,
  inject,
  Signal,
} from '@angular/core';
import { Button } from 'primeng/button';
import { DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';
import { HabitEntryEditModalData } from '@habit-entries/pages/habit-entry-edit/type/habit-entry-edit-modal.type';
import { HabitEntryEdit } from './habit-entry-edit';

@Component({
  selector: 'app-habit-entry-edit-modal-footer',
  imports: [Button],
  template: `<div class="flex gap-2">
    <p-button
      severity="primary"
      label="Save"
      [disabled]="!$isFormValid()"
      (click)="saveHabitEntry()"
    ></p-button>
    <p-button severity="secondary" label="Cancel" (click)="close()"></p-button>
  </div>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HabitEntryEditModalFooter {
  private readonly _dialogRef = inject(DynamicDialogRef<HabitEntryEdit>);
  private readonly _config = inject<DynamicDialogConfig<HabitEntryEditModalData>>(
    DynamicDialogConfig<HabitEntryEditModalData>,
  );

  private get _data(): HabitEntryEditModalData {
    return this._config.data!;
  }

  protected readonly $isFormValid: Signal<boolean> = this._data.$isFormValid;

  protected saveHabitEntry() {
    if (this._data.submit) {
      this._data.submit().subscribe({
        next: () => this._dialogRef.close(true),
      });
    }
  }

  protected close() {
    this._dialogRef.close();
  }
}
