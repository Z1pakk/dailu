import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { DataView } from 'primeng/dataview';
import { Store } from '@ngxs/store';
import { HabitFetchHabits } from '@habits/state/habit.action';
import { HabitStateSelectors } from '@habits/state/habit.selector';
import { Button } from 'primeng/button';
import { DialogService } from 'primeng/dynamicdialog';
import { HabitAdd } from '@habits/pages/habit-add/habit-add';
import { HabitAddModalFooter } from '@habits/pages/habit-add/habit-add-modal-footer';
import { HabitEdit } from '@habits/pages/habit-edit/habit-edit';
import { HabitEditModalFooter } from '@habits/pages/habit-edit/habit-edit-modal-footer';
import { HabitListItem } from '@habits/pages/habit-list/ui/habit-list-item/habit-list-item';
import { HabitModel } from '@habits/models/habit.model';

@Component({
  selector: 'dailo',
  imports: [DataView, Button, HabitListItem],
  templateUrl: './habit-list.html',
  styleUrl: './habit-list.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HabitList implements OnInit {
  private readonly _store = inject(Store);
  private readonly _dialogService = inject(DialogService);

  protected readonly $habits = this._store.selectSignal(
    HabitStateSelectors.getSlices.habits,
  );

  ngOnInit() {
    this._store.dispatch(new HabitFetchHabits());
  }

  protected addHabit() {
    this._dialogService.open(HabitAdd, {
      header: 'Create a new habit',
      width: '40rem',
      modal: true,
      closable: true,
      dismissableMask: false,
      keepInViewport: true,
      data: { $isFormValid: signal(false) },
      templates: {
        footer: HabitAddModalFooter,
      },
    });
  }

  protected editHabit(habit: HabitModel) {
    this._dialogService.open(HabitEdit, {
      header: 'Edit habit',
      width: '40rem',
      modal: true,
      closable: true,
      dismissableMask: false,
      keepInViewport: true,
      data: { habit, $isFormValid: signal(false) },
      templates: {
        footer: HabitEditModalFooter,
      },
    });
  }
}
