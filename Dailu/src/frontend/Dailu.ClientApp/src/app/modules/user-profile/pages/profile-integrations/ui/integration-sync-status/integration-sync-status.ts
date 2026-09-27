import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  input,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { format, formatDistanceToNow, parseISO } from 'date-fns';
import { UserProfileApi } from '@user-profile/api/user-profile.api';
import { IntegrationProviderType } from '@user-profile/models/integration-summary.model';
import { IntegrationSyncLog } from '@user-profile/models/integration-sync-log.model';

const HISTORY_SIZE = 10;

@Component({
  selector: 'app-integration-sync-status',
  templateUrl: './integration-sync-status.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IntegrationSyncStatus {
  private readonly _api = inject(UserProfileApi);
  private readonly _destroyRef = inject(DestroyRef);

  public readonly provider = input.required<IntegrationProviderType>();
  public readonly lastSync = input<IntegrationSyncLog | null | undefined>(null);

  protected readonly $isExpanded = signal(false);
  protected readonly $isLoading = signal(false);
  protected readonly $hasError = signal(false);
  protected readonly $logs = signal<IntegrationSyncLog[]>([]);

  protected toggleHistory(): void {
    const expand = !this.$isExpanded();
    this.$isExpanded.set(expand);

    if (expand) {
      this.loadHistory();
    }
  }

  protected relative(value: string): string {
    return formatDistanceToNow(parseISO(value), { addSuffix: true });
  }

  protected time(value: string): string {
    return format(parseISO(value), 'MMM d, HH:mm');
  }

  private loadHistory(): void {
    this.$isLoading.set(true);
    this.$hasError.set(false);

    this._api
      .getIntegrationSyncLogs(this.provider(), HISTORY_SIZE)
      .pipe(
        finalize(() => this.$isLoading.set(false)),
        takeUntilDestroyed(this._destroyRef),
      )
      .subscribe({
        next: ({ logs }) => this.$logs.set(logs),
        error: () => this.$hasError.set(true),
      });
  }
}
