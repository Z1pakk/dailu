import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  OnInit,
} from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { HabitAddFacadeService } from '@habits/pages/habit-add/habit-add-facade.service';
import { DynamicDialogConfig } from 'primeng/dynamicdialog';
import { HabitAddModalData } from '@habits/pages/habit-add/type/habit-add-modal.type';
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
  selector: 'app-habit-add',
  imports: [
    ReactiveFormsModule,
    InputText,
    Textarea,
    Select,
    MultiSelect,
    InputNumber,
    DatePicker,
  ],
  providers: [HabitAddFacadeService],
  templateUrl: './habit-add.html',
  styleUrl: './habit-add.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HabitAdd implements OnInit {
  private readonly _store = inject(Store);
  private readonly _config = inject<DynamicDialogConfig<HabitAddModalData>>(
    DynamicDialogConfig<HabitAddModalData>,
  );
  private readonly _habitAddService = inject(HabitAddFacadeService);

  private get _data(): HabitAddModalData {
    return this._config.data!;
  }

  protected readonly habitTypeSelectItems = habitTypeSelectItems;
  protected readonly frequencyTypeSelectItems = frequencyTypeSelectItems;
  protected readonly automationSourceSelectItems = automationSourceSelectItems;
  protected readonly today = new Date();
  protected readonly $tagSelectItems = this._habitAddService.$tagSelectItems;

  protected readonly addHabitForm = this._habitAddService.addHabitForm;

  constructor() {
    effect(() => {
      this._data.$isFormValid.set(this._habitAddService.$isFormValid());
    });
    this._data.submit = () => this._habitAddService.createHabit();
  }

  ngOnInit() {
    this._store.dispatch(new TagGetTags());
  }
}
