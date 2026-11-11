import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@environment';
import { GetIntegrationConfigsResponseModel } from '@integrations/models/responses/get-integration-configs.response';
import { GetIntegrationSyncLogsResponseModel } from '@integrations/models/responses/get-integration-sync-logs.response';
import { IntegrationProviderType } from '@integrations/models/integration-summary.model';
import { GitHubUserProfileModel } from '@integrations/models/github-user-profile.model';
import { GitHubRepositoryModel } from '@integrations/models/github-repository.model';
import { GoogleHealthUserProfileModel } from '@integrations/models/google-health-user-profile.model';

/** The backend keeps integrations in the habit-user module, hence the `/habit-user` prefix. */
@Injectable({
  providedIn: 'root',
})
export class IntegrationApi {
  private readonly _http = inject(HttpClient);

  private readonly baseUrl = `${environment.apiUrl}/habit-user/integrations`;

  public getSummaries(): Observable<GetIntegrationConfigsResponseModel> {
    return this._http.get<GetIntegrationConfigsResponseModel>(this.baseUrl);
  }

  public revoke(provider: IntegrationProviderType): Observable<void> {
    return this._http.delete<void>(`${this.baseUrl}/${provider}`);
  }

  public getSyncLogs(provider: IntegrationProviderType, take: number): Observable<GetIntegrationSyncLogsResponseModel> {
    return this._http.get<GetIntegrationSyncLogsResponseModel>(`${this.baseUrl}/${provider}/sync-logs`, {
      params: { take },
    });
  }

  public getConnectUrl(provider: IntegrationProviderType): Observable<{ authUrl: string }> {
    return this._http.get<{ authUrl: string }>(`${this.baseUrl}/${provider}/connect`);
  }

  public getGithubProfile(): Observable<{ profile: GitHubUserProfileModel }> {
    return this._http.get<{ profile: GitHubUserProfileModel }>(`${this.baseUrl}/github/profile`);
  }

  public getGithubRepos(): Observable<{ repositories: GitHubRepositoryModel[] }> {
    return this._http.get<{ repositories: GitHubRepositoryModel[] }>(`${this.baseUrl}/github/repos`);
  }

  public getGoogleHealthProfile(): Observable<{ profile: GoogleHealthUserProfileModel }> {
    return this._http.get<{ profile: GoogleHealthUserProfileModel }>(`${this.baseUrl}/google-health/profile`);
  }
}
