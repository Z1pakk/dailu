import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '@environment';
import { Observable } from 'rxjs';
import { GetHabitEntriesResponseModel } from '@habit-entries/models/responses/get-habit-entries.response';
import { CreateHabitEntryRequestModel } from '@habit-entries/models/requests/create-habit-entry.request';

@Injectable({ providedIn: 'root' })
export class HabitEntryApi {
  private readonly _http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl;

  public get(): Observable<GetHabitEntriesResponseModel> {
    return this._http.get<GetHabitEntriesResponseModel>(`${this.baseUrl}/habit-entries`);
  }

  public create(payload: CreateHabitEntryRequestModel): Observable<void> {
    return this._http.post<void>(`${this.baseUrl}/habit-entries`, payload);
  }
}