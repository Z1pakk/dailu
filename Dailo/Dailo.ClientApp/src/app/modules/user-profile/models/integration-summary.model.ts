export interface GithubIntegrationSummary {
  type: 'github';
  expiresAtUtc: string | null; // ISO datetime; null = never expires
}

export interface StravaAthleteInfo {
  id: number;
  username: string;
  firstName: string;
  lastName: string;
  profileUrl: string;
}

export interface StravaIntegrationSummary {
  type: 'strava';
  expiresAtUtc: string;
  athlete: StravaAthleteInfo | null;
}

export interface GoogleHealthIntegrationSummary {
  type: 'google-health';
  expiresAtUtc: string;
}

export type IntegrationSummary = GithubIntegrationSummary | StravaIntegrationSummary | GoogleHealthIntegrationSummary;
