export interface GithubIntegrationConfig {
  type: 'github';
  accessToken: string;
  expiresInDays: number | null;
}

export interface StravaIntegrationConfig {
  type: 'strava';
  clientId: string;
  clientSecret: string;
}

export type IntegrationConfig = GithubIntegrationConfig | StravaIntegrationConfig;
