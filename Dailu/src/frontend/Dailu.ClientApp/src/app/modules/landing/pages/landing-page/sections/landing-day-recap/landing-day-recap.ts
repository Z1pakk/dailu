import { ChangeDetectionStrategy, Component } from '@angular/core';
import { SectionHeader } from '@shared/ui/section-header/section-header';
import { EXAMPLE_RECAP } from '../../../../data/example-recap';

/** Day recap (Figma `5:521`): the midnight receipt. */
@Component({
  selector: 'app-landing-day-recap',
  imports: [SectionHeader],
  templateUrl: './landing-day-recap.html',
  styleUrls: ['../../_landing-layout.scss', './landing-day-recap.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LandingDayRecap {
  protected readonly rows = EXAMPLE_RECAP;
  protected readonly title = 'Your day,\nwrapped up.';
  protected readonly automatic = EXAMPLE_RECAP.filter((r) => r.source !== 'YOU').length;
}
