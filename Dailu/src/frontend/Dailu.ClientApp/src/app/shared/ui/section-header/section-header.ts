import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Eyebrow + H2 + optional subtitle used at the top of every landing section. */
@Component({
  selector: 'app-section-header',
  templateUrl: './section-header.html',
  styleUrl: './section-header.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.sh--start]': "$align() === 'start'",
  },
})
export class SectionHeader {
  public readonly $eyebrow = input<string>('', { alias: 'eyebrow' });
  /** Use "\n" for the designed line break. */
  public readonly $title = input.required<string>({ alias: 'title' });
  public readonly $subtitle = input<string>('', { alias: 'subtitle' });
  /** Shorter subtitle for mobile (Figma 9:240). `null` = same as desktop, `''` = hidden on mobile. */
  public readonly $subtitleMobile = input<string | null>(null, { alias: 'subtitleMobile' });
  public readonly $align = input<'center' | 'start'>('center', { alias: 'align' });
}
