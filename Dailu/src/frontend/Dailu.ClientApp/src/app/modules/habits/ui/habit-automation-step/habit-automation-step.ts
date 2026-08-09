import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { Select } from 'primeng/select';
import { MultiSelect } from 'primeng/multiselect';
import { Checkbox } from 'primeng/checkbox';
import {
  automationSourceSelectItems,
  automationSources,
} from '@habits/enums/automation-source.enum';
import { githubEventTypeSelectItems } from '@habits/enums/github-event-type.enum';
import { stravaActivityTypeSelectItems } from '@habits/enums/strava-activity-type.enum';
import { googleHealthMetricSelectItems } from '@habits/enums/google-health-metric.enum';
import { HabitFormGroup } from '@habits/types/habit-form.type';
import { SelectItem } from '@shared/lib/select-item/select-item.type';

@Component({
  selector: 'app-habit-automation-step',
  imports: [ReactiveFormsModule, Select, MultiSelect, Checkbox],
  templateUrl: './habit-automation-step.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HabitAutomationStep {
  readonly formGroup = input.required<HabitFormGroup>();
  readonly githubRepoSelectItems = input.required<SelectItem<number>[]>();
  readonly githubReposLoading = input<boolean>(false);

  protected readonly automationSourceSelectItems = automationSourceSelectItems;
  protected readonly automationSources = automationSources;
  protected readonly githubEventTypeSelectItems = githubEventTypeSelectItems;
  protected readonly stravaActivityTypeSelectItems = stravaActivityTypeSelectItems;
  protected readonly googleHealthMetricSelectItems = googleHealthMetricSelectItems;

  protected onGithubRepoChange(repositoryId: number | null) {
    const repo = this.githubRepoSelectItems().find(
      (item) => item.value === repositoryId,
    );
    this.formGroup().controls.githubRepositoryId.setValue(repositoryId);
    this.formGroup().controls.githubRepositoryName.setValue(
      repo?.label ?? null,
    );
  }
}
