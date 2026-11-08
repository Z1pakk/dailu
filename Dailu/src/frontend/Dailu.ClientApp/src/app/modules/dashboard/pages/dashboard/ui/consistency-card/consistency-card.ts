import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { Heatmap } from '@shared/ui/heatmap/heatmap';
import { HeatCell } from '@shared/ui/heatmap/heatmap.grid';

/** Consistency card (Figma `54:2540`): last N weeks of daily-habit completion. */
@Component({
  selector: 'app-consistency-card',
  imports: [Heatmap],
  templateUrl: './consistency-card.html',
  styleUrl: './consistency-card.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConsistencyCard {
  public readonly $weeks = input.required<readonly (HeatCell | null)[][]>({ alias: 'weeks' });
  public readonly $habitsPerDay = input.required<number>({ alias: 'habitsPerDay' });
  public readonly $fullyDone = input.required<number>({ alias: 'fullyDone' });
  public readonly $days = input.required<number>({ alias: 'days' });
  public readonly $cellSize = input(22, { alias: 'cellSize' });
}
