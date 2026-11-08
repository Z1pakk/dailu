import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { ProgressBar } from 'primeng/progressbar';
import { MilestoneView } from '@dashboard/lib/dashboard-day';

/** Milestones card (Figma `54:2994`). */
@Component({
  selector: 'app-milestones-card',
  imports: [ProgressBar],
  templateUrl: './milestones-card.html',
  styleUrl: './milestones-card.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MilestonesCard {
  public readonly $milestones = input.required<readonly MilestoneView[]>({ alias: 'milestones' });

  protected readonly barTokens = {
    root: { height: '6px', borderRadius: '999px', background: 'var(--dl-bg-muted)' },
    value: { background: '{text.color}' },
  };
  protected readonly unlockedBarTokens = {
    root: { height: '6px', borderRadius: '999px', background: 'var(--dl-bg-muted)' },
    value: { background: '{primary.color}' },
  };
}
