import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '@environment';
import { GetTagsResponseModel } from '../models/responses/get-tags.response';
import { CreateTagRequestModel } from '../models/requests/create-tag.request';
import { httpContext } from '@shared/lib/api/context/http-request.context';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class TagApi {
  private readonly _http = inject(HttpClient);

  private readonly baseUrl = environment.apiUrl;

  public get(): Observable<GetTagsResponseModel> {
    return this._http.get<GetTagsResponseModel>(`${this.baseUrl}/tags`);
  }

  public create(payload: CreateTagRequestModel): Observable<void> {
    return this._http.post<void>(`${this.baseUrl}/tags`, payload, {
      context: httpContext().showErrorNotification(false).build(),
    });
  }
}
