import { IntegrationSummary } from '@integrations/models/integration-summary.model';
import { integrationView } from '@integrations/lib/integration-status';

const now = new Date('2026-11-05T14:30:00Z');
const minutesAgo = (m: number) => new Date(now.getTime() - m * 60_000).toISOString();

const github = (lastSync: IntegrationSummary['lastSync']): IntegrationSummary => ({
  type: 'github',
  expiresAtUtc: null,
  lastSync,
});

const sync = (finishedMinutesAgo: number, status: 'success' | 'failed' = 'success') => ({
  startedAtUtc: minutesAgo(finishedMinutesAgo + 1),
  finishedAtUtc: minutesAgo(finishedMinutesAgo),
  status,
  activitiesCount: 3,
  errorMessage: status === 'failed' ? 'boom' : null,
});

describe('integrationView', () => {
  it('should be live after a recent successful sync', () => {
    expect(integrationView(github(sync(2)), now)).toEqual({
      type: 'github',
      name: 'GitHub',
      initial: 'G',
      state: 'live',
      detail: 'synced 2 min ago',
    });
  });

  it('should shorten older sync times', () => {
    expect(integrationView(github(sync(0)), now).detail).toBe('synced just now');
    expect(integrationView(github(sync(125)), now).detail).toBe('synced 2 h ago');
    expect(integrationView(github(sync(3 * 24 * 60)), now).detail).toBe('synced 3 d ago');
  });

  it('should be stale when the last success is older than 30 minutes', () => {
    expect(integrationView(github(sync(45)), now).state).toBe('stale');
  });

  it('should report a failed last sync', () => {
    const view = integrationView(github(sync(2, 'failed')), now);
    expect(view.state).toBe('failed');
    expect(view.detail).toBe('sync failed');
  });

  it('should report an integration that never synced', () => {
    const view = integrationView(github(null), now);
    expect(view.state).toBe('never');
    expect(view.detail).toBe('not synced yet');
  });

  it('should name every provider', () => {
    const strava: IntegrationSummary = { type: 'strava', expiresAtUtc: '', athlete: null, lastSync: null };
    const health: IntegrationSummary = { type: 'google-health', expiresAtUtc: '', lastSync: null };
    expect(integrationView(strava, now).name).toBe('Strava');
    expect(integrationView(health, now)).toEqual(
      jasmine.objectContaining({ name: 'Google Health', initial: 'G' }),
    );
  });
});
