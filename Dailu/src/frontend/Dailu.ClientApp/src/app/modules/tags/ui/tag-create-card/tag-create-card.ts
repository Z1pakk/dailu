import { ChangeDetectionStrategy, Component, ElementRef, inject, viewChild } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { Button } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { TagCreateFacadeService } from '@tags/ui/tag-create-card/tag-create-facade.service';

/** "Create a tag" card at the end of the tag grid (Figma `tag-card / new`). */
@Component({
  selector: 'app-tag-create-card',
  imports: [ReactiveFormsModule, Button, InputText],
  providers: [TagCreateFacadeService],
  templateUrl: './tag-create-card.html',
  styleUrl: './tag-create-card.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TagCreateCard {
  protected readonly facade = inject(TagCreateFacadeService);
  protected readonly name = this.facade.form.controls.name;

  private readonly _input = viewChild.required<ElementRef<HTMLInputElement>>('nameInput');
  private readonly _host = inject<ElementRef<HTMLElement>>(ElementRef);

  /** "+ New tag" in the header brings this card into view. */
  public focus(): void {
    this._host.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    this._input().nativeElement.focus({ preventScroll: true });
  }

  protected submit(): void {
    if (this.facade.form.invalid) {
      this.facade.form.markAllAsTouched();
      return;
    }
    this.facade.submit().subscribe();
  }
}
