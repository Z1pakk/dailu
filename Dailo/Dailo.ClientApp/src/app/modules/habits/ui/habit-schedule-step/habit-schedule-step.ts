import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { InputText } from 'primeng/inputtext';
import { Select } from 'primeng/select';
import { InputNumber } from 'primeng/inputnumber';
import { DatePicker } from 'primeng/datepicker';
import { frequencyTypeSelectItems } from '@habits/enums/frequency-type.enum';
import { HabitFormGroup } from '@habits/types/habit-form.type';

@Component({
  selector: 'app-habit-schedule-step',
  imports: [ReactiveFormsModule, InputText, Select, InputNumber, DatePicker],
  templateUrl: './habit-schedule-step.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HabitScheduleStep {
  readonly formGroup = input.required<HabitFormGroup>();

  protected readonly frequencyTypeSelectItems = frequencyTypeSelectItems;
  protected readonly today = new Date();
}
