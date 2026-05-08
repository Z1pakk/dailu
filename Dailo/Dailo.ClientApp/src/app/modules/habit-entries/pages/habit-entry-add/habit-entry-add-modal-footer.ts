import {
  ChangeDetectionStrategy,
  Component,
  inject,
  Signal,
} from '@angular/core';
import { Button } from 'primeng/button';
import { DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';
import { HabitEntryAddModalData } from '@habit-entries/pages/habit-entry-add/type/habit-entry-add-modal.type';
import { HabitEntryAdd } from './habit-entry-add';

@Component({
  selector: 'app-habit-entry-add-modal-footer',
  imports: [Button],
  template: ` <div class="flex gap-2">
    <p-button
      severity="primary"
      label="Add"
      [disabled]="!$isFormValid()"
      (click)="addNewHabitEntry()"
    ></p-button>
    <p-button severity="secondary" label="Cancel" (click)="close()"></p-button>
  </div>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HabitEntryAddModalFooter {
  private readonly _dialogRef = inject(DynamicDialogRef<HabitEntryAdd>);
  private readonly _config = inject<DynamicDialogConfig<HabitEntryAddModalData>>(
    DynamicDialogConfig<HabitEntryAddModalData>,
  );

  private get _data(): HabitEntryAddModalData {
    return this._config.data!;
  }

  protected readonly $isFormValid: Signal<boolean> = this._data.$isFormValid;

  protected addNewHabitEntry() {
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