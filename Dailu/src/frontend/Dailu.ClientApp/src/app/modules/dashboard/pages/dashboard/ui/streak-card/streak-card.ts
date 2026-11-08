import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { DialSegment } from '@shared/ui/ring-dial/ring-dial';
import { WeekDayDial } from '@shared/ui/week-day-dial/week-day-dial';
import { StreakSummary, WeekDay } from '@dashboard/lib/dashboard-day';

/** Streak card (Figma `54:2477`). "On time" is left out: habits have no time of day yet. */
@Component({
  selector: 'app-streak-card',
  imports: [WeekDayDial],
  templateUrl: './streak-card.html',
  styleUrl: './streak-card.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StreakCard {
  public readonly $streak = input.required<StreakSummary>({ alias: 'streak' });
  public readonly $week = input.required<readonly WeekDay[]>({ alias: 'week' });

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
