import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { Tag } from 'primeng/tag';

interface FaqItem {
  q: string;
  a: string;
}

@Component({
  selector: 'app-landing-faq',
  imports: [Tag],
  templateUrl: './landing-faq.html',
  styleUrls: ['../../_layout.scss', './landing-faq.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LandingFaq {
  protected readonly $openIndex = signal<number | null>(null);

  protected readonly items: FaqItem[] = [
    { q: 'Is Dailu free to use?', a: 'Yes — completely free. No credit card, no trial period. Sign up and start tracking immediately.' },
    { q: 'How does automatic sync work?', a: 'Once you connect an integration, Dailu polls it on a regular schedule and converts new activity into habit entries automatically. No manual input needed.' },
    { q: 'Can I still log habits manually?', a: 'Absolutely. Manual habits work alongside automatic ones. You can mix and match — some auto-synced, some logged by hand.' },
    { q: 'Will you add more integrations?', a: 'Yes — fitness apps, productivity tools, and health platforms are on the roadmap. The integration library will keep growing.' },
    { q: 'Is my data private?', a: 'We only request read-only access to your connected apps. Your data is never sold or shared. You can disconnect any integration at any time.' },
  ];

  protected toggle(i: number): void {
    this.$openIndex.update(cur => (cur === i ? null : i));
  }
}
