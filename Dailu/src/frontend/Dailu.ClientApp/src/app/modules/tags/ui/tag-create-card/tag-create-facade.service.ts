import { inject, Injectable, signal, Signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Store } from '@ngxs/store';
import { MessageService } from 'primeng/api';
import { catchError, EMPTY, finalize, map, Observable, startWith, tap } from 'rxjs';
import { valibotValidator } from '@shared/lib/form/valibot.validator';
import { applyServerErrors } from '@shared/lib/form/apply-server-errors';
import { TagCreateTag, TagFetchTags } from '@tags/state/tag.action';
import { TagNameSchema } from '@tags/schemas/tag.schemas';
import { tagLabel } from '@tags/lib/tag-cards';

/** The "Create a tag" card on the Tags page: one name field and Add. */
@Injectable()
export class TagCreateFacadeService {
  private readonly _fb = inject(NonNullableFormBuilder);
  private readonly _store = inject(Store);
  private readonly _messageService = inject(MessageService);

  public readonly form = this._fb.group({
    name: this._fb.control('', valibotValidator(TagNameSchema)),
  });

  private readonly _$isSubmitting = signal(false);
  public readonly $isSubmitting: Signal<boolean> = this._$isSubmitting.asReadonly();
  public readonly $isFormValid: Signal<boolean> = toSignal(
    this.form.statusChanges.pipe(startWith(this.form.status), map((s) => s === 'VALID')),
    { initialValue: false },
  );

  /** Emits once on success; errors stay in the form. */
  public submit(): Observable<void> {
    if (this._$isSubmitting() || this.form.invalid) {
      return EMPTY;
    }
    // People type "#health" as often as "health"; the # is only how tags are shown.
    const name = this.form.getRawValue().name.trim().replace(/^#+/, '');
    this._$isSubmitting.set(true);
    return this._store.dispatch(new TagCreateTag({ name, description: '' })).pipe(
      tap(() => {
        this._store.dispatch(new TagFetchTags());
        this._messageService.add({ severity: 'success', summary: 'Created', detail: `${tagLabel(name)} created.`, life: 3000 });
        this.form.reset();
      }),
      catchError((error: HttpErrorResponse) => {
        applyServerErrors(this.form, error);
        return EMPTY;
      }),
      finalize(() => this._$isSubmitting.set(false)),
    );
  }
}
