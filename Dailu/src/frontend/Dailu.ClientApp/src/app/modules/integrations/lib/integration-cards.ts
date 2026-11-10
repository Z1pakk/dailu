import { differenceInDays } from 'date-fns/differenceInDays';
import { format } from 'date-fns/format';
import { startOfDay } from 'date-fns/startOfDay';
import { HabitModel } from '@habits/models/habit.model';
import { AutomationSource, automationSources } from '@habits/enums/automation-source.enum';
import { IntegrationProviderType, IntegrationSummary } from '@integrations/models/integration-summary.model';
import { IntegrationSyncLog } from '@integrations/models/integration-sync-log.model';
import { IntegrationState, integrationView } from '@integrations/lib/integration-status';
import { localDay } from '@shared/lib/date/local-day';

/*
 * The Integrations page: one card per provider (connected or not) and a sync log merged
 * across providers. "Checks" and "Permissions" mirror the backend workers and OAuth scopes.
 */

interface ProviderInfo {
  type: IntegrationProviderType;
  name: string;
  source: AutomationSource;
  tracks: string;
  everyMinutes: number;
  permissions: string;
  pitch: string;
}

export const PROVIDERS: readonly ProviderInfo[] = [
  {
    type: 'github',
    name: 'GitHub',
    source: automationSources.github,
    tracks: 'Commits & pull requests',
    everyMinutes: 2,
    permissions: 'read:user, repo',
    pitch: 'Tick off coding habits when you push or open a pull request.',
  },
  {
    type: 'strava',
    name: 'Strava',
    source: automationSources.strava,
    tracks: 'Runs, rides & swims',
    everyMinutes: 5,
    permissions: 'activity:read_all',
    pitch: 'Tick off workouts as soon as Strava records them.',
  },
  {
    type: 'google-health',
    name: 'Google Health',
    source: automationSources.googleHealth,
    tracks: 'Steps & workouts',
    everyMinutes: 5,
    permissions: 'activity, profile (read)',
    pitch: 'Tick off walks and workouts from your phone or watch.',
  },
];

export interface IntegrationCard {
  type: IntegrationProviderType;
  name: string;
  initial: string;
  tracks: string;
  checks: string;
  everyMinutes: number;
  permissions: string;
  pitch: string;
  isConnected: boolean;
  /** null while not connected. */
  state: IntegrationState | null;
  status: string;
  account: string;
  /** Something the person has to act on, e.g. an expiring token. */
  warning: string | null;
  usedBy: string[];
}

/** Display names of the connected accounts that aren't part of the summaries. */
export interface IntegrationAccounts {
  github?: string | null;
  googleHealth?: string | null;
}

export type SyncLogTone = 'success' | 'muted' | 'danger';

export interface SyncLogRow {
  key: string;
  time: string;
  provider: string;
  badge: string;
  tone: SyncLogTone;
  detail: string;
}

const EXPIRY_WARNING_DAYS = 14;

function status(summary: IntegrationSummary, now: Date): { state: IntegrationState; status: string } {
  const view = integrationView(summary, now);
  switch (view.state) {
    case 'live':
      return { state: view.state, status: `Live · ${view.detail}` };
    case 'stale':
      return { state: view.state, status: view.detail.charAt(0).toUpperCase() + view.detail.slice(1) };
    case 'failed':
      return { state: view.state, status: 'Last sync failed' };
    default:
      return { state: view.state, status: 'Waiting for the first sync' };
  }
}

function account(summary: IntegrationSummary, accounts: IntegrationAccounts): string {
  let name: string | null | undefined;
  if (summary.type === 'github') {
    name = accounts.github ? `@${accounts.github}` : null;
  } else if (summary.type === 'strava') {
    const athlete = summary.athlete;
    name = athlete ? `${athlete.firstName} ${athlete.lastName.charAt(0)}.`.trim() : null;
  } else {
    name = accounts.googleHealth;
  }
  return name ? `Connected as ${name}` : 'Connected';
}

/** Only GitHub tokens expire for good; Strava and Google refresh on their own. */
function warning(summary: IntegrationSummary, now: Date): string | null {
  if (summary.type !== 'github' || summary.expiresAtUtc === null) {
    return null;
  }
  const expiresAt = new Date(summary.expiresAtUtc);
  if (expiresAt <= now) {
    return 'Token expired — reconnect';
  }
  const days = differenceInDays(startOfDay(expiresAt), startOfDay(now));
  if (days > EXPIRY_WARNING_DAYS) {
    return null;
  }
  if (days === 0) {
    return 'Token expires today';
  }
  return `Token expires in ${days} ${days === 1 ? 'day' : 'days'}`;
}

export function integrationCards(
  summaries: readonly IntegrationSummary[],
  habits: readonly HabitModel[],
  now: Date,
  accounts: IntegrationAccounts,
): IntegrationCard[] {
  return PROVIDERS.map((provider): IntegrationCard => {
    const summary = summaries.find((s) => s.type === provider.type);
    const base = {
      type: provider.type,
      name: provider.name,
      initial: provider.name.charAt(0),
      tracks: provider.tracks,
      checks: `every ${provider.everyMinutes} min`,
      everyMinutes: provider.everyMinutes,
      permissions: provider.permissions,
      pitch: provider.pitch,
      usedBy: habits.filter((h) => !h.isArchived && h.automationSource === provider.source).map((h) => h.name),
    };
    if (!summary) {
      return { ...base, isConnected: false, state: null, status: 'Not connected', account: 'Not connected', warning: null };
    }
    return {
      ...base,
      isConnected: true,
      ...status(summary, now),
      account: account(summary, accounts),
      warning: warning(summary, now),
    };
  });
}

function badge(log: IntegrationSyncLog): Pick<SyncLogRow, 'badge' | 'tone' | 'detail'> {
  if (log.status === 'failed') {
    return { badge: 'Failed', tone: 'danger', detail: log.errorMessage?.trim() || '–' };
  }
  if (log.activitiesCount === 0) {
    return { badge: 'No new activity', tone: 'muted', detail: '–' };
  }
  const n = log.activitiesCount;
  return { badge: `${n} new ${n === 1 ? 'activity' : 'activities'}`, tone: 'success', detail: '–' };
}

export function syncLogRows(
  logs: Partial<Record<IntegrationProviderType, readonly IntegrationSyncLog[]>>,
  now: Date,
): SyncLogRow[] {
  const today = localDay(now);
  const rows = PROVIDERS.flatMap((provider) =>
    (logs[provider.type] ?? []).map((log, i) => ({ provider, log, i, at: new Date(log.startedAtUtc) })),
  );
  return rows
    .sort((a, b) => b.at.getTime() - a.at.getTime())
    .map(({ provider, log, i, at }) => ({
      key: `${provider.type}-${log.startedAtUtc}-${i}`,
      time: format(at, localDay(at) === today ? 'HH:mm' : 'd MMM HH:mm'),
      provider: provider.name,
      ...badge(log),
    }));
}

export function integrationsSubtitle(cards: readonly IntegrationCard[]): string {
  const connected = cards.filter((c) => c.isConnected);
  if (connected.length === 0) {
    return 'Nothing connected yet';
  }
  const minutes = connected.map((c) => c.everyMinutes);
  const min = Math.min(...minutes);
  const max = Math.max(...minutes);
  const every = min === max ? `${min} min` : `${min}–${max} min`;
  return `${connected.length} connected · syncing every ${every}`;
}
