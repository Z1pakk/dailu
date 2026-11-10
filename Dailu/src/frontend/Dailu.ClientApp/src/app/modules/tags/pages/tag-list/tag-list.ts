import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Store } from '@ngxs/store';
import { Button } from 'primeng/button';
import { IconField } from 'primeng/iconfield';
import { InputIcon } from 'primeng/inputicon';
import { InputText } from 'primeng/inputtext';
import { Tooltip } from 'primeng/tooltip';
import { TagFetchTags } from '@tags/state/tag.action';
import { TagStateSelectors } from '@tags/state/tag.selector';
import { tagCards, tagLabel, tagsSummary } from '@tags/lib/tag-cards';
import { TagCreateCard } from '@tags/ui/tag-create-card/tag-create-card';
import { HabitStateSelectors } from '@habits/state/habit.selector';
import { HabitEntryStateSelectors } from '@habit-entries/state/habit-entry.selector';
import { StreakChip } from '@habits/ui/streak-chip/streak-chip';
import { CoachButton } from '@shared/ui/coach-button/coach-button';
import { localDay } from '@shared/lib/date/local-day';

const RING_RADIUS = 32;

/** Tags (Figma `76:4750` desktop, `78:4786` mobile). Habits and entries are loaded by the layout. */
@Component({
  selector: 'app-tag-list',
  imports: [FormsModule, Button, IconField, InputIcon, InputText, Tooltip, StreakChip, CoachButton, TagCreateCard],
  templateUrl: './tag-list.html',
  styleUrl: './tag-list.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TagList implements OnInit {
  private readonly _store = inject(Store);

  private readonly _$tags = this._store.selectSignal(TagStateSelectors.getSlices.tags);
  private readonly _$habits = this._store.selectSignal(HabitStateSelectors.getSlices.habits);
  private readonly _$entries = this._store.selectSignal(HabitEntryStateSelectors.getSlices.habitEntries);
  private readonly _today = localDay(new Date());
  private readonly _createCard = viewChild.required(TagCreateCard);

  protected readonly ringRadius = RING_RADIUS;
  protected readonly ringLength = 2 * Math.PI * RING_RADIUS;
  protected readonly tagLabel = tagLabel;

  protected readonly $query = signal('');
  protected readonly $cards = computed(() => tagCards(this._$tags(), this._$habits(), this._$entries(), this._today, this.$query()));
  protected readonly $summary = computed(() => tagsSummary(tagCards(this._$tags(), this._$habits(), [], this._today)));

  ngOnInit(): void {
    this._store.dispatch(new TagFetchTags());
  }

  protected ringOffset(percent: number | null): number {
    return this.ringLength * (1 - (percent ?? 0) / 100);
  }

  protected newTag(): void {
    this._createCard().focus();
  }
}
