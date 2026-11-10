import { computed, DestroyRef, effect, inject, Injectable, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ParamMap } from '@angular/router';
import { Store } from '@ngxs/store';
import { MessageService } from 'primeng/api';
import { catchError, finalize, forkJoin, map, of, switchMap } from 'rxjs';
import { HabitStateSelectors } from '@habits/state/habit.selector';
import { IntegrationApi } from '@integrations/api/integration.api';
import { IntegrationProviderType } from '@integrations/models/integration-summary.model';
import { IntegrationSyncLog } from '@integrations/models/integration-sync-log.model';
import { IntegrationStateSelectors } from '@integrations/state/integration.selector';
import {
  IntegrationFetchSummaries,
  IntegrationGetGithubProfile,
  IntegrationGetGoogleHealthProfile,
  IntegrationGetSummaries,
  IntegrationRevoke,
} from '@integrations/state/integration.action';
import { integrationCards, integrationsSubtitle, PROVIDERS, syncLogRows } from '@integrations/lib/integration-cards';
import {
  OAuthConnectionError,
  OAuthPopupBlockedError,
  OAuthPopupService,
} from '@shared/lib/oauth-popup/oauth-popup.service';

/** Sync log entries fetched per provider. */
const LOG_SIZE = 10;

/** Query params and popup channel the backend's OAuth callback uses, per provider. */
const CALLBACK_KEYS: Record<IntegrationProviderType, string> = {
  github: 'github',
  strava: 'strava',
  'google-health': 'google_health',
};

type SyncLogs = Partial<Record<IntegrationProviderType, IntegrationSyncLog[]>>;

/** Everything the Integrations page shows and does. Provided per page. */
@Injectable()
export class IntegrationsFacadeService {
  private readonly _store = inject(Store);
  private readonly _api = inject(IntegrationApi);
  private readonly _messageService = inject(MessageService);
  private readonly _oauthPopup = inject(OAuthPopupService);
  private readonly _destroyRef = inject(DestroyRef);

  private readonly _$summaries = this._store.selectSignal(IntegrationStateSelectors.getSlices.summaries);
  private readonly _$githubProfile = this._store.selectSignal(IntegrationStateSelectors.getSlices.githubProfile);
  private readonly _$googleProfile = this._store.selectSignal(IntegrationStateSelectors.getSlices.googleHealthProfile);
  private readonly _$habits = this._store.selectSignal(HabitStateSelectors.getSlices.habits);

  public readonly $isLoading = computed(() => this._$summaries() === null);

  private readonly _$connecting = signal<IntegrationProviderType | null>(null);
  public readonly $connecting = this._$connecting.asReadonly();
  private readonly _$disconnecting = signal<IntegrationProviderType | null>(null);
  public readonly $disconnecting = this._$disconnecting.asReadonly();

  public readonly $cards = computed(() =>
    integrationCards(this._$summaries() ?? [], this._$habits(), new Date(), {
      github: this._$githubProfile()?.login,
      googleHealth: this._$googleProfile()?.name ?? this._$googleProfile()?.email,
    }),
  );
  public readonly $subtitle = computed(() => integrationsSubtitle(this.$cards()));

  private readonly _$logs = signal<SyncLogs>({});
  private readonly _$isLoadingLogs = signal(false);
  public readonly $isLoadingLogs = this._$isLoadingLogs.asReadonly();
  private readonly _$logsFailed = signal(false);
  public readonly $logsFailed = this._$logsFailed.asReadonly();
  public readonly $logRows = computed(() => syncLogRows(this._$logs(), new Date()));

  /** Connected providers, as a stable key so the log only reloads when it changes. */
  private readonly _$connected = computed(
    () => (this._$summaries() ?? []).map((s) => s.type).sort().join(','),
  );

  constructor() {
    effect(() => {
      const connected = this._$connected().split(',').filter(Boolean) as IntegrationProviderType[];
      untracked(() => {
        // Profiles give the "Connected as …" names.
        if (connected.includes('github')) {
          this._store.dispatch(new IntegrationGetGithubProfile());
        }
        if (connected.includes('google-health')) {
          this._store.dispatch(new IntegrationGetGoogleHealthProfile());
        }
        this.loadLogs(connected);
      });
    });
  }

  public init(): void {
    this._store.dispatch(new IntegrationGetSummaries());
  }

  /**
   * The OAuth callback opens this page in the popup (`/integrations/<provider>`);
   * there it only reports back to the opener and closes.
   */
  public handleCallback(provider: string | null, params: ParamMap): boolean {
    const type = PROVIDERS.find((p) => p.type === provider)?.type;
    if (!type) {
      return false;
    }
    const key = CALLBACK_KEYS[type];
    return this._oauthPopup.handleCallbackIfInPopup(params, `${key}_connected`, `${key}_error`, `${key}_oauth`);
  }

  public connect(type: IntegrationProviderType): void {
    if (this._$connecting()) {
      return;
    }
    const name = this._name(type);
    this._$connecting.set(type);
    this._api.getConnectUrl(type)
      .pipe(
        switchMap(({ authUrl }) => this._oauthPopup.open(authUrl, `${CALLBACK_KEYS[type]}_oauth`)),
        finalize(() => this._$connecting.set(null)),
        takeUntilDestroyed(this._destroyRef),
      )
      .subscribe({
        next: () => {
          this._store.dispatch(new IntegrationFetchSummaries());
          this._messageService.add({ severity: 'success', summary: 'Connected', detail: `${name} is connected.`, life: 3000 });
        },
        error: (err: unknown) => {
          if (err instanceof OAuthPopupBlockedError) {
            this._messageService.add({
              severity: 'warn',
              summary: 'Popup blocked',
              detail: 'Please allow popups for this site and try again.',
              life: 5000,
            });
            return;
          }
          const detail =
            err instanceof OAuthConnectionError
              ? `Failed to connect ${name}. Please try again.`
              : `Failed to start the ${name} connection.`;
          this._messageService.add({ severity: 'error', summary: 'Error', detail, life: 4000 });
        },
      });
  }

  public disconnect(type: IntegrationProviderType): void {
    if (this._$disconnecting()) {
      return;
    }
    const name = this._name(type);
    this._$disconnecting.set(type);
    this._store
      .dispatch(new IntegrationRevoke(type))
      .pipe(
        finalize(() => this._$disconnecting.set(null)),
        takeUntilDestroyed(this._destroyRef),
      )
      .subscribe({
        next: () =>
          this._messageService.add({ severity: 'success', summary: 'Disconnected', detail: `${name} is disconnected.`, life: 3000 }),
        error: () =>
          this._messageService.add({ severity: 'error', summary: 'Error', detail: `Failed to disconnect ${name}.`, life: 3000 }),
      });
  }

  public loadLogs(connected: readonly IntegrationProviderType[]): void {
    if (connected.length === 0) {
      this._$logs.set({});
      this._$logsFailed.set(false);
      return;
    }
    this._$isLoadingLogs.set(true);
    // One failing provider shouldn't hide the others' logs.
    const requests = connected.map((type) =>
      this._api.getSyncLogs(type, LOG_SIZE).pipe(
        map(({ logs }) => [type, logs] as const),
        catchError(() => of(null)),
      ),
    );
    forkJoin(requests)
      .pipe(
        finalize(() => this._$isLoadingLogs.set(false)),
        takeUntilDestroyed(this._destroyRef),
      )
      .subscribe((results) => {
        const loaded = results.filter((r) => r !== null);
        this._$logs.set(Object.fromEntries(loaded) as SyncLogs);
        this._$logsFailed.set(loaded.length < results.length);
      });
  }

  private _name(type: IntegrationProviderType): string {
    return PROVIDERS.find((p) => p.type === type)!.name;
  }
}
