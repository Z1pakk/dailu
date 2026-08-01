import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { InputText } from 'primeng/inputtext';
import { Textarea } from 'primeng/textarea';
import { Select } from 'primeng/select';
import { habitTypeSelectItems } from '@habits/enums/habit-type.enum';
import { HabitFormGroup } from '@habits/types/habit-form.type';

@Component({
  selector: 'app-habit-general-step',
  imports: [ReactiveFormsModule, InputText, Textarea, Select],
  templateUrl: './habit-general-step.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HabitGeneralStep {
  readonly formGroup = input.required<HabitFormGroup>();

  protected readonly habitTypeSelectItems = habitTypeSelectItems;
}
