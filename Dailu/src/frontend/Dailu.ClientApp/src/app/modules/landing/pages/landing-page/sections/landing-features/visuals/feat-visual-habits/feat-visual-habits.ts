import { ChangeDetectionStrategy, Component } from '@angular/core';
import { Tag } from 'primeng/tag';

@Component({
  selector: 'app-feat-visual-habits',
  standalone: true,
  imports: [Tag],
  templateUrl: './feat-visual-habits.html',
  styleUrl: './feat-visual-habits.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FeatVisualHabits {}
