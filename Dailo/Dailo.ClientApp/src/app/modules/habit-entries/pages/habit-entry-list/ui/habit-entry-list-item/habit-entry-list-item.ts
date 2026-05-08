import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Tag } from 'primeng/tag';
import { HabitEntryModel } from '@habit-entries/models/habit-entry.model';
import { habitEntrySourceLabels } from '@habit-entries/enums/habit-entry-source.enum';

@Component({
  selector: 'app-habit-entry-list-item',
  imports: [DatePipe, Tag],
  templateUrl: './habit-entry-list-item.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HabitEntryListItem {
  readonly habitEntry = input.required<HabitEntryModel>();

  protected readonly habitEntrySourceLabels = habitEntrySourceLabels;
}