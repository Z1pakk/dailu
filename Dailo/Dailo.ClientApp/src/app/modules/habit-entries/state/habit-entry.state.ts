import { inject, Injectable } from '@angular/core';
import { Action, State, StateContext } from '@ngxs/store';
import { HabitEntryModel } from '@habit-entries/models/habit-entry.model';
import { HabitEntryCreateHabitEntry, HabitEntryGetHabitEntries } from '@habit-entries/state/habit-entry.action';
import { HabitEntryApi } from '@habit-entries/api/habit-entry.api';
import { finalize, tap } from 'rxjs';

export interface HabitEntryStateModel {
  isLoading: boolean;
  habitEntries: HabitEntryModel[];
}

const defaultState: HabitEntryStateModel = { isLoading: false, habitEntries: [] };

@Injectable()
@State<HabitEntryStateModel>({ name: 'habitEntries', defaults: defaultState })
export class HabitEntryState {
  private readonly _api = inject(HabitEntryApi);

  @Action(HabitEntryGetHabitEntries)
  public getHabitEntries(ctx: StateContext<HabitEntryStateModel>) {
    ctx.patchState({ isLoading: true });
    return this._api.get().pipe(
      tap({ next: (response) => { ctx.patchState({ habitEntries: response.habitEntries }); } }),
      finalize(() => ctx.patchState({ isLoading: false })),
    );
  }

  @Action(HabitEntryCreateHabitEntry)
  public createHabitEntry(ctx: StateContext<HabitEntryStateModel>, action: HabitEntryCreateHabitEntry) {
    ctx.patchState({ isLoading: true });
    return this._api.create(action.payload).pipe(finalize(() => ctx.patchState({ isLoading: false })));
  }
}