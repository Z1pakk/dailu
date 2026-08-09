import { createPropertySelectors } from '@ngxs/store';
import { HabitState, HabitStateModel } from '@habits/state/habit.state';

export class HabitStateSelectors {
  static readonly getSlices =
    createPropertySelectors<HabitStateModel>(HabitState);
}
