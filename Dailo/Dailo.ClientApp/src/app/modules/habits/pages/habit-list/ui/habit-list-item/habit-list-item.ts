import {
  ChangeDetectionStrategy,
  Component,
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

@Component({
  selector: 'app-habit-list-item',
  imports: [DatePipe, Button, Menu, Tag, Popover],
  templateUrl: './habit-list-item.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HabitListItem {
  readonly habit = input.required<HabitModel>();
  readonly edit = output<void>();

  protected readonly automationSourceLabels = automationSourceLabels;

  protected readonly frequencyTypesLabels = frequencyTypesLabels;

  protected readonly actionsItems: MenuItem[] = [
    { label: 'Edit', icon: 'pi pi-pencil', command: () => this.edit.emit() },
    { label: 'Delete', icon: 'pi pi-trash' },
  ];
}
