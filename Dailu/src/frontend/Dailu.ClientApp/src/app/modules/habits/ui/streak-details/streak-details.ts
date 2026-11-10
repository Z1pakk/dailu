import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { DialSegment } from '@shared/ui/ring-dial/ring-dial';
import { WeekDayDial } from '@shared/ui/week-day-dial/week-day-dial';
import { WeekDay } from '@dashboard/lib/dashboard-day';
import { StreakSummary } from '@habits/lib/habit-streaks';

/**
 * Streak content shared by the dashboard Streak card and the streak chip popover
 * (Figma "Spec · Streak chip & popover"): the partial streak is the headline, the full
 * streak a smaller row under it.
 */
@Component({
  selector: 'app-streak-details',
  imports: [WeekDayDial],
  templateUrl: './streak-details.html',
  styleUrl: './streak-details.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StreakDetails {
  public readonly $summary = input.required<StreakSummary>({ alias: 'summary' });
  public readonly $week = input.required<readonly WeekDay[]>({ alias: 'week' });

  protected unit(n: number): string {
    return n === 1 ? 'day' : 'days';
  }

  /** One dial segment per tracked habit: auto-done, manual-done, then missed (past) or open (today). */
  protected segments(day: WeekDay): DialSegment[] {
    const open = day.isToday ? 'scheduled' : 'missed';
    return Array.from({ length: day.total }, (_, i) => {
      let state: DialSegment['state'] = open;
      if (i < day.auto) {
        state = 'auto';
      } else if (i < day.done) {
        state = 'manual';
      }
      return { state, label: '', detail: '' };
    });
  }
}
