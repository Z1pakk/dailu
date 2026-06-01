import { ChangeDetectionStrategy, Component } from '@angular/core';
import { Button } from 'primeng/button';

@Component({
  selector: 'app-feat-visual-reminders',
  standalone: true,
  imports: [Button],
  templateUrl: './feat-visual-reminders.html',
  styleUrl: './feat-visual-reminders.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FeatVisualReminders {}
