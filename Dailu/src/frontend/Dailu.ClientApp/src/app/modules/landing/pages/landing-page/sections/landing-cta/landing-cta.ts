import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Store } from '@ngxs/store';
import * as v from 'valibot';
import { ButtonDirective } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { AuthStateSelectors } from '@auth/state/auth.selector';
import { RegisterEmailSchema } from '@auth/pages/register/types/register-form.type';

/** Final CTA (Figma `5:629`): email → register. */
@Component({
  selector: 'app-landing-cta',
  imports: [RouterLink, FormsModule, ButtonDirective, InputText],
  templateUrl: './landing-cta.html',
  styleUrls: ['../../_landing-layout.scss', './landing-cta.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LandingCta {
  private readonly _router = inject(Router);
  private readonly _store = inject(Store);

  protected readonly $isAuthenticated = this._store.selectSignal(
    AuthStateSelectors.getSlices.isAuthenticated,
  );

  protected readonly $email = signal('');
  protected readonly $error = signal<string | null>(null);

  protected submit(event: Event): void {
    event.preventDefault();
    const email = this.$email().trim();
    if (!v.is(RegisterEmailSchema, email)) {
      this.$error.set('Enter a valid email');
      return;
    }
    this.$error.set(null);
    void this._router.navigate(['/register'], { queryParams: { email } });
  }

  protected onInput(value: string): void {
    this.$email.set(value);
    if (this.$error()) {
      this.$error.set(null);
    }
  }
}
