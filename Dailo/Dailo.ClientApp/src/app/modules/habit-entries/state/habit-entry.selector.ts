import { createPropertySelectors } from '@ngxs/store';
import { HabitEntryState, HabitEntryStateModel } from '@habit-entries/state/habit-entry.state';

export class HabitEntryStateSelectors {
  static readonly getSlices = createPropertySelectors<HabitEntryStateModel>(HabitEntryState);
}