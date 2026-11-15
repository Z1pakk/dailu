import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { convertToParamMap } from '@angular/router';
import { Store } from '@ngxs/store';
import { MessageService } from 'primeng/api';
import { of, Subject, throwError } from 'rxjs';
import { HabitStateSelectors } from '@habits/state/habit.selector';
import { IntegrationApi } from '@integrations/api/integration.api';
import { IntegrationSummary } from '@integrations/models/integration-summary.model';
import { IntegrationSyncLog } from '@integrations/models/integration-sync-log.model';
import { IntegrationStateSelectors } from '@integrations/state/integration.selector';
import {
  IntegrationFetchSummaries,
  IntegrationGetGithubProfile,
  IntegrationRevoke,
} from '@integrations/state/integration.action';
import { OAuthPopupBlockedError, OAuthPopupService } from '@shared/lib/oauth-popup/oauth-popup.service';
import { IntegrationsFacadeService } from './integrations-facade.service';

const log = (startedAtUtc: string): IntegrationSyncLog => ({
  startedAtUtc,
  finishedAtUtc: startedAtUtc,
  status: 'success',
  activitiesCount: 1,
  errorMessage: null,
});

describe('IntegrationsFacadeService', () => {
  let store: jasmine.SpyObj<Store>;
  let api: jasmine.SpyObj<IntegrationApi>;
  let popup: jasmine.SpyObj<OAuthPopupService>;
  let messages: jasmine.SpyObj<MessageService>;
  let facade: IntegrationsFacadeService;
  const summaries = signal<IntegrationSummary[] | null>(null);

  const dispatched = () => store.dispatch.calls.allArgs().map(([a]) => a);

  beforeEach(() => {
    summaries.set(null);
    store = jasmine.createSpyObj<Store>('Store', ['dispatch', 'selectSignal']);
    store.selectSignal.and.callFake(((selector: unknown) => {
      if (selector === IntegrationStateSelectors.getSlices.summaries) {
        return summaries;
      }
      return selector === HabitStateSelectors.getSlices.habits ? signal([]) : signal(null);
    }) as never);
    store.dispatch.and.returnValue(of(undefined));
    api = jasmine.createSpyObj<IntegrationApi>('IntegrationApi', ['getSyncLogs', 'getConnectUrl', 'sync']);
    popup = jasmine.createSpyObj<OAuthPopupService>('OAuthPopupService', ['open', 'handleCallbackIfInPopup']);
    messages = jasmine.createSpyObj<MessageService>('MessageService', ['add']);
    TestBed.configureTestingModule({
      providers: [
        IntegrationsFacadeService,
        { provide: Store, useValue: store },
        { provide: IntegrationApi, useValue: api },
        { provide: OAuthPopupService, useValue: popup },
        { provide: MessageService, useValue: messages },
      ],
    });
    facade = TestBed.inject(IntegrationsFacadeService);
  });

  it('should load the logs of connected providers and keep the others when one fails', () => {
    api.getSyncLogs.and.callFake((type) =>
      type === 'github' ? of({ logs: [log('2026-11-10T10:00:00')] }) : throwError(() => new Error('down')),
    );
    summaries.set([
      { type: 'github', expiresAtUtc: null, lastSync: null },
      { type: 'strava', expiresAtUtc: '2027-01-01T00:00:00Z', lastSync: null, athlete: null },
    ]);
    TestBed.tick();
    expect(facade.$logRows().map((r) => r.provider)).toEqual(['GitHub']);
    expect(facade.$logsFailed()).toBeTrue();
    expect(dispatched()).toContain(jasmine.any(IntegrationGetGithubProfile));
  });

  it('should not ask for logs while nothing is connected', () => {
    summaries.set([]);
    TestBed.tick();
    expect(api.getSyncLogs).not.toHaveBeenCalled();
    expect(facade.$logRows()).toEqual([]);
  });

  it('should refresh the summaries once the OAuth popup reports success', () => {
    const result = new Subject<void>();
    api.getConnectUrl.and.returnValue(of({ authUrl: 'https://strava.test/auth' }));
    popup.open.and.returnValue(result);
    facade.connect('strava');
    expect(popup.open).toHaveBeenCalledWith('https://strava.test/auth', 'strava_oauth');
    expect(facade.$connecting()).toBe('strava');
    result.next();
    result.complete();
    expect(dispatched()).toContain(jasmine.any(IntegrationFetchSummaries));
    expect(facade.$connecting()).toBeNull();
  });

  it('should explain a blocked popup', () => {
    api.getConnectUrl.and.returnValue(of({ authUrl: 'https://github.test/auth' }));
    popup.open.and.returnValue(throwError(() => new OAuthPopupBlockedError()));
    facade.connect('github');
    expect(messages.add).toHaveBeenCalledWith(jasmine.objectContaining({ summary: 'Popup blocked' }));
    expect(facade.$connecting()).toBeNull();
  });

  it('should revoke the provider on disconnect', () => {
    facade.disconnect('google-health');
    const revoke = dispatched().find((a) => a instanceof IntegrationRevoke) as IntegrationRevoke;
    expect(revoke.provider).toBe('google-health');
    expect(facade.$disconnecting()).toBeNull();
  });

  it('should sync a provider and refresh its summary and logs', () => {
    summaries.set([{ type: 'github', expiresAtUtc: null, lastSync: null }]);
    api.getSyncLogs.and.returnValue(of({ logs: [] }));
    TestBed.tick();
    api.getSyncLogs.calls.reset();
    const result = new Subject<{ activitiesCount: number }>();
    api.sync.and.returnValue(result);

    facade.sync('github');
    expect(api.sync).toHaveBeenCalledWith('github');
    expect(facade.$syncing()).toBe('github');
    result.next({ activitiesCount: 3 });
    result.complete();

    expect(facade.$syncing()).toBeNull();
    expect(messages.add).toHaveBeenCalledWith(
      jasmine.objectContaining({
        severity: 'success',
        detail: 'GitHub synced, 3 activities found. No habit uses GitHub yet, so nothing was logged.',
      }),
    );
    expect(dispatched()).toContain(jasmine.any(IntegrationFetchSummaries));
    expect(api.getSyncLogs).toHaveBeenCalledWith('github', jasmine.any(Number));
  });

  it('should show the backend reason when a sync is refused', () => {
    const reason = 'This integration synced less than a minute ago. Please try again shortly.';
    api.sync.and.returnValue(throwError(() => new HttpErrorResponse({ status: 400, error: reason })));

    facade.sync('strava');

    expect(messages.add).toHaveBeenCalledWith(
      jasmine.objectContaining({ severity: 'error', summary: 'Sync failed', detail: reason }),
    );
    expect(facade.$syncing()).toBeNull();
  });

  it('should answer the OAuth callback with the provider channel', () => {
    popup.handleCallbackIfInPopup.and.returnValue(true);
    const params = convertToParamMap({ google_health_connected: '1' });
    expect(facade.handleCallback('google-health', params)).toBeTrue();
    expect(popup.handleCallbackIfInPopup).toHaveBeenCalledWith(
      params,
      'google_health_connected',
      'google_health_error',
      'google_health_oauth',
    );
    expect(facade.handleCallback(null, params)).toBeFalse();
  });
});
