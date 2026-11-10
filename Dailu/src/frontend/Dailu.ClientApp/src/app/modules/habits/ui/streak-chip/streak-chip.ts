import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, input, viewChild } from '@angular/core';
import { Store } from '@ngxs/store';
import { Popover } from 'primeng/popover';
import { HabitStateSelectors } from '@habits/state/habit.selector';
import { HabitEntryStateSelectors } from '@habit-entries/state/habit-entry.selector';
import { currentWeek } from '@dashboard/lib/dashboard-day';
import { streakSummary } from '@habits/lib/habit-streaks';
import { localDay } from '@shared/lib/date/local-day';
import { StreakDetails } from '@habits/ui/streak-details/streak-details';

/**
 * "58 days" chip shown in every page header (Figma component "Streak chip").
 * Hover, or tap on touch screens, opens the full streak details.
 */
@Component({
  selector: 'app-streak-chip',
  imports: [Popover, StreakDetails],
  templateUrl: './streak-chip.html',
  styleUrl: './streak-chip.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StreakChip {
  private readonly _store = inject(Store);

  /** Tighter padding for the mobile top bar. */
  public readonly $compact = input(false, { alias: 'compact' });

  private readonly _$habits = this._store.selectSignal(HabitStateSelectors.getSlices.habits);
  private readonly _$entries = this._store.selectSignal(HabitEntryStateSelectors.getSlices.habitEntries);
  private readonly _today = localDay(new Date());

  protected readonly $summary = computed(() => streakSummary(this._$habits(), this._$entries(), this._today));
  protected readonly $week = computed(() => currentWeek(this._$habits(), this._$entries(), this._today));
  protected readonly $days = computed(() => this.$summary().partial.current);

  // Data comes from the store; the app shell loads habits and entries once.
  private readonly _popover = viewChild.required(Popover);
  /** No content padding: the body below owns it, so hovering anywhere on the popover keeps it open. */
  protected readonly popoverTokens = { content: { padding: '0' } };

  /** Time to move the pointer from the chip onto the popover (or back) before it closes. */
  private static readonly HIDE_DELAY_MS = 150;
  private _hideTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => this._cancelHide());
  }

  protected onPointerEnter(event: PointerEvent): void {
    if (event.pointerType === 'mouse') {
      this._cancelHide();
      this._popover().show(event);
    }
  }

  /** Leaving the chip or the popover: close unless the pointer arrives on the other one. */
  protected onPointerLeave(event: PointerEvent): void {
    if (event.pointerType === 'mouse') {
      this._cancelHide();
      this._hideTimer = setTimeout(() => this._popover().hide(), StreakChip.HIDE_DELAY_MS);
    }
  }

  /** Pointer on the popover itself: keep it open. */
  protected onPopoverEnter(event: PointerEvent): void {
    if (event.pointerType === 'mouse') {
      this._cancelHide();
    }
  }

  private _cancelHide(): void {
    if (this._hideTimer !== null) {
      clearTimeout(this._hideTimer);
      this._hideTimer = null;
    }
  }

  /**
   * With a mouse, hover drives the popover and the click is ignored. Touch, pen and keyboard
   * (Enter / Space report an empty pointer type) toggle it instead.
   */
  protected onClick(event: PointerEvent): void {
    if (event.pointerType !== 'mouse') {
      this._popover().toggle(event);
    }
  }
}
