import { ChangeDetectionStrategy, Component } from '@angular/core';
import { Button } from 'primeng/button';
import { Tooltip } from 'primeng/tooltip';

/** Floating AI coach button (Figma `120:5645`) — PLACEHOLDER until the ai-coach API exists. */
@Component({
  selector: 'app-coach-button',
  imports: [Button, Tooltip],
  template: `
    <span pTooltip="Coming soon" tooltipPosition="left">
      <p-button icon="pi pi-sparkles" [rounded]="true" ariaLabel="AI coach" [disabled]="true" [dt]="tokens" />
    </span>
  `,
  styleUrl: './coach-button.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CoachButton {
  protected readonly tokens = { root: { iconOnlyWidth: '56px' } };
}
