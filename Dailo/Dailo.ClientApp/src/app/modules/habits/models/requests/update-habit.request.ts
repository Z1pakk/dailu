import { HabitType } from '@habits/enums/habit-type.enum';
import { AutomationSource } from '@habits/enums/automation-source.enum';
import { FrequencyModel } from '@habits/models/frequency.model';
import { TargetModel } from '@habits/models/target.model';
import { MilestoneModel } from '@habits/models/milestone.model';

export interface UpdateHabitRequestModel {
  name: string;
  description: string | null;
  type: HabitType;
  frequency: FrequencyModel;
  target: TargetModel;
  endDate: string | null;
  milestone: MilestoneModel | null;
  tagIds: string[];
  automationSource: AutomationSource | null;
}
