import { inject, Injectable } from '@angular/core';
import { Action, State, StateContext } from '@ngxs/store';
import { HabitModel } from '@habits/models/habit.model';
import {
  HabitCreateHabit,
  HabitFetchHabits,
  HabitGetHabits,
  HabitUpdateHabit,
} from '@habits/state/habit.action';
import { HabitApi } from '@habits/api/habit.api';
import { finalize, of, tap } from 'rxjs';

export interface HabitStateModel {
  isLoading: boolean;
  habits: HabitModel[];
}

const defaultState: HabitStateModel = {
  isLoading: false,
  habits: [],
};

@Injectable()
@State<HabitStateModel>({
  name: 'habits',
  defaults: defaultState,
})
export class HabitState {
  private readonly _api = inject(HabitApi);

  @Action(HabitGetHabits)
  public getHabits(ctx: StateContext<HabitStateModel>, action: HabitGetHabits) {
    const { habits } = ctx.getState();
    if (habits.length > 0) {
      return of(habits);
    }

    return ctx.dispatch(new HabitFetchHabits());
  }

  @Action(HabitFetchHabits)
  public fetchHabits(
    ctx: StateContext<HabitStateModel>,
    action: HabitFetchHabits,
  ) {
    ctx.patchState({
      isLoading: true,
    });

    return this._api.get().pipe(
      tap({
        next: (response) => {
          ctx.patchState({
            habits: response.habits,
          });
        },
      }),
      finalize(() => ctx.patchState({ isLoading: false })),
    );
  }

  @Action(HabitCreateHabit)
  public createHabit(
    ctx: StateContext<HabitStateModel>,
    action: HabitCreateHabit,
  ) {
    ctx.patchState({ isLoading: true });

    return this._api
      .create(action.payload)
      .pipe(finalize(() => ctx.patchState({ isLoading: false })));
  }

  @Action(HabitUpdateHabit)
  public updateHabit(
    ctx: StateContext<HabitStateModel>,
    action: HabitUpdateHabit,
  ) {
    ctx.patchState({ isLoading: true });

    return this._api
      .update(action.id, action.payload)
      .pipe(finalize(() => ctx.patchState({ isLoading: false })));
  }
}
