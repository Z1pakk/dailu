import { ChangeDetectionStrategy, Component } from '@angular/core';
import { SectionHeader } from '@shared/ui/section-header/section-header';

/** Proof (Figma `5:567`): honest facts instead of stats and testimonials. */
@Component({
  selector: 'app-landing-proof',
  imports: [SectionHeader],
  templateUrl: './landing-proof.html',
  styleUrls: ['../../_landing-layout.scss', './landing-proof.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LandingProof {
  protected readonly facts = [
    { value: '3', label: 'live integrations — GitHub, Strava, Google Health' },
    { value: '2–5 min', label: 'between automatic syncs' },
    { value: '0 €', label: 'free — it’s a study & pet project' },
  ];

  protected readonly cards = [
    {
      eyebrow: 'Frontend',
      title: 'Angular 21 + PrimeNG 21',
      text: 'Aura theme preset with light and dark tokens, Tailwind 4 for layout.',
    },
    {
      eyebrow: 'Backend',
      title: 'Modular .NET monolith',
      text: 'Separate modules for habits, entries, users & integrations, identity and search — with a background worker per integration.',
    },
    {
      eyebrow: 'Why',
      title: 'A study project, end to end',
      text: 'Built to practise modular architecture, background sync and a design system — from Figma tokens to PrimeNG components.',
    },
  ];
}
