import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { WeekDay } from '@dashboard/lib/dashboard-day';
import { StreakSummary } from '@habits/lib/habit-streaks';
import { StreakDetails } from '@habits/ui/streak-details/streak-details';

/** Streak card (Figma `54:2477`): partial streak headline, full streak row, week, bests. */
@Component({
  selector: 'app-streak-card',
  imports: [StreakDetails],
  templateUrl: './streak-card.html',
  styleUrl: './streak-card.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StreakCard {
  public readonly $streak = input.required<StreakSummary>({ alias: 'streak' });
  public readonly $week = input.required<readonly WeekDay[]>({ alias: 'week' });
}
