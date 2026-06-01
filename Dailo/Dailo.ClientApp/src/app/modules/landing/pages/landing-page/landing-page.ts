import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  NgZone,
} from '@angular/core';
import { LandingHero } from './sections/landing-hero/landing-hero';
import { LandingStats } from './sections/landing-stats/landing-stats';
import { LandingHowItWorks } from './sections/landing-how-it-works/landing-how-it-works';
import { LandingIntegrations } from './sections/landing-integrations/landing-integrations';
import { LandingFeatures } from './sections/landing-features/landing-features';
import { LandingTestimonials } from './sections/landing-testimonials/landing-testimonials';
import { LandingFaq } from './sections/landing-faq/landing-faq';
import { LandingCta } from './sections/landing-cta/landing-cta';

@Component({
  selector: 'app-landing-page',
  imports: [
    LandingHero, LandingStats, LandingHowItWorks, LandingIntegrations,
    LandingFeatures, LandingTestimonials, LandingFaq, LandingCta,
  ],
  templateUrl: './landing-page.html',
  styleUrl: './landing-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LandingPage implements AfterViewInit {
  constructor(
    private readonly _el: ElementRef<HTMLElement>,
    private readonly _zone: NgZone,
  ) {}

  ngAfterViewInit(): void {
    this._zone.runOutsideAngular(() => {
      const vh = window.innerHeight;
      const observer = new IntersectionObserver(
        entries => entries.forEach(e => {
          if (e.isIntersecting) {
            e.target.classList.add('in-view');
            observer.unobserve(e.target);
          }
        }),
        { threshold: 0.1 },
      );

      this._el.nativeElement.querySelectorAll<Element>('.reveal').forEach(el => {
        const rect = el.getBoundingClientRect();
        if (rect.top < vh && rect.bottom > 0) {
          el.classList.add('in-view'); // already visible — no flash
        } else {
          observer.observe(el); // below fold — reveal on scroll
        }
      });
    });
  }
}
