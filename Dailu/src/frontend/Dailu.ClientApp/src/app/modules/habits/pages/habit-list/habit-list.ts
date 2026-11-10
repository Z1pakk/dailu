import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  OnInit,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Store } from '@ngxs/store';
import { Button } from 'primeng/button';
import { IconField } from 'primeng/iconfield';
import { InputIcon } from 'primeng/inputicon';
import { InputText } from 'primeng/inputtext';
import { SelectButton } from 'primeng/selectbutton';
import { Tooltip } from 'primeng/tooltip';
import { HabitFetchHabits } from '@habits/state/habit.action';
import { HabitStateSelectors } from '@habits/state/habit.selector';
import { HabitModel } from '@habits/models/habit.model';
import { HabitEntryGetHabitEntries } from '@habit-entries/state/habit-entry.action';
import { HabitEntryStateSelectors } from '@habit-entries/state/habit-entry.selector';
import { IntegrationGetSummaries } from '@integrations/state/integration.action';
import { TagGetTags } from '@tags/state/tag.action';
import {
  filterHabits,
  habitCounts,
  HabitFilter,
  habitStreak,
  isAutomated,
  milestoneProgress,
  sourceLabel,
  weekDots,
} from '@habits/lib/habit-progress';
import { scheduleLabel } from '@habits/lib/habit-schedule';
import { anyTimeLane, periodProgress } from '@habits/lib/habit-today';
import { AnyTimeLane } from '@habits/ui/any-time-lane/any-time-lane';
import { placeLabels, sampleTimeline } from '@habits/lib/sample-day';
import { PercentPositionDirective } from '@shared/directives/percent-position.directive';
import { localDay } from '@shared/lib/date/local-day';
import { CoachButton } from '@shared/ui/coach-button/coach-button';
import { HabitDrawer } from '@habits/ui/habit-drawer/habit-drawer';
import { StreakChip } from '@habits/ui/streak-chip/streak-chip';
import { HabitRow, HabitRowView } from '@habits/pages/habit-list/ui/habit-row/habit-row';

/** Which habit the drawer edits; `habit: null` creates a new one. */
interface DrawerState {
  habit: HabitModel | null;
}

/** Habits list (Figma `68:3394` desktop, `70:3718` mobile). */
@Component({
  selector: 'app-habit-list',
  imports: [
    FormsModule,
    Button,
    IconField,
    InputIcon,
    InputText,
    SelectButton,
    Tooltip,
    CoachButton,
    HabitDrawer,
    HabitRow,
    StreakChip,
    PercentPositionDirective,
    AnyTimeLane,
  ],
  templateUrl: './habit-list.html',
  styleUrl: './habit-list.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HabitList implements OnInit {
  private readonly _store = inject(Store);
  private readonly _route = inject(ActivatedRoute);
  private readonly _router = inject(Router);

  private readonly _$habits = this._store.selectSignal(HabitStateSelectors.getSlices.habits);
  private readonly _$entries = this._store.selectSignal(HabitEntryStateSelectors.getSlices.habitEntries);

  /** Snapshot of now; the page doesn't need to tick. */
  private readonly _now = new Date();
  private readonly _today = localDay(this._now);

  protected readonly $timeline = signal(sampleTimeline(this._now)).asReadonly();

  /** Clock labels are laid out by the track's real width so long names never overlap. */
  private readonly _clockTrack = viewChild<ElementRef<HTMLElement>>('clockTrack');
  private readonly _$trackPx = signal(0);
  protected readonly $labels = computed(() => {
    const px = this._$trackPx();
    if (px === 0) {
      return [];
    }
    const slots = this.$timeline().slots;
    return placeLabels(slots, px).map((placed, i) => ({ ...placed, name: slots[i]!.name }));
  });
  protected readonly $lane = computed(() => anyTimeLane(this._$habits(), this._$entries(), this._now));

  protected readonly $filter = signal<HabitFilter>('all');
  protected readonly $drawer = signal<DrawerState | null>(null);

  protected readonly $counts = computed(() => habitCounts(this._$habits()));

  protected readonly $filterOptions = computed(() => {
    const { all, auto, manual } = this.$counts();
    return [
      { label: `All ${all}`, value: 'all' },
      { label: `Auto ${auto}`, value: 'auto' },
      { label: `Manual ${manual}`, value: 'manual' },
    ];
  });

  protected readonly $rows = computed<HabitRowView[]>(() => {
    const entries = this._$entries();
    return filterHabits(this._$habits(), this.$filter()).map((habit) => ({
      habit,
      // Every real habit is an any-time habit until habits get a time of day.
      scheduleLabel: `${scheduleLabel(habit.frequency)} · any time`,
      sourceLabel: sourceLabel(habit),
      isAutomated: isAutomated(habit),
      dots: weekDots(habit, entries, this._today),
      streak: habitStreak(habit, entries, this._today),
      milestone: milestoneProgress(habit, entries),
      progress: periodProgress(habit, entries, this._today),
      // Habits have no duration in the backend yet: plain progress ring.
      durationMinutes: null,
    }));
  });

  constructor() {
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      const el = this._clockTrack()?.nativeElement;
      if (!el) {
        return;
      }
      const observer = new ResizeObserver(([entry]) => this._$trackPx.set(entry!.contentRect.width));
      observer.observe(el);
      destroyRef.onDestroy(() => observer.disconnect());
    });
  }

  ngOnInit(): void {
    this._store.dispatch([
      new HabitFetchHabits(),
      new HabitEntryGetHabitEntries(),
      new IntegrationGetSummaries(),
      new TagGetTags(),
    ]);

    // `?new=1` (dashboard "New habit", mobile "+" tab) opens the drawer once.
    if (this._route.snapshot.queryParamMap.get('new') === '1') {
      this._router.navigate([], { queryParams: { new: null }, replaceUrl: true });
      this.openDrawer(null);
    }
  }

  protected openDrawer(habit: HabitModel | null): void {
    this.$drawer.set({ habit });
  }

  protected closeDrawer(): void {
    this.$drawer.set(null);
  }
}
