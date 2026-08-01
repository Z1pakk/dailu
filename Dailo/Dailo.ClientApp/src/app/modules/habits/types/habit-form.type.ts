import { FormControl, FormGroup } from '@angular/forms';
import { HabitType } from '@habits/enums/habit-type.enum';
import { FrequencyType } from '@habits/enums/frequency-type.enum';
import { AutomationSource } from '@habits/enums/automation-source.enum';
import { GithubEventType } from '@habits/enums/github-event-type.enum';
import { StravaActivityType } from '@habits/enums/strava-activity-type.enum';
import { GoogleHealthMetric } from '@habits/enums/google-health-metric.enum';

export type HabitFormFields = {
  name: FormControl<string>;
  description: FormControl<string>;
  type: FormControl<HabitType>;
  frequencyType: FormControl<FrequencyType>;
  frequencyTimesPerPeriod: FormControl<number>;
  targetValue: FormControl<number>;
  targetUnit: FormControl<string>;
  endDate: FormControl<Date | null>;
  milestoneTarget: FormControl<number | null>;
  tagIds: FormControl<string[]>;
  automationSource: FormControl<AutomationSource | null>;
  githubRepositoryId: FormControl<number | null>;
  githubRepositoryName: FormControl<string | null>;
  githubEventTypes: FormControl<GithubEventType[]>;
  stravaActivityTypes: FormControl<StravaActivityType[]>;
  googleHealthMetrics: FormControl<GoogleHealthMetric[]>;
};

export type HabitFormGroup = FormGroup<HabitFormFields>;
