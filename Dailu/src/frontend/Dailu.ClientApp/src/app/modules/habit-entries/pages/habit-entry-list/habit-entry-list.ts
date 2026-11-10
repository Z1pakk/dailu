import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Store } from '@ngxs/store';
import { Button } from 'primeng/button';
import { IconField } from 'primeng/iconfield';
import { InputIcon } from 'primeng/inputicon';
import { InputText } from 'primeng/inputtext';
import { Select } from 'primeng/select';
import { SelectButton } from 'primeng/selectbutton';
import { Tooltip } from 'primeng/tooltip';
import { HabitEntryGetHabitEntries } from '@habit-entries/state/habit-entry.action';
import { HabitEntryStateSelectors } from '@habit-entries/state/habit-entry.selector';
import { entryFeed, EntrySourceFilter, FeedRow } from '@habit-entries/lib/entry-feed';
import { HabitGetHabits } from '@habits/state/habit.action';
import { HabitStateSelectors } from '@habits/state/habit.selector';
import { StreakChip } from '@habits/ui/streak-chip/streak-chip';
import { CoachButton } from '@shared/ui/coach-button/coach-button';
import { LogEntryDrawer } from '@habit-entries/ui/log-entry-drawer/log-entry-drawer';
import { LogEntryPrefill } from '@habit-entries/ui/log-entry-drawer/log-entry-facade.service';
import { localDay } from '@shared/lib/date/local-day';

type PeriodOption = 7 | 30 | 'all';

/** How many more days "Show earlier entries" adds. */
const EARLIER_STEP = 7;

/** Entries (Figma `76:4323` desktop, `78:4604` mobile). */
@Component({
  selector: 'app-habit-entry-list',
  imports: [FormsModule, Button, IconField, InputIcon, InputText, Select, SelectButton, Tooltip, StreakChip, CoachButton, LogEntryDrawer],
  templateUrl: './habit-entry-list.html',
  styleUrl: './habit-entry-list.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HabitEntryList implements OnInit {
  private readonly _store = inject(Store);

  private readonly _$habits = this._store.selectSignal(HabitStateSelectors.getSlices.habits);
  private readonly _$entries = this._store.selectSignal(HabitEntryStateSelectors.getSlices.habitEntries);
  private readonly _today = localDay(new Date());

  protected readonly periodOptions: { label: string; value: PeriodOption }[] = [
    { label: 'Last 7 days', value: 7 },
    { label: 'Last 30 days', value: 30 },
    { label: 'All time', value: 'all' },
  ];
  protected readonly sourceOptions: { label: string; value: EntrySourceFilter }[] = [
    { label: 'All', value: 'all' },
    { label: 'Auto', value: 'auto' },
    { label: 'Manual', value: 'manual' },
  ];

  protected readonly $period = signal<PeriodOption>(7);
  /** Extra days added by "Show earlier entries". */
  protected readonly $earlier = signal(0);
  protected readonly $habitId = signal<string | null>(null);
  protected readonly $source = signal<EntrySourceFilter>('all');
  protected readonly $query = signal('');
  /** Open Log entry drawer and what it starts with; null = closed. */
  protected readonly $logDrawer = signal<LogEntryPrefill | null>(null);

  protected readonly $habitOptions = computed(() => [
    { label: 'All habits', value: null as string | null },
    ...this._$habits()
      .filter((h) => !h.isArchived)
      .map((h) => ({ label: h.name, value: h.id as string | null })),
  ]);

  protected readonly $feed = computed(() => {
    const period = this.$period();
    return entryFeed(this._$habits(), this._$entries(), {
      today: this._today,
      days: period === 'all' ? null : period + this.$earlier(),
      habitId: this.$habitId(),
      source: this.$source(),
      query: this.$query(),
    });
  });

  ngOnInit(): void {
    this._store.dispatch([new HabitGetHabits(), new HabitEntryGetHabitEntries()]);
  }

  protected setPeriod(period: PeriodOption): void {
    this.$period.set(period);
    this.$earlier.set(0);
  }

  protected showEarlier(): void {
    this.$earlier.update((days) => days + EARLIER_STEP);
  }

  /** Entry rows open the same drawer in edit mode. */
  protected editEntry(row: FeedRow): void {
    const entry = this._$entries().find((e) => e.id === row.entryId);
    if (entry) {
      this.$logDrawer.set({ entry });
    }
  }


  /** "+ Log entry" opens it empty; "Log manually" on a missed row with that habit and day. */
  protected logEntry(row?: FeedRow): void {
    this.$logDrawer.set(row ? { habitId: row.habitId, day: row.day } : {});
  }

}
