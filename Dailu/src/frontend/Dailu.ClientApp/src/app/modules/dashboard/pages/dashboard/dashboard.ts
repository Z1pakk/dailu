import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { Store } from '@ngxs/store';
import { format } from 'date-fns/format';
import { Button, ButtonDirective } from 'primeng/button';
import { IconField } from 'primeng/iconfield';
import { InputIcon } from 'primeng/inputicon';
import { InputText } from 'primeng/inputtext';
import { Tooltip } from 'primeng/tooltip';
import { HabitGetHabits } from '@habits/state/habit.action';
import { HabitStateSelectors } from '@habits/state/habit.selector';
import {
  HabitEntryCreateHabitEntry,
  HabitEntryGetHabitEntries,
} from '@habit-entries/state/habit-entry.action';
import { HabitEntryStateSelectors } from '@habit-entries/state/habit-entry.selector';
import { UserProfileGetIntegrationConfigs } from '@user-profile/state/user-profile.action';
import { UserProfileStateSelectors } from '@user-profile/state/user-profile.selector';
import { buildRecentWeeks } from '@shared/ui/heatmap/heatmap.grid';
import {
  currentWeek,
  dayCounts,
  greeting,
  isFullyDone,
  localDay,
  milestones,
  todayHabits,
  trackedHabits,
} from '@dashboard/lib/dashboard-day';
import { integrationView } from '@dashboard/lib/dashboard-integrations';
import { TodayCard } from './ui/today-card/today-card';
import { StreakCard } from './ui/streak-card/streak-card';
import { ConsistencyCard } from './ui/consistency-card/consistency-card';
import { IntegrationsCard } from './ui/integrations-card/integrations-card';
import { MilestonesCard } from './ui/milestones-card/milestones-card';
import { RecentActivityCard } from './ui/recent-activity-card/recent-activity-card';
import { AiInsightsCard } from './ui/ai-insights-card/ai-insights-card';
import { CoachButton } from '@shared/ui/coach-button/coach-button';
import { StreakChip } from '@habits/ui/streak-chip/streak-chip';
import { streakSummary } from '@habits/lib/habit-streaks';
import { anyTimeLane } from '@habits/lib/habit-today';

const MOBILE_QUERY = '(max-width: 767.98px)';

/** Dashboard (Figma `54:2292` desktop, `55:3098` mobile). */
@Component({
  selector: 'app-dashboard',
  imports: [
    RouterLink,
    Button,
    ButtonDirective,
    IconField,
    InputIcon,
    InputText,
    Tooltip,
    TodayCard,
    StreakCard,
    ConsistencyCard,
    IntegrationsCard,
    MilestonesCard,
    RecentActivityCard,
    AiInsightsCard,
    CoachButton,
    StreakChip,
  ],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Dashboard {
  private readonly _store = inject(Store);

  private readonly _$habits = this._store.selectSignal(HabitStateSelectors.getSlices.habits);
  private readonly _$entries = this._store.selectSignal(
    HabitEntryStateSelectors.getSlices.habitEntries,
  );
  private readonly _$profile = this._store.selectSignal(UserProfileStateSelectors.getSlices.profile);
  private readonly _$summaries = this._store.selectSignal(
    UserProfileStateSelectors.getSlices.integrationSummaries,
  );

  /** Snapshot of "now"; the dashboard doesn't need to tick. */
  private readonly _now = new Date();
  private readonly _today = localDay(this._now);
  private readonly _$isMobile = signal(false);

  protected readonly $pendingIds = signal<ReadonlySet<string>>(new Set());

  protected readonly entries = this._$entries;

  protected readonly $greeting = computed(() => {
    const name = this._$profile()?.firstName;
    return name ? `${greeting(this._now)}, ${name}` : greeting(this._now);
  });

  protected readonly $today = computed(() => todayHabits(this._$habits(), this._$entries(), this._today));

  protected readonly $subtitle = computed(() => {
    const habits = this.$today();
    const done = habits.filter((h) => h.isDone).length;
    const date = format(this._now, 'EEEE, d MMMM');
    return `${date} · ${done} of ${habits.length} habits done`;
  });

  protected readonly $streak = computed(() => streakSummary(this._$habits(), this._$entries(), this._today));
  protected readonly $lane = computed(() => anyTimeLane(this._$habits(), this._$entries(), this._now));
  protected readonly $week = computed(() => currentWeek(this._$habits(), this._$entries(), this._today));

  protected readonly $heatWeeks = computed(() =>
    buildRecentWeeks(
      this._now,
      this._$isMobile() ? 7 : 20,
      dayCounts(this._$habits(), this._$entries()),
      Math.max(1, this.$habitsPerDay()),
    ),
  );
  protected readonly $habitsPerDay = computed(() => trackedHabits(this._$habits()).length);
  /** 20 weeks on desktop need smaller cells than the 7-week mobile grid. */
  protected readonly $heatCellSize = computed(() => (this._$isMobile() ? 32 : 22));
  protected readonly $heatSummary = computed(() => {
    const days = this.$heatWeeks()
      .flat()
      .filter((cell) => cell !== null)
      .map((cell) => cell.date);
    const fullyDone = days.filter((day) => isFullyDone(day, this._$habits(), this._$entries())).length;
    return { days: days.length, fullyDone };
  });

  protected readonly $integrations = computed(() =>
    (this._$summaries() ?? []).map((summary) => integrationView(summary, this._now)),
  );

  protected readonly $milestones = computed(() => milestones(this._$habits(), this._$entries()));

  constructor() {
    this._store.dispatch([
      new HabitGetHabits(),
      new HabitEntryGetHabitEntries(),
      new UserProfileGetIntegrationConfigs(),
    ]);

    const media = window.matchMedia(MOBILE_QUERY);
    this._$isMobile.set(media.matches);
    const onChange = (event: MediaQueryListEvent) => this._$isMobile.set(event.matches);
    media.addEventListener('change', onChange);
    inject(DestroyRef).onDestroy(() => media.removeEventListener('change', onChange));
  }

  protected checkOff(habitId: string): void {
    if (this.$pendingIds().has(habitId)) {
      return;
    }
    this._setPending(habitId, true);
    this._store
      .dispatch(
        new HabitEntryCreateHabitEntry({
          habitId,
          value: 1,
          notes: null,
          completedAt: new Date().toISOString(),
        }),
      )
      .subscribe({
        next: () => {
          this._store
            .dispatch(new HabitEntryGetHabitEntries())
            .subscribe({ complete: () => this._setPending(habitId, false) });
        },
        error: () => this._setPending(habitId, false),
      });
  }

  private _setPending(habitId: string, isPending: boolean): void {
    this.$pendingIds.update((ids) => {
      const next = new Set(ids);
      if (isPending) {
        next.add(habitId);
      } else {
        next.delete(habitId);
      }
      return next;
    });
  }
}
