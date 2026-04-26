import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
} from '@angular/core';
import { DynamicDialogConfig } from 'primeng/dynamicdialog';
import { TagAddFacadeService } from './tag-add-facade.service';
import { ReactiveFormsModule } from '@angular/forms';
import { InputText } from 'primeng/inputtext';
import { Textarea } from 'primeng/textarea';

@Component({
  selector: 'app-tag-add',
  imports: [ReactiveFormsModule, InputText, Textarea],
  providers: [TagAddFacadeService],
  templateUrl: './tag-add.html',
  styleUrl: './tag-add.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TagAdd {
  private readonly _config = inject(DynamicDialogConfig);
  private readonly _tagAddService = inject(TagAddFacadeService);

  protected readonly addTagForm = this._tagAddService.addTagForm;

  constructor() {
    effect(() => {
      this._config.data.$isFormValid.set(this._tagAddService.$isFormValid());
    });
    this._config.data.submit = () => this._tagAddService.createTag();
  }
}
