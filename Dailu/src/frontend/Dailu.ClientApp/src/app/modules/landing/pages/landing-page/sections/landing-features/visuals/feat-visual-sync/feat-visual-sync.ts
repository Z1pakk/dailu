import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-feat-visual-sync',
  standalone: true,
  templateUrl: './feat-visual-sync.html',
  styleUrl: './feat-visual-sync.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FeatVisualSync {}
