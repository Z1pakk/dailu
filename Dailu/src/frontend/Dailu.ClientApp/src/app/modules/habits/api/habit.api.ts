import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '@environment';
import { Observable } from 'rxjs';
import { GetHabitsResponseModel } from '@habits/models/responses/get-habits.response';
import { CreateHabitRequestModel } from '@habits/models/requests/create-habit.request';
import { UpdateHabitRequestModel } from '@habits/models/requests/update-habit.request';

@Injectable({
  providedIn: 'root',
})
export class HabitApi {
  private readonly _http = inject(HttpClient);

  private readonly baseUrl = environment.apiUrl;

  public get(): Observable<GetHabitsResponseModel> {
    return this._http.get<GetHabitsResponseModel>(`${this.baseUrl}/habits`);
  }

  public create(payload: CreateHabitRequestModel): Observable<void> {
    return this._http.post<void>(`${this.baseUrl}/habits`, payload);
  }

  public update(
    id: string,
    payload: UpdateHabitRequestModel,
  ): Observable<void> {
    return this._http.put<void>(`${this.baseUrl}/habits/${id}`, payload);
  }
}
