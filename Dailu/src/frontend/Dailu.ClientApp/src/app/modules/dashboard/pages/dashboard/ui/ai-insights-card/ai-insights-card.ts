import { ChangeDetectionStrategy, Component } from '@angular/core';
import { Button } from 'primeng/button';
import { Tooltip } from 'primeng/tooltip';

/**
 * AI insights card (Figma `54:3048`) — PLACEHOLDER. The ai-coach backend has no API yet,
 * so this shows the design's sample copy with disabled actions.
 */
@Component({
  selector: 'app-ai-insights-card',
  imports: [Button, Tooltip],
  templateUrl: './ai-insights-card.html',
  styleUrl: './ai-insights-card.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AiInsightsCard {}
