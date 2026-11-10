import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IntegrationView } from '@integrations/lib/integration-status';

/** Integrations card (Figma `54:2963`). */
@Component({
  selector: 'app-integrations-card',
  imports: [RouterLink],
  templateUrl: './integrations-card.html',
  styleUrl: './integrations-card.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IntegrationsCard {
  public readonly $integrations = input.required<readonly IntegrationView[]>({ alias: 'integrations' });
}
