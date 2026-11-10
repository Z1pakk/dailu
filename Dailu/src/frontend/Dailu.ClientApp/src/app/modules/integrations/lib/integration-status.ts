import {
  IntegrationProviderType,
  IntegrationSummary,
} from '@integrations/models/integration-summary.model';

/** live: synced OK in the last 30 min · stale: older OK sync · failed · never synced. */
export type IntegrationState = 'live' | 'stale' | 'failed' | 'never';

export interface IntegrationView {
  type: IntegrationProviderType;
  name: string;
  initial: string;
  state: IntegrationState;
  detail: string;
}

const NAMES: Record<IntegrationProviderType, string> = {
  github: 'GitHub',
  strava: 'Strava',
  'google-health': 'Google Health',
};

const LIVE_WINDOW_MIN = 30;

/** "just now" / "2 min ago" / "3 h ago" / "4 d ago" — the compact Figma wording. */
function ago(minutes: number): string {
  if (minutes < 1) {
    return 'just now';
  }
  if (minutes < 60) {
    return `${minutes} min ago`;
  }
  if (minutes < 24 * 60) {
    return `${Math.floor(minutes / 60)} h ago`;
  }
  return `${Math.floor(minutes / (24 * 60))} d ago`;
}

export function integrationView(summary: IntegrationSummary, now: Date): IntegrationView {
  const name = NAMES[summary.type];
  const base = { type: summary.type, name, initial: name.charAt(0) };
  const sync = summary.lastSync;

  if (!sync) {
    return { ...base, state: 'never', detail: 'not synced yet' };
  }
  if (sync.status === 'failed') {
    return { ...base, state: 'failed', detail: 'sync failed' };
  }
  const minutes = Math.floor((now.getTime() - new Date(sync.finishedAtUtc).getTime()) / 60_000);
  return {
    ...base,
    state: minutes <= LIVE_WINDOW_MIN ? 'live' : 'stale',
    detail: `synced ${ago(minutes)}`,
  };
}
