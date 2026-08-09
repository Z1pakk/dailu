import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-feat-visual-heatmap',
  standalone: true,
  templateUrl: './feat-visual-heatmap.html',
  styleUrl: './feat-visual-heatmap.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FeatVisualHeatmap {
  protected readonly cells = [
    0, 1, 2, 3, 2, 1, 0,
    1, 2, 3, 4, 3, 2, 1,
    2, 3, 4, 4, 3, 1, 0,
    0, 1, 2, 4, 3, 2, 1,
  ];
}
