import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { clockHabits, TodayHabit } from '@dashboard/lib/dashboard-day';
import { DayClock } from '@shared/ui/day-clock/day-clock';

/**
 * Today card (Figma `54:2391`). Habits have no time of day yet, so the clock spreads
 * today's real habits evenly around the dial and colours them by completion.
 */
@Component({
  selector: 'app-today-card',
  imports: [RouterLink, DayClock],
  templateUrl: './today-card.html',
  styleUrl: './today-card.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TodayCard {
  public readonly $habits = input.required<readonly TodayHabit[]>({ alias: 'habits' });
  /** Habits whose check-off request is in flight. */
  public readonly $pendingIds = input<ReadonlySet<string>>(new Set(), { alias: 'pendingIds' });

  public readonly check = output<string>();

  protected readonly $clockHabits = computed(() => clockHabits(this.$habits()));

  protected readonly $done = computed(() => this.$habits().filter((h) => h.isDone).length);
  protected readonly $left = computed(() => this.$habits().length - this.$done());

  protected canCheck(habit: TodayHabit): boolean {
    return !habit.isDone && !habit.isAutomated && !this.$pendingIds().has(habit.id);
  }

  protected onCheck(habit: TodayHabit): void {
    if (this.canCheck(habit)) {
      this.check.emit(habit.id);
    }
  }
}
