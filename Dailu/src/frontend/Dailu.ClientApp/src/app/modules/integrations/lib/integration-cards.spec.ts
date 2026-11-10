import { HabitModel } from '@habits/models/habit.model';
import { frequencyTypes } from '@habits/enums/frequency-type.enum';
import { habitStatuses } from '@habits/enums/habit-status.enum';
import { habitTypes } from '@habits/enums/habit-type.enum';
import { automationSources } from '@habits/enums/automation-source.enum';
import { IntegrationSummary } from '@integrations/models/integration-summary.model';
import { IntegrationSyncLog } from '@integrations/models/integration-sync-log.model';
import { integrationCards, integrationsSubtitle, syncLogRows } from './integration-cards';

const NOW = new Date('2026-11-10T14:30:00');

const minutesAgo = (m: number) => new Date(NOW.getTime() - m * 60_000).toISOString();

const log = (overrides: Partial<IntegrationSyncLog> = {}): IntegrationSyncLog => ({
  startedAtUtc: minutesAgo(2),
  finishedAtUtc: minutesAgo(2),
  status: 'success',
  activitiesCount: 1,
  errorMessage: null,
  ...overrides,
});

const habit = (overrides: Partial<HabitModel> = {}): HabitModel => ({
  id: 'code',
  name: 'Write code',
  type: habitTypes.binary,
  frequency: { type: frequencyTypes.daily, timesPerPeriod: 1 },
  target: { value: 1, unit: '' },
  status: habitStatuses.ongoing,
  isArchived: false,
  tags: [],
  automationSource: automationSources.github,
  createdAtUtc: new Date('2026-01-01T10:00:00'),
  lastCompletedAtUtc: new Date('2026-01-01T10:00:00'),
  ...overrides,
});

const github = (overrides: Partial<Extract<IntegrationSummary, { type: 'github' }>> = {}): IntegrationSummary => ({
  type: 'github',
  expiresAtUtc: null,
  lastSync: log(),
  ...overrides,
});

describe('integration-cards', () => {
  describe('integrationCards', () => {
    it('should list every provider, connected or not', () => {
      const cards = integrationCards([github()], [], NOW, {});
      expect(cards.map((c) => [c.type, c.isConnected])).toEqual([
        ['github', true],
        ['strava', false],
        ['google-health', false],
      ]);
    });

    it('should describe a recent sync as live', () => {
      const [card] = integrationCards([github()], [], NOW, {});
      expect(card!.state).toBe('live');
      expect(card!.status).toBe('Live · synced 2 min ago');
    });

    it('should describe old, failed and missing syncs', () => {
      const status = (lastSync: IntegrationSyncLog | null) => integrationCards([github({ lastSync })], [], NOW, {})[0]!.status;
      expect(status(log({ finishedAtUtc: minutesAgo(180) }))).toBe('Synced 3 h ago');
      expect(status(log({ status: 'failed' }))).toBe('Last sync failed');
      expect(status(null)).toBe('Waiting for the first sync');
    });

    it('should show who is connected, falling back to "Connected"', () => {
      const strava: IntegrationSummary = {
        type: 'strava',
        expiresAtUtc: minutesAgo(-600),
        lastSync: null,
        athlete: { id: 1, username: 'marta', firstName: 'Marta', lastName: 'Kowalska', profileUrl: '' },
      };
      const cards = integrationCards([github(), strava], [], NOW, { github: 'marta-k' });
      expect(cards[0]!.account).toBe('Connected as @marta-k');
      expect(cards[1]!.account).toBe('Connected as Marta K.');
      expect(integrationCards([github()], [], NOW, {})[0]!.account).toBe('Connected');
    });

    it('should list the active habits each source drives', () => {
      const habits = [
        habit(),
        habit({ id: 'run', name: 'Morning run', automationSource: automationSources.strava }),
        habit({ id: 'old', name: 'Old', isArchived: true }),
        habit({ id: 'pill', name: 'Take a pill', automationSource: automationSources.none }),
      ];
      const [gh, strava, google] = integrationCards([], habits, NOW, {});
      expect(gh!.usedBy).toEqual(['Write code']);
      expect(strava!.usedBy).toEqual(['Morning run']);
      expect(google!.usedBy).toEqual([]);
    });

    it('should warn when the GitHub token expires soon or has expired', () => {
      const expiry = (days: number) =>
        integrationCards([github({ expiresAtUtc: minutesAgo(-days * 24 * 60) })], [], NOW, {})[0]!.warning;
      expect(expiry(30)).toBeNull();
      expect(expiry(3)).toBe('Token expires in 3 days');
      expect(expiry(-2)).toBe('Token expired — reconnect');
    });
  });

  describe('syncLogRows', () => {
    it('should merge providers newest first and label the result', () => {
      const rows = syncLogRows(
        {
          github: [log({ startedAtUtc: minutesAgo(10), activitiesCount: 2 })],
          strava: [
            log({ startedAtUtc: minutesAgo(5), activitiesCount: 0 }),
            log({ startedAtUtc: minutesAgo(60), status: 'failed', errorMessage: 'token refresh failed' }),
          ],
        },
        NOW,
      );
      expect(rows.map((r) => [r.provider, r.badge, r.tone, r.detail])).toEqual([
        ['Strava', 'No new activity', 'muted', '–'],
        ['GitHub', '2 new activities', 'success', '–'],
        ['Strava', 'Failed', 'danger', 'token refresh failed'],
      ]);
    });

    it('should show the time today and the date before today', () => {
      const rows = syncLogRows(
        { github: [log({ startedAtUtc: '2026-11-10T09:05:00' }), log({ startedAtUtc: '2026-11-08T22:40:00' })] },
        NOW,
      );
      expect(rows.map((r) => r.time)).toEqual(['09:05', '8 Nov 22:40']);
    });
  });

  it('should summarise what is connected', () => {
    const subtitle = (summaries: IntegrationSummary[]) => integrationsSubtitle(integrationCards(summaries, [], NOW, {}));
    expect(subtitle([])).toBe('Nothing connected yet');
    expect(subtitle([github()])).toBe('1 connected · syncing every 2 min');
    expect(
      subtitle([github(), { type: 'google-health', expiresAtUtc: minutesAgo(-60), lastSync: null }]),
    ).toBe('2 connected · syncing every 2–5 min');
  });
});
