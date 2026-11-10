import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { Button } from 'primeng/button';
import { Menu } from 'primeng/menu';
import { MenuItem } from 'primeng/api';
import { HabitModel } from '@habits/models/habit.model';
import { HabitStreak, MilestoneProgress, WeekDot } from '@habits/lib/habit-progress';
import { formatRingDuration } from '@habits/lib/sample-day';

export interface HabitRowView {
  habit: HabitModel;
  scheduleLabel: string;
  sourceLabel: string;
  isAutomated: boolean;
  dots: WeekDot[];
  streak: HabitStreak;
  milestone: MilestoneProgress | null;
  /** 0..1 of the current period's target. */
  progress: number;
  /** Null until the backend stores durations: the ring then shows plain progress. */
  durationMinutes: number | null;
}

/** Ring radius in a 40×40 box with a 5px stroke. */
const RING_RADIUS = 17.5;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;

/** One habit on the list (Figma `68:4119` row; mobile `70:3957`). */
@Component({
  selector: 'app-habit-row',
  imports: [Button, Menu],
  templateUrl: './habit-row.html',
  styleUrl: './habit-row.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HabitRow {
  public readonly $row = input.required<HabitRowView>({ alias: 'row' });
  public readonly edit = output<void>();

  protected readonly ringRadius = RING_RADIUS;
  protected readonly ringLength = RING_LENGTH;

  /**
   * With a duration the ring is a one-hour clock face (an hour or more fills it) with the
   * duration inside; without one it shows progress toward the current period's target.
   */
  protected readonly $ringShare = computed(() => {
    const { durationMinutes, progress } = this.$row();
    return durationMinutes === null ? progress : Math.min(1, durationMinutes / 60);
  });
  protected readonly $ringOffset = computed(() => RING_LENGTH * (1 - this.$ringShare()));
  protected readonly $ringLabel = computed(() => {
    const minutes = this.$row().durationMinutes;
    return minutes === null ? null : formatRingDuration(minutes);
  });

  protected readonly $streakLabel = computed(() => `${this.$row().streak.unit} streak`);

  protected readonly menuItems: MenuItem[] = [
    { label: 'Edit', icon: 'pi pi-pencil', command: () => this.edit.emit() },
    // No archive / delete endpoints yet.
    { label: 'Archive', icon: 'pi pi-inbox', disabled: true, tooltipOptions: { tooltipLabel: 'Coming soon' } },
    { label: 'Delete', icon: 'pi pi-trash', disabled: true, tooltipOptions: { tooltipLabel: 'Coming soon' } },
  ];

  protected dotLabel(dot: WeekDot): string {
    return `${dot.day}: ${dot.state}`;
  }
}
