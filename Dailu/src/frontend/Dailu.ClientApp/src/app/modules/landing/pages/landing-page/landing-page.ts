import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  inject,
} from '@angular/core';
import { LandingHero } from './sections/landing-hero/landing-hero';
import { LandingIntegrations } from './sections/landing-integrations/landing-integrations';
import { LandingHowItWorks } from './sections/landing-how-it-works/landing-how-it-works';
import { LandingStreaks } from './sections/landing-streaks/landing-streaks';
import { LandingSources } from './sections/landing-sources/landing-sources';
import { LandingLongGame } from './sections/landing-long-game/landing-long-game';
import { LandingDayRecap } from './sections/landing-day-recap/landing-day-recap';
import { LandingProof } from './sections/landing-proof/landing-proof';
import { LandingFaq } from './sections/landing-faq/landing-faq';
import { LandingCta } from './sections/landing-cta/landing-cta';
import { IntersectionService } from '@shared/lib/intersection/intersection.service';

@Component({
  selector: 'app-landing-page',
  imports: [
    LandingHero, LandingIntegrations, LandingHowItWorks, LandingStreaks,
    LandingSources, LandingLongGame, LandingDayRecap, LandingProof,
    LandingFaq, LandingCta,
  ],
  templateUrl: './landing-page.html',
  styleUrl: './landing-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LandingPage {
  private readonly _el: ElementRef<HTMLElement> = inject(ElementRef);
  private readonly _intersection = inject(IntersectionService);
  private readonly _destroyRef = inject(DestroyRef);

  constructor() {
    afterNextRender(() => {
      const vh = window.innerHeight;
      this._el.nativeElement.querySelectorAll<HTMLElement>('.reveal').forEach((el) => {
        const rect = el.getBoundingClientRect();
        if (rect.top < vh && rect.bottom > 0) {
          el.classList.add('in-view');
          return;
        }
        const cleanup = this._intersection.whenVisible(
          el,
          () => el.classList.add('in-view'),
          { threshold: 0.1 },
        );
        this._destroyRef.onDestroy(cleanup);
      });
    });
  }
}
