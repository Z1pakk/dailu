import { ChangeDetectionStrategy, Component, inject, Signal } from '@angular/core';
import { Button } from 'primeng/button';
import { DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';
import { HabitEditModalData } from '@habits/pages/habit-edit/type/habit-edit-modal.type';
import { HabitEdit } from './habit-edit';

@Component({
  selector: 'app-habit-edit-modal-footer',
  imports: [Button],
  template: `<div class="flex gap-2">
    <p-button
      severity="primary"
      label="Save"
      [disabled]="!$isFormValid()"
      (click)="saveHabit()"
    ></p-button>
    <p-button severity="secondary" label="Cancel" (click)="close()"></p-button>
  </div>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HabitEditModalFooter {
  private readonly _dialogRef = inject(DynamicDialogRef<HabitEdit>);
  private readonly _config = inject<DynamicDialogConfig<HabitEditModalData>>(
    DynamicDialogConfig<HabitEditModalData>,
  );

  private get _data(): HabitEditModalData {
    return this._config.data!;
  }

  protected readonly $isFormValid: Signal<boolean> = this._data.$isFormValid;

  protected saveHabit() {
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
