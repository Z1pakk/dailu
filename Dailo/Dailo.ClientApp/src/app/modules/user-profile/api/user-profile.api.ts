import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '@environment';
import { Observable } from 'rxjs';
import { GetUserProfileResponseModel } from '@user-profile/models/responses/get-user-profile.response';
import { GetIntegrationConfigsResponseModel } from '@user-profile/models/responses/get-integration-configs.response';
import { UpdateUserProfileRequestModel } from '@user-profile/models/requests/update-user-profile.request';
import { IntegrationConfig } from '@user-profile/models/integration-config.model';
import { GitHubUserProfileModel } from '@user-profile/models/github-user-profile.model';

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

  public getIntegrationConfigs(): Observable<GetIntegrationConfigsResponseModel> {
    return this._http.get<GetIntegrationConfigsResponseModel>(
      `${this.baseUrl}/habit-user/integrations`,
    );
  }

  public saveIntegrationConfig(config: IntegrationConfig): Observable<void> {
    return this._http.put<void>(`${this.baseUrl}/habit-user/integrations`, config);
  }

  public revokeIntegrationConfig(provider: string): Observable<void> {
    return this._http.delete<void>(`${this.baseUrl}/habit-user/integrations/${provider}`);
  }

  public getGithubProfile(): Observable<{ profile: GitHubUserProfileModel }> {
    return this._http.get<{ profile: GitHubUserProfileModel }>(
      `${this.baseUrl}/habit-user/integrations/github/profile`,
    );
  }
}
