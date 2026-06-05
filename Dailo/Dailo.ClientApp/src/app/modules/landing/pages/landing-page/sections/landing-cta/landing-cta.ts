import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ButtonDirective } from 'primeng/button';
import { Store } from '@ngxs/store';
import { AuthStateSelectors } from '@auth/state/auth.selector';

@Component({
  selector: 'app-landing-cta',
  imports: [RouterLink, ButtonDirective],
  templateUrl: './landing-cta.html',
  styleUrls: ['../../_layout.scss', './landing-cta.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LandingCta {
  private readonly _store = inject(Store);

  public readonly $isAuthenticated = this._store.selectSignal(AuthStateSelectors.getSlices.isAuthenticated);
}
