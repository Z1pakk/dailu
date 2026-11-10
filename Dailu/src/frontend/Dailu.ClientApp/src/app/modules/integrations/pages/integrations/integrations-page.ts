import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Button } from 'primeng/button';
import { Tooltip } from 'primeng/tooltip';
import { StreakChip } from '@habits/ui/streak-chip/streak-chip';
import { CoachButton } from '@shared/ui/coach-button/coach-button';
import { IntegrationsFacadeService } from '@integrations/pages/integrations/integrations-facade.service';
import { IntegrationCard } from '@integrations/pages/integrations/ui/integration-card/integration-card';

const SUGGEST_URL = 'https://github.com/Z1pakk/dailu/issues/new?title=Integration%20idea%3A%20';

/** Integrations (Figma `77:4462` desktop, `78:4949` mobile). */
@Component({
  selector: 'app-integrations-page',
  imports: [Button, Tooltip, StreakChip, CoachButton, IntegrationCard],
  providers: [IntegrationsFacadeService],
  templateUrl: './integrations-page.html',
  styleUrl: './integrations-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IntegrationsPage implements OnInit {
  private readonly _route = inject(ActivatedRoute);
  protected readonly facade = inject(IntegrationsFacadeService);

  protected readonly suggestUrl = SUGGEST_URL;
  /** True inside the OAuth popup, which closes itself right away. */
  protected readonly $isCallback = signal(false);

  ngOnInit(): void {
    const snapshot = this._route.snapshot;
    if (this.facade.handleCallback(snapshot.paramMap.get('provider'), snapshot.queryParamMap)) {
      this.$isCallback.set(true);
      return;
    }
    this.facade.init();
  }
}
