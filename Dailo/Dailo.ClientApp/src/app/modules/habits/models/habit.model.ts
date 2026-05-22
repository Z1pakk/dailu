import { FrequencyModel } from '@habits/models/frequency.model';
import { TargetModel } from '@habits/models/target.model';
import { HabitType } from '@habits/enums/habit-type.enum';
import { HabitStatus } from '@habits/enums/habit-status.enum';
import { AutomationSource } from '@habits/enums/automation-source.enum';
import { MilestoneModel } from '@habits/models/milestone.model';
import { TagModel } from '../../tags/models/tag.model';

export interface HabitModel {
  id: string;
  name: string;
  description?: string;
  type: HabitType;
  frequency: FrequencyModel;
  target: TargetModel;
  status: HabitStatus;
  isArchived: boolean;
  endDate?: Date;
  milestone?: MilestoneModel;
  automationSource?: AutomationSource;
  tags: TagModel[];

  createdAtUtc: Date;
  lastCompletedAtUtc: Date;
}
