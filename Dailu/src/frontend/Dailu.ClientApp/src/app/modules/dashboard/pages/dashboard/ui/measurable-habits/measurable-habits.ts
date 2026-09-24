import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { Button } from 'primeng/button';
import { HabitModel } from '@habits/models/habit.model';
import { HabitEntryModel } from '@habit-entries/models/habit-entry.model';
import { habitTypes } from '@habits/enums/habit-type.enum';
import { getRecentTrendValues } from '@habit-entries/lib/get-recent-trend-values';
import { getTrendSeries } from '@habit-entries/lib/get-trend-series';
import { Sparkline } from '@shared/ui/sparkline/sparkline';
import { HabitDailyChart } from '@dashboard/pages/dashboard/ui/habit-daily-chart/habit-daily-chart';

interface MeasurableHabitRow {
  habit: HabitModel;
  trendValues: number[];
  latestValue: number | undefined;
}

@Component({
  selector: 'app-measurable-habits',
  imports: [Sparkline, HabitDailyChart, Button],
  templateUrl: './measurable-habits.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MeasurableHabits {
  readonly habits = input.required<HabitModel[]>();
  readonly habitEntries = input.required<HabitEntryModel[]>();

  protected readonly expandedIds = signal<ReadonlySet<string>>(new Set());

  protected readonly $rows = computed((): MeasurableHabitRow[] =>
    this.habits()
      .filter((habit) => habit.type === habitTypes.measurable && !habit.isArchived)
      .map((habit) => {
        const trendValues = getRecentTrendValues(this.habitEntries(), habit.id);
        const todaysValue = getTrendSeries(this.habitEntries(), habit.id, 'day', 1).at(0)?.value;
        return {
          habit,
          trendValues,
          latestValue: todaysValue,
        };
      }),
  );

  protected isExpanded(habitId: string): boolean {
    return this.expandedIds().has(habitId);
  }

  protected toggleExpanded(habitId: string) {
    const next = new Set(this.expandedIds());
    if (next.has(habitId)) {
      next.delete(habitId);
    } else {
      next.add(habitId);
    }
    this.expandedIds.set(next);
  }
}
