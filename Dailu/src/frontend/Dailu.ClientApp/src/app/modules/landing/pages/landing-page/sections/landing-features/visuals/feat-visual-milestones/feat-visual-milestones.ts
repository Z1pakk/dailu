import { ChangeDetectionStrategy, Component } from '@angular/core';

interface Milestone {
  label: string;
  current: number;
  target: number;
  pct: number;
  color: 'primary' | 'green' | 'gray';
  emoji?: string;
}

@Component({
  selector: 'app-feat-visual-milestones',
  standalone: true,
  templateUrl: './feat-visual-milestones.html',
  styleUrl: './feat-visual-milestones.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FeatVisualMilestones {
  protected readonly milestones: Milestone[] = [
    { label: 'Open source',  current: 67, target: 100, pct: 67,  color: 'primary' },
    { label: 'Morning runs', current: 50, target: 50,  pct: 100, color: 'green', emoji: '🎉' },
    { label: 'Read 30 min',  current: 12, target: 30,  pct: 40,  color: 'gray' },
  ];
}
