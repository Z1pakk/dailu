import {
  ChangeDetectionStrategy,
  Component,
  inject,
  Signal,
} from '@angular/core';
import { Button } from 'primeng/button';
import { DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';
import { TagAddModelData } from './type/tag-add-modal.type';
import { TagAdd } from './tag-add';

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
  private readonly _dialogRef = inject(DynamicDialogRef<TagAdd>);
  private readonly _config = inject<DynamicDialogConfig<TagAddModelData>>(
    DynamicDialogConfig<TagAddModelData>,
  );

  private get _data(): TagAddModelData {
    return this._config.data!;
  }

  protected readonly $isFormValid: Signal<boolean> = this._data.$isFormValid;

  protected addNewTag() {
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
