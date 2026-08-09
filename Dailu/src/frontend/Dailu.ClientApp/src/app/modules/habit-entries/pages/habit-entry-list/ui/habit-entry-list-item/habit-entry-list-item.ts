import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { getHours, getMinutes, getSeconds, parseISO } from 'date-fns';
import { Tag } from 'primeng/tag';
import { Button } from 'primeng/button';
import { HabitEntryModel } from '@habit-entries/models/habit-entry.model';
import { habitEntrySourceLabels } from '@habit-entries/enums/habit-entry-source.enum';
import { habitTypes } from '@habits/enums/habit-type.enum';
import { DialogService } from 'primeng/dynamicdialog';
import { HabitEntryEdit } from '@habit-entries/pages/habit-entry-edit/habit-entry-edit';
import { HabitEntryEditModalFooter } from '@habit-entries/pages/habit-entry-edit/habit-entry-edit-modal-footer';

@Component({
  selector: 'app-habit-entry-list-item',
  imports: [DatePipe, Tag, Button],
  templateUrl: './habit-entry-list-item.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HabitEntryListItem {
  private readonly _dialogService = inject(DialogService);

  readonly habitEntry = input.required<HabitEntryModel>();

  protected readonly habitEntrySourceLabels = habitEntrySourceLabels;
  protected readonly habitTypes = habitTypes;

  protected readonly $completedAtFormat = computed(() => {
    const date = parseISO(this.habitEntry().completedAtUtc);
    const hasTime =
      getHours(date) !== 0 || getMinutes(date) !== 0 || getSeconds(date) !== 0;
    return hasTime ? 'dd/MM/yyyy HH:mm' : 'dd/MM/yyyy';
  });

  protected edit() {
    this._dialogService.open(HabitEntryEdit, {
      header: 'Edit entry',
      width: '40rem',
      modal: true,
      closable: true,
      dismissableMask: false,
      keepInViewport: true,
      data: { entry: this.habitEntry(), $isFormValid: signal(false) },
      templates: {
        footer: HabitEntryEditModalFooter,
      },
    });
  }
}
