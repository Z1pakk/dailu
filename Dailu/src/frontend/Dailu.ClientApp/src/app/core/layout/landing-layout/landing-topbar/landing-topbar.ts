import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LogoWidget } from '@shared/ui/logo-widget/logo-widget';
import { ButtonDirective } from 'primeng/button';
import { Store } from '@ngxs/store';
import { AuthStateSelectors } from '@auth/state/auth.selector';

@Component({
  selector: 'app-landing-topbar',
  imports: [RouterLink, ButtonDirective, LogoWidget],
  templateUrl: './landing-topbar.html',
  styleUrl: './landing-topbar.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LandingTopbar {
  private readonly _store = inject(Store);

  protected readonly $isAuthenticated = this._store.selectSignal(
    AuthStateSelectors.getSlices.isAuthenticated,
  );
}
