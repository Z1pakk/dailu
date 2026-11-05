import { ChangeDetectionStrategy, Component } from '@angular/core';

/** Integrations strip (Figma `4:49`) — only the integrations that really exist. */
@Component({
  selector: 'app-landing-integrations',
  templateUrl: './landing-integrations.html',
  styleUrls: ['../../_landing-layout.scss', './landing-integrations.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LandingIntegrations {
  protected readonly live = ['GitHub', 'Strava', 'Google Health'];
}
