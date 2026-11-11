import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ConfirmationService } from 'primeng/api';
import { Button } from 'primeng/button';
import { ConfirmPopup } from 'primeng/confirmpopup';
import { ToggleSwitch } from 'primeng/toggleswitch';
import { Tooltip } from 'primeng/tooltip';
import { IntegrationCard as IntegrationCardView } from '@integrations/lib/integration-cards';

/** One provider on the Integrations page (Figma `integration / GitHub`). */
@Component({
  selector: 'app-integration-card',
  imports: [FormsModule, Button, ConfirmPopup, ToggleSwitch, Tooltip],
  templateUrl: './integration-card.html',
  styleUrl: './integration-card.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IntegrationCard {
  private readonly _confirmationService = inject(ConfirmationService);

  public readonly $card = input.required<IntegrationCardView>({ alias: 'card' });
  public readonly $isConnecting = input(false, { alias: 'isConnecting' });
  public readonly $isDisconnecting = input(false, { alias: 'isDisconnecting' });

  public readonly connect = output<void>();
  public readonly disconnect = output<void>();

  protected confirmDisconnect(event: Event): void {
    const card = this.$card();
    this._confirmationService.confirm({
      key: card.type,
      target: event.currentTarget as EventTarget,
      message: `Disconnect ${card.name}? Habits using it stop ticking off on their own.`,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Disconnect',
      rejectLabel: 'Cancel',
      acceptButtonProps: { severity: 'danger' },
      rejectButtonProps: { severity: 'secondary', outlined: true },
      accept: () => this.disconnect.emit(),
    });
  }
}
