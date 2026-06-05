import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  inject,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { ButtonDirective } from 'primeng/button';
import { Tag } from 'primeng/tag';
import { Store } from '@ngxs/store';
import { AuthStateSelectors } from '@auth/state/auth.selector';
import { LandingHeroVisualCard } from './landing-hero-visual-card/landing-hero-visual-card';
import { ParallaxContainerDirective } from '@shared/directives/parallax-container.directive';

@Component({
  selector: 'app-landing-hero',
  imports: [RouterLink, ButtonDirective, Tag, LandingHeroVisualCard],
  hostDirectives: [ParallaxContainerDirective],
  templateUrl: './landing-hero.html',
  styleUrls: ['../../_layout.scss', './landing-hero.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LandingHero {
  private readonly _store = inject(Store);
  private readonly _el: ElementRef<HTMLElement> = inject(ElementRef);
  private readonly _parallax = inject(ParallaxContainerDirective);
  private readonly _destroyRef = inject(DestroyRef);

  private readonly _floatDepths = [0.018, 0.012, 0.022, 0.014];

  public readonly $isAuthenticated = this._store.selectSignal(
    AuthStateSelectors.getSlices.isAuthenticated,
  );

  constructor() {
    afterNextRender(() => {
      const floats = Array.from(
        this._el.nativeElement.querySelectorAll<HTMLElement>('.hero-float-card'),
      );
      const cleanup = this._parallax.addEffect((curX, curY) => {
        floats.forEach((card, i) => {
          const depth = this._floatDepths[i] ?? 0.016;
          const dx = curX * depth * window.innerWidth * 0.5;
          const dy = curY * depth * window.innerHeight * 0.4;
          card.style.transform = `translate(${dx}px, ${dy}px)`;
        });
      });
      this._destroyRef.onDestroy(cleanup);
    });
  }
}
