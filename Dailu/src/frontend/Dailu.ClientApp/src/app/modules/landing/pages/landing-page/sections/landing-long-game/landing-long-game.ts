import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ProgressBar } from 'primeng/progressbar';
import { Heatmap } from '@shared/ui/heatmap/heatmap';
import { buildYearWeeks } from '@shared/ui/heatmap/heatmap.grid';
import { SectionHeader } from '@shared/ui/section-header/section-header';
import { exampleYearCounts, totalChecks } from '../../../../data/example-year';
import { EXAMPLE_MILESTONES } from '../../../../data/example-milestones';

const HABITS_PER_DAY = 6;

/** The long game (Figma `5:49`): year heatmap + milestones. */
@Component({
  selector: 'app-landing-long-game',
  imports: [ProgressBar, Heatmap, SectionHeader],
  templateUrl: './landing-long-game.html',
  styleUrls: ['../../_landing-layout.scss', './landing-long-game.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LandingLongGame {
  private readonly _today = new Date();
  private readonly _year = this._today.getFullYear();
  private readonly _counts = exampleYearCounts(this._year, this._today);

  protected readonly habitsPerDay = HABITS_PER_DAY;
  protected readonly weeks = buildYearWeeks(this._year, this._counts, HABITS_PER_DAY);
  protected readonly caption = `${this._year} · ${totalChecks(this._counts).toLocaleString('en')} checks`;

  /** Mobile (Figma 9:240): only the last 20 weeks, ending with the current one. */
  private readonly _lastWeeks = this._sliceLastWeeks(20);
  protected readonly recentWeeks = this._lastWeeks;
  protected readonly recentCaption = `Last 20 weeks · ${this._lastWeeks
    .flat()
    .reduce((sum, cell) => sum + (cell?.count ?? 0), 0)
    .toLocaleString('en')} checks`;

  /** Scoped PrimeNG design tokens (no ::ng-deep): thin ink bars, teal when unlocked. */
  protected readonly barTokens = {
    root: { height: '6px', borderRadius: '999px', background: 'var(--dl-bg-muted)' },
    value: { background: '{text.color}' },
  };
  protected readonly unlockedBarTokens = {
    ...this.barTokens,
    value: { background: '{primary.color}' },
  };

  protected readonly milestones = EXAMPLE_MILESTONES.map((m) => ({
    ...m,
    unlocked: m.current >= m.target,
    percent: Math.round((m.current / m.target) * 100),
  }));

  private _sliceLastWeeks(count: number) {
    const todayKey = this._today.toISOString().slice(0, 10);
    const current = this.weeks.findIndex((week) =>
      week.some((cell) => cell !== null && cell.date >= todayKey),
    );
    const end = current === -1 ? this.weeks.length : current + 1;
    return this.weeks.slice(Math.max(0, end - count), end);
  }
}
