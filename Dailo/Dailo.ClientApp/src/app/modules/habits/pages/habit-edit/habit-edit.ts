import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  OnInit,
} from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { HabitEditFacadeService } from '@habits/pages/habit-edit/habit-edit-facade.service';
import { DynamicDialogConfig } from 'primeng/dynamicdialog';
import { HabitEditModalData } from '@habits/pages/habit-edit/type/habit-edit-modal.type';
import { InputText } from 'primeng/inputtext';
import { Textarea } from 'primeng/textarea';
import { Select } from 'primeng/select';
import { MultiSelect } from 'primeng/multiselect';
import { habitTypeSelectItems } from '@habits/enums/habit-type.enum';
import { frequencyTypeSelectItems } from '@habits/enums/frequency-type.enum';
import { automationSourceSelectItems } from '@habits/enums/automation-source.enum';
import { InputNumber } from 'primeng/inputnumber';
import { DatePicker } from 'primeng/datepicker';
import { Store } from '@ngxs/store';
import { TagGetTags } from '@tags/state/tag.action';

@Component({
  selector: 'app-habit-edit',
  imports: [
    ReactiveFormsModule,
    InputText,
    Textarea,
    Select,
    MultiSelect,
    InputNumber,
    DatePicker,
  ],
  providers: [HabitEditFacadeService],
  templateUrl: './habit-edit.html',
  styleUrl: './habit-edit.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HabitEdit implements OnInit {
  private readonly _store = inject(Store);
  private readonly _config = inject<DynamicDialogConfig<HabitEditModalData>>(
    DynamicDialogConfig<HabitEditModalData>,
  );
  private readonly _habitEditService = inject(HabitEditFacadeService);

  private get _data(): HabitEditModalData {
    return this._config.data!;
  }

  protected readonly habitTypeSelectItems = habitTypeSelectItems;
  protected readonly frequencyTypeSelectItems = frequencyTypeSelectItems;
  protected readonly automationSourceSelectItems = automationSourceSelectItems;
  protected readonly today = new Date();
  protected readonly $tagSelectItems = this._habitEditService.$tagSelectItems;
  protected readonly editHabitForm = this._habitEditService.editHabitForm;

  constructor() {
    effect(() => {
      this._data.$isFormValid.set(this._habitEditService.$isFormValid());
    });
    this._data.submit = () => this._habitEditService.updateHabit();
  }

  ngOnInit() {
    this._store.dispatch(new TagGetTags());
  }
}
