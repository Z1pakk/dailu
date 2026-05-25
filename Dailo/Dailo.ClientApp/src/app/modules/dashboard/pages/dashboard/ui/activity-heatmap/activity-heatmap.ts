import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { NgClass } from '@angular/common';
import { Tooltip } from 'primeng/tooltip';
import { HabitEntryModel } from '@habit-entries/models/habit-entry.model';
import { endOfMonth, format, isToday, startOfMonth } from 'date-fns';

interface CalendarCell {
  day: number;
  date: Date;
  tooltipLabel: string;
  count: number;
  intensity: 0 | 1 | 2 | 3 | 4;
  today: boolean;
}

interface GridData {
  cells: CalendarCell[];
  cols: number;
}

const INTENSITY_CLASSES: Record<0 | 1 | 2 | 3 | 4, string> = {
  0: 'bg-zinc-100 dark:bg-zinc-800 text-surface-400',
  1: 'bg-blue-100 text-blue-800',
  2: 'bg-blue-300 text-blue-900',
  3: 'bg-blue-500 text-white',
  4: 'bg-blue-700 text-white',
};

@Component({
  selector: 'app-activity-heatmap',
  imports: [NgClass, Tooltip],
  templateUrl: './activity-heatmap.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ActivityHeatmap {
  readonly habitEntries = input.required<HabitEntryModel[]>();

  protected readonly intensityClasses = INTENSITY_CLASSES;
  protected readonly legendLevels: (0 | 1 | 2 | 3 | 4)[] = [0, 1, 2, 3, 4];

  protected readonly $monthLabel = computed(() => format(new Date(), 'MMMM yyyy'));

  protected readonly $gridData = computed((): GridData => {
    const today = new Date();
    const daysInMonth = endOfMonth(today).getDate();
    const totalCols = Math.ceil(daysInMonth / 3);
    const totalCells = totalCols * 3;

    const countMap = new Map<string, number>();
    for (const entry of this.habitEntries()) {
      const key = format(new Date(entry.completedAtUtc), 'yyyy-MM-dd');
      countMap.set(key, (countMap.get(key) ?? 0) + 1);
    }

    const cells: CalendarCell[] = [];
    for (let i = totalCells - 1; i >= 0; i--) {
      const day = new Date(today);
      day.setDate(day.getDate() - i);
      const key = format(day, 'yyyy-MM-dd');
      const count = countMap.get(key) ?? 0;
      const intensity: 0 | 1 | 2 | 3 | 4 =
        count === 0 ? 0 : count <= 2 ? 1 : count <= 4 ? 2 : count <= 7 ? 3 : 4;

      cells.push({
        day: day.getDate(),
        date: day,
        tooltipLabel: `${format(day, 'MMM d, yyyy')} — ${count} ${count === 1 ? 'entry' : 'entries'}`,
        count,
        intensity,
        today: isToday(day),
      });
    }

    return { cells, cols: totalCols };
  });

  protected readonly $totalThisMonth = computed(() => {
    const today = new Date();
    const monthStart = startOfMonth(today);
    return this.habitEntries().filter((e) => {
      const d = new Date(e.completedAtUtc);
      return d >= monthStart && d <= today;
    }).length;
  });

  protected readonly $currentStreak = computed(() => {
    const entries = this.habitEntries();
    if (entries.length === 0) return 0;

    const dateSet = new Set(entries.map((e) => format(new Date(e.completedAtUtc), 'yyyy-MM-dd')));
    let streak = 0;

    for (let i = 0; i < 365; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = format(d, 'yyyy-MM-dd');
      if (i === 0 && !dateSet.has(key)) continue;
      if (!dateSet.has(key)) break;
      streak++;
    }

    return streak;
  });

  protected getCellClass(cell: CalendarCell): string {
    return this.intensityClasses[cell.intensity];
  }
}
