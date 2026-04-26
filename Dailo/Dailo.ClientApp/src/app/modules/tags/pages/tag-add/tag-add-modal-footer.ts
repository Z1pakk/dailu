import {
  ChangeDetectionStrategy,
  Component,
  inject,
  Signal,
} from '@angular/core';
import { Button } from 'primeng/button';
import { DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';

@Component({
  selector: 'app-tag-add-modal-footer',
  imports: [Button],
  template: ` <div class="flex gap-2">
    <p-button
      severity="primary"
      label="Add"
      [disabled]="!$isFormValid()"
      (click)="addNewTag()"
    ></p-button>
    <p-button severity="secondary" label="Cancel" (click)="close()"></p-button>
  </div>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TagAddModalFooter {
  private readonly _dialogRef = inject(DynamicDialogRef);
  private readonly _config = inject(DynamicDialogConfig);

  protected readonly $isFormValid: Signal<boolean> =
    this._config.data.$isFormValid;

  protected addNewTag() {
    this._config.data.submit().subscribe({
      next: () => this._dialogRef.close(true),
    });
  }

  protected close() {
    this._dialogRef.close();
  }
}
