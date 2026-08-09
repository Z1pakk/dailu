import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  OnInit,
} from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { HabitEntryEditFacadeService } from '@habit-entries/pages/habit-entry-edit/habit-entry-edit-facade.service';
import { DynamicDialogConfig } from 'primeng/dynamicdialog';
import { HabitEntryEditModalData } from '@habit-entries/pages/habit-entry-edit/type/habit-entry-edit-modal.type';
import { habitTypes } from '@habits/enums/habit-type.enum';
import { InputNumber } from 'primeng/inputnumber';
import { Textarea } from 'primeng/textarea';
import { DatePicker } from 'primeng/datepicker';
import { ToggleSwitch } from 'primeng/toggleswitch';

@Component({
  selector: 'app-habit-entry-edit',
  imports: [ReactiveFormsModule, InputNumber, Textarea, DatePicker, ToggleSwitch],
  providers: [HabitEntryEditFacadeService],
  templateUrl: './habit-entry-edit.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HabitEntryEdit implements OnInit {
  private readonly _config = inject<DynamicDialogConfig<HabitEntryEditModalData>>(
    DynamicDialogConfig<HabitEntryEditModalData>,
  );
  private readonly _habitEntryEditService = inject(HabitEntryEditFacadeService);

  private get _data(): HabitEntryEditModalData {
    return this._config.data!;
  }

  protected readonly today = new Date();
  protected readonly habitTypes = habitTypes;
  protected readonly editHabitEntryForm = this._habitEntryEditService.editHabitEntryForm;

  protected get entry() {
    return this._data.entry;
  }

  constructor() {
    effect(() => {
      this._data.$isFormValid.set(this._habitEntryEditService.$isFormValid());
    });
    this._data.submit = () =>
      this._habitEntryEditService.updateHabitEntry(this._data.entry.id);
  }

  ngOnInit() {
    this._habitEntryEditService.initForm(this._data.entry);
  }
}
