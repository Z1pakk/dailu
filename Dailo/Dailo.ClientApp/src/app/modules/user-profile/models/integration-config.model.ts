export interface GithubIntegrationConfig {
  type: 'github';
  accessToken: string;
  expiresAtUtc: string | null;
}

export interface StravaIntegrationConfig {
  type: 'strava';
  accessToken: string;
  refreshToken: string;
  expiresAtUtc: string;
}

export type IntegrationConfig = GithubIntegrationConfig | StravaIntegrationConfig;
