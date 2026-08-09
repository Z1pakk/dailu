export interface GitHubUserProfileModel {
  id: number;
  login: string | null;
  url: string | null;
  name: string | null;
  email: string | null;
  publicRepos: number;
  followers: number;
  following: number;
}
