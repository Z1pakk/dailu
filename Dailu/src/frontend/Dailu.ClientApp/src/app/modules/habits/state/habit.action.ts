import { CreateHabitRequestModel } from '@habits/models/requests/create-habit.request';
import { UpdateHabitRequestModel } from '@habits/models/requests/update-habit.request';

const scope = '[Habit]';

/**
 * Get cached habits or fetch them
 */
export class HabitGetHabits {
  static readonly type = `${scope} GetHabits`;
}

/**
 * Fetch cases without caching
 */
export class HabitFetchHabits {
  static readonly type = `${scope} FetchHabits`;
}

export class HabitCreateHabit {
  static readonly type = `${scope} CreateHabit`;

  constructor(public payload: CreateHabitRequestModel) {}
}

export class HabitUpdateHabit {
  static readonly type = `${scope} UpdateHabit`;

  constructor(
    public id: string,
    public payload: UpdateHabitRequestModel,
  ) {}
}
