import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { LoginRequest } from '@auth/requests/login.request';
import { LoginResponse } from '@auth/responses/login.response';
import { environment } from '@environment';
import { RegisterRequest } from '@auth/requests/register.request';
import { RegisterResponse } from '@auth/responses/register.response';
import { RefreshResponse } from '@auth/responses/refresh.response';

@Injectable({
  providedIn: 'root',
})
export class AuthApi {
  private readonly _http = inject(HttpClient);

  private readonly _baseUrl = environment.apiUrl;

  public login(request: LoginRequest): Observable<LoginResponse> {
    return this._http.post<LoginResponse>(
      `${this._baseUrl}/auth/login`,
      request,
    );
  }

  public register(request: RegisterRequest): Observable<RegisterResponse> {
    return this._http.post<RegisterResponse>(
      `${this._baseUrl}/auth/register`,
      request,
    );
  }

  public refresh(): Observable<RefreshResponse> {
    return this._http.post<RefreshResponse>(
      `${this._baseUrl}/auth/refresh`,
      {},
    );
  }

  public logout(): Observable<void> {
    return this._http.post<void>(`${this._baseUrl}/auth/logout`, {});
  }
}
