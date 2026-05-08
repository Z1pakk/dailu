import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  OnInit,
} from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { HabitEntryAddFacadeService } from '@habit-entries/pages/habit-entry-add/habit-entry-add-facade.service';
import { DynamicDialogConfig } from 'primeng/dynamicdialog';
import { HabitEntryAddModalData } from '@habit-entries/pages/habit-entry-add/type/habit-entry-add-modal.type';
import { Select } from 'primeng/select';
import { InputNumber } from 'primeng/inputnumber';
import { Textarea } from 'primeng/textarea';
import { DatePicker } from 'primeng/datepicker';
import { Store } from '@ngxs/store';
import { HabitGetHabits } from '@habits/state/habit.action';

@Component({
  selector: 'app-habit-entry-add',
  imports: [ReactiveFormsModule, Select, InputNumber, Textarea, DatePicker],
  providers: [HabitEntryAddFacadeService],
  templateUrl: './habit-entry-add.html',
  styleUrl: './habit-entry-add.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HabitEntryAdd implements OnInit {
  private readonly _store = inject(Store);
  private readonly _config = inject<DynamicDialogConfig<HabitEntryAddModalData>>(
    DynamicDialogConfig<HabitEntryAddModalData>,
  );
  private readonly _habitEntryAddService = inject(HabitEntryAddFacadeService);

  private get _data(): HabitEntryAddModalData {
    return this._config.data!;
  }

  protected readonly habitSelectItems = this._habitEntryAddService.$habitSelectItems;
  protected readonly $isBinaryHabit = this._habitEntryAddService.$isBinaryHabit;
  protected readonly $selectedHabitUnit = this._habitEntryAddService.$selectedHabitUnit;
  protected readonly today = new Date();

  protected readonly addHabitEntryForm = this._habitEntryAddService.addHabitEntryForm;

  constructor() {
    effect(() => {
      this._data.$isFormValid.set(this._habitEntryAddService.$isFormValid());
    });
    this._data.submit = () => this._habitEntryAddService.createHabitEntry();
  }

  ngOnInit() {
    this._store.dispatch(new HabitGetHabits());
  }
}