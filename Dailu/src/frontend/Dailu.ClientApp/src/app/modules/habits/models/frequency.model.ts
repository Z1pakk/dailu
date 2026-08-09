import { FrequencyType } from '@habits/enums/frequency-type.enum';

export interface FrequencyModel {
  type: FrequencyType;
  timesPerPeriod: number;
}
