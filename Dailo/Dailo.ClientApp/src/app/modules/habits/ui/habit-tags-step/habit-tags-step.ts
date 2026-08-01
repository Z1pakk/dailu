import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { MultiSelect } from 'primeng/multiselect';
import { HabitFormGroup } from '@habits/types/habit-form.type';
import { SelectItem } from '@shared/lib/select-item/select-item.type';

@Component({
  selector: 'app-habit-tags-step',
  imports: [ReactiveFormsModule, MultiSelect],
  templateUrl: './habit-tags-step.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HabitTagsStep {
  readonly formGroup = input.required<HabitFormGroup>();
  readonly tagSelectItems = input.required<SelectItem[]>();
}
