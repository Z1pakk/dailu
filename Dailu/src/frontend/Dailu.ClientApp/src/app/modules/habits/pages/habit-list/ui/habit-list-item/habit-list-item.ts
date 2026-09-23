import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { Button } from 'primeng/button';
import { Menu } from 'primeng/menu';
import { Tag } from 'primeng/tag';
import { Popover } from 'primeng/popover';
import { MenuItem } from 'primeng/api';
import { HabitModel } from '@habits/models/habit.model';
import { frequencyTypesLabels } from '@habits/enums/frequency-type.enum';
import { automationSourceLabels } from '@habits/enums/automation-source.enum';
import { habitTypes } from '@habits/enums/habit-type.enum';
import { HabitEntryModel } from '@habit-entries/models/habit-entry.model';
import { getRecentTrendValues } from '@habit-entries/lib/get-recent-trend-values';
import { Sparkline } from '@shared/ui/sparkline/sparkline';

@Component({
  selector: 'app-habit-list-item',
  imports: [DatePipe, Button, Menu, Tag, Popover, Sparkline],
  templateUrl: './habit-list-item.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HabitListItem {
  readonly habit = input.required<HabitModel>();
  readonly habitEntries = input<HabitEntryModel[]>([]);
  readonly edit = output<void>();

  protected readonly automationSourceLabels = automationSourceLabels;

  protected readonly frequencyTypesLabels = frequencyTypesLabels;

  protected readonly $isMeasurable = computed(
    () => this.habit().type === habitTypes.measurable,
  );

  protected readonly $trendValues = computed(() =>
    getRecentTrendValues(this.habitEntries(), this.habit().id),
  );

  protected readonly actionsItems: MenuItem[] = [
    { label: 'Edit', icon: 'pi pi-pencil', command: () => this.edit.emit() },
    { label: 'Delete', icon: 'pi pi-trash' },
  ];
}
