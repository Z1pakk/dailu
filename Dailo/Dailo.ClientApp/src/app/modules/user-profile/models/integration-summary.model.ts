export interface GithubIntegrationSummary {
  type: 'github';
  expiresAt: string | null; // ISO datetime; null = never expires
}

export interface StravaIntegrationSummary {
  type: 'strava';
}

export type IntegrationSummary = GithubIntegrationSummary | StravaIntegrationSummary;
