import { inject, Injectable, Signal } from '@angular/core';
import { NonNullableFormBuilder } from '@angular/forms';
import { valibotValidator } from '@shared/lib/form/valibot.validator';
import { toSignal } from '@angular/core/rxjs-interop';
import { catchError, EMPTY, map, Observable, startWith, tap } from 'rxjs';
import {
  TagAddForm,
  TagAddFormGroup,
  TagAddFormValue,
  TagDescriptionSchema,
  TagNameSchema,
} from './type/tag-add-form.type';
import { Store } from '@ngxs/store';
import { TagCreateTag, TagFetchTags } from '../../state/tag.action';
import { HttpErrorResponse } from '@angular/common/http';
import { applyServerErrors } from '@shared/lib/form/apply-server-errors';
import { CreateTagRequestModel } from '../../models/requests/create-tag.request';

@Injectable()
export class TagAddFacadeService {
  private readonly _fb = inject(NonNullableFormBuilder);
  private readonly _store = inject(Store);

  public readonly addTagForm: TagAddFormGroup = this._fb.group<TagAddForm>({
    name: this._fb.control<string>('', valibotValidator(TagNameSchema)),
    description: this._fb.control<string>(
      '',
      valibotValidator(TagDescriptionSchema),
    ),
  });

  public readonly $isFormValid: Signal<boolean> = toSignal(
    this.addTagForm.statusChanges.pipe(
      startWith(this.addTagForm.status),
      map((status) => status === 'VALID'),
    ),
    { initialValue: false },
  );

  public createTag(): Observable<void> {
    const formValue: TagAddFormValue = this.addTagForm.getRawValue();

    const request = (<CreateTagRequestModel>{
      name: formValue.name,
      description: formValue.description,
    }) satisfies CreateTagRequestModel;

    return this._store.dispatch(new TagCreateTag(request)).pipe(
      tap({
        next: () => {
          this._store.dispatch(new TagFetchTags());
        },
      }),
      catchError((error: HttpErrorResponse) => {
        applyServerErrors(this.addTagForm, error);
        return EMPTY;
      }),
    );
  }
}
