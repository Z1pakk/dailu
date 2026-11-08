import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { HabitEntryModel } from '@habit-entries/models/habit-entry.model';
import { habitEntrySources } from '@habit-entries/enums/habit-entry-source.enum';
import { habitTypes } from '@habits/enums/habit-type.enum';

const SHOWN = 4;

/** Recent activity card (Figma `54:3015`): latest entries, newest first. */
@Component({
  selector: 'app-recent-activity-card',
  imports: [RouterLink, DatePipe],
  templateUrl: './recent-activity-card.html',
  styleUrl: './recent-activity-card.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecentActivityCard {
  public readonly $entries = input.required<readonly HabitEntryModel[]>({ alias: 'entries' });

  protected readonly $recent = computed(() =>
    this.$entries()
      .filter((e) => !e.isArchived)
      .sort((a, b) => b.completedAtUtc.localeCompare(a.completedAtUtc))
      .slice(0, SHOWN),
  );

  protected isAuto(entry: HabitEntryModel): boolean {
    return entry.source === habitEntrySources.automation;
  }

  protected detail(entry: HabitEntryModel): string {
    const who = this.isAuto(entry) ? 'automatic' : 'checked by you';
    return entry.habitType === habitTypes.measurable ? `${who} · ${entry.value}` : who;
  }
}
