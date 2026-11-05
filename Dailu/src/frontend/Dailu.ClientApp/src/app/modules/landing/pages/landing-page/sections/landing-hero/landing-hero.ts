import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Store } from '@ngxs/store';
import { ButtonDirective } from 'primeng/button';
import { AuthStateSelectors } from '@auth/state/auth.selector';
import { DayClock } from '@shared/ui/day-clock/day-clock';
import { EXAMPLE_DAY } from '../../../../data/example-day';

/** Hero (Figma `3:339`): headline + the live day clock. */
@Component({
  selector: 'app-landing-hero',
  imports: [RouterLink, ButtonDirective, DayClock],
  templateUrl: './landing-hero.html',
  styleUrls: ['../../_landing-layout.scss', './landing-hero.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LandingHero {
  private readonly _store = inject(Store);

  protected readonly exampleDay = EXAMPLE_DAY;

  protected readonly $isAuthenticated = this._store.selectSignal(
    AuthStateSelectors.getSlices.isAuthenticated,
  );
}
