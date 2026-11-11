import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '@environment';
import { Observable } from 'rxjs';
import { GetUserProfileResponseModel } from '@user-profile/models/responses/get-user-profile.response';
import { UpdateUserProfileRequestModel } from '@user-profile/models/requests/update-user-profile.request';

@Injectable({
  providedIn: 'root',
})
export class UserProfileApi {
  private readonly _http = inject(HttpClient);

  private readonly baseUrl = environment.apiUrl;

  public get(): Observable<GetUserProfileResponseModel> {
    return this._http.get<GetUserProfileResponseModel>(
      `${this.baseUrl}/habit-user/profile`,
    );
  }

  public update(payload: UpdateUserProfileRequestModel): Observable<void> {
    return this._http.put<void>(`${this.baseUrl}/habit-user/profile`, payload);
  }
}
