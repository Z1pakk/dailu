import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { Store } from '@ngxs/store';
import { DialogService } from 'primeng/dynamicdialog';
import { Button } from 'primeng/button';
import { Tag } from 'primeng/tag';
import { HabitStateSelectors } from '@habits/state/habit.selector';
import { HabitGetHabits } from '@habits/state/habit.action';
import { HabitEntryAdd } from '@habit-entries/pages/habit-entry-add/habit-entry-add';
import { HabitEntryAddModalFooter } from '@habit-entries/pages/habit-entry-add/habit-entry-add-modal-footer';
import { HabitModel } from '@habits/models/habit.model';
import { habitTypes } from '@habits/enums/habit-type.enum';

@Component({
  selector: 'app-quick-entries',
  imports: [Button, Tag],
  templateUrl: './quick-entries.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QuickEntries implements OnInit {
  private readonly _store = inject(Store);
  private readonly _dialogService = inject(DialogService);

  private readonly _$allHabits = this._store.selectSignal(HabitStateSelectors.getSlices.habits);

  protected readonly $habits = computed(() =>
    this._$allHabits().filter((h) => !h.isArchived),
  );

  protected readonly habitTypes = habitTypes;

  ngOnInit() {
    this._store.dispatch(new HabitGetHabits());
  }

  protected addEntry(habit: HabitModel) {
    this._dialogService.open(HabitEntryAdd, {
      header: `Add entry — ${habit.name}`,
      width: '40rem',
      modal: true,
      closable: true,
      dismissableMask: false,
      keepInViewport: true,
      data: { $isFormValid: signal(false), habitId: habit.id },
      templates: { footer: HabitEntryAddModalFooter },
    });
  }
}
