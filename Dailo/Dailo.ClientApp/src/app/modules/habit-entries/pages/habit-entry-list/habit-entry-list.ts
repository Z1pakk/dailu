import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { DataView } from 'primeng/dataview';
import { Store } from '@ngxs/store';
import { HabitEntryGetHabitEntries } from '@habit-entries/state/habit-entry.action';
import { HabitEntryStateSelectors } from '@habit-entries/state/habit-entry.selector';
import { HabitEntryListItem } from '@habit-entries/pages/habit-entry-list/ui/habit-entry-list-item/habit-entry-list-item';
import { Button } from 'primeng/button';
import { DialogService } from 'primeng/dynamicdialog';
import { HabitEntryAdd } from '@habit-entries/pages/habit-entry-add/habit-entry-add';
import { HabitEntryAddModalFooter } from '@habit-entries/pages/habit-entry-add/habit-entry-add-modal-footer';
import { HabitEntryEdit } from '@habit-entries/pages/habit-entry-edit/habit-entry-edit';
import { HabitEntryEditModalFooter } from '@habit-entries/pages/habit-entry-edit/habit-entry-edit-modal-footer';
import { HabitEntryModel } from '@habit-entries/models/habit-entry.model';

@Component({
  selector: 'app-habit-entry-list',
  imports: [DataView, Button, HabitEntryListItem],
  templateUrl: './habit-entry-list.html',
  styleUrl: './habit-entry-list.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HabitEntryList implements OnInit {
  private readonly _store = inject(Store);
  private readonly _dialogService = inject(DialogService);

  protected readonly $habitEntries = this._store.selectSignal(
    HabitEntryStateSelectors.getSlices.habitEntries,
  );

  ngOnInit() {
    this._store.dispatch(new HabitEntryGetHabitEntries());
  }

  protected addHabitEntry() {
    this._dialogService.open(HabitEntryAdd, {
      header: 'Create a new entry',
      width: '40rem',
      modal: true,
      closable: true,
      dismissableMask: false,
      keepInViewport: true,
      data: { $isFormValid: signal(false) },
      templates: {
        footer: HabitEntryAddModalFooter,
      },
    });
  }

  protected editHabitEntry(entry: HabitEntryModel) {
    this._dialogService.open(HabitEntryEdit, {
      header: 'Edit entry',
      width: '40rem',
      modal: true,
      closable: true,
      dismissableMask: false,
      keepInViewport: true,
      data: { entry, $isFormValid: signal(false) },
      templates: {
        footer: HabitEntryEditModalFooter,
      },
    });
  }
}