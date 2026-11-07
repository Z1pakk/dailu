import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { RingLogo } from '@shared/ui/ring-logo/ring-logo';
import { ThemeToggle } from '@shared/ui/theme-toggle/theme-toggle';

const SOURCES = ['GitHub', 'Strava', 'Google Health'] as const;

/**
 * Two-column frame for the login / register pages (Figma `32:629`, `32:720`):
 * form column on the left, always-dark brand panel on the right (hidden below lg).
 * The page projects its form into the default slot and the panel body into `[authPanel]`.
 */
@Component({
  selector: 'app-auth-shell',
  imports: [RouterLink, RingLogo, ThemeToggle],
  templateUrl: './auth-shell.html',
  styleUrl: './auth-shell.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuthShell {
  public readonly $eyebrow = input.required<string>({ alias: 'eyebrow' });
  /** Panel heading, one entry per line. */
  public readonly $headline = input.required<readonly string[]>({ alias: 'headline' });
  public readonly $chipsLabel = input.required<string>({ alias: 'chipsLabel' });

  protected readonly sources = SOURCES;
}
