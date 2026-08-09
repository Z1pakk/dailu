import {
  ChangeDetectionStrategy,
  Component,
  inject,
  Signal,
} from '@angular/core';
import { Button } from 'primeng/button';
import { DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';
import { HabitAddModalData } from '@habits/pages/habit-add/type/habit-add-modal.type';
import { HabitAdd } from './habit-add';

@Component({
  selector: 'app-habit-add-modal-footer',
  imports: [Button],
  template: ` <div class="flex gap-2">
    <p-button
      severity="primary"
      label="Add"
      [disabled]="!$isFormValid()"
      (click)="addNewHabit()"
    ></p-button>
    <p-button severity="secondary" label="Cancel" (click)="close()"></p-button>
  </div>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HabitAddModalFooter {
  private readonly _dialogRef = inject(DynamicDialogRef<HabitAdd>);
  private readonly _config = inject<DynamicDialogConfig<HabitAddModalData>>(
    DynamicDialogConfig<HabitAddModalData>,
  );

  private get _data(): HabitAddModalData {
    return this._config.data!;
  }

  protected readonly $isFormValid: Signal<boolean> = this._data.$isFormValid;

  protected addNewHabit() {
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
