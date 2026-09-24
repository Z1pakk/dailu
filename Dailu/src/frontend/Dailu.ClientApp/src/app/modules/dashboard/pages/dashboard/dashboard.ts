import { ChangeDetectionStrategy, Component, computed, inject, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Store } from '@ngxs/store';
import { HabitEntryGetHabitEntries } from '@habit-entries/state/habit-entry.action';
import { HabitEntryStateSelectors } from '@habit-entries/state/habit-entry.selector';
import { HabitEntryListItem } from '@habit-entries/pages/habit-entry-list/ui/habit-entry-list-item/habit-entry-list-item';
import { HabitGetHabits } from '@habits/state/habit.action';
import { HabitStateSelectors } from '@habits/state/habit.selector';
import { ActivityHeatmap } from '@dashboard/pages/dashboard/ui/activity-heatmap/activity-heatmap';
import { QuickEntries } from '@dashboard/pages/dashboard/ui/quick-entries/quick-entries';
import { MeasurableHabits } from '@dashboard/pages/dashboard/ui/measurable-habits/measurable-habits';

@Component({
  selector: 'app-dashboard',
  imports: [ActivityHeatmap, QuickEntries, MeasurableHabits, HabitEntryListItem, RouterLink],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Dashboard implements OnInit {
  private readonly _store = inject(Store);

  protected readonly $habitEntries = this._store.selectSignal(
    HabitEntryStateSelectors.getSlices.habitEntries,
  );

  protected readonly $isLoading = this._store.selectSignal(
    HabitEntryStateSelectors.getSlices.isLoading,
  );

  protected readonly $habits = this._store.selectSignal(
    HabitStateSelectors.getSlices.habits,
  );

  protected readonly $recentEntries = computed(() =>
    this.$habitEntries()
      .filter((e) => !e.isArchived)
      .slice(0, 10),
  );

  ngOnInit() {
    this._store.dispatch(new HabitEntryGetHabitEntries());
    this._store.dispatch(new HabitGetHabits());
  }
}
