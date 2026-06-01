import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { Button } from 'primeng/button';
import { Tag } from 'primeng/tag';
import { FeatVisualHeatmap } from './visuals/feat-visual-heatmap/feat-visual-heatmap';
import { FeatVisualHabits } from './visuals/feat-visual-habits/feat-visual-habits';
import { FeatVisualSync } from './visuals/feat-visual-sync/feat-visual-sync';
import { FeatVisualMilestones } from './visuals/feat-visual-milestones/feat-visual-milestones';
import { FeatVisualReminders } from './visuals/feat-visual-reminders/feat-visual-reminders';
import { FeatVisualAi } from './visuals/feat-visual-ai/feat-visual-ai';

interface FeatureTab {
  key: string;
  label: string;
  soon: boolean;
  tag: string;
  title: string;
  desc: string;
  bullets: string[];
}

@Component({
  selector: 'app-landing-features',
  imports: [Button, Tag, FeatVisualHeatmap, FeatVisualHabits, FeatVisualSync, FeatVisualMilestones, FeatVisualReminders, FeatVisualAi],
  templateUrl: './landing-features.html',
  styleUrl: './landing-features.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LandingFeatures {
  protected readonly $activeTab = signal('heatmap');

  protected readonly tabs: FeatureTab[] = [
    { key: 'heatmap', label: 'Activity Heatmap', soon: false,
      tag: '📊 Activity Heatmap', title: 'See your consistency at a glance',
      desc: 'GitHub-style heatmap shows every day you showed up. Month-by-month view, current streak counter, and intensity levels make your progress tangible.',
      bullets: ['Month and year views', 'Streak counter with best streak', 'Hover tooltips with entry details', 'Intensity levels (0–4) per day'] },
    { key: 'habits', label: 'Habit Tracking', soon: false,
      tag: '🎯 Habit Tracking', title: 'Build habits that actually stick',
      desc: 'Create habits with custom frequency, targets, and milestones. Tag them, set end dates, and watch your completion rate grow week over week.',
      bullets: ['Daily, weekly, monthly frequency', 'Measurable targets with units', 'Tags for easy organization', 'Milestone tracking'] },
    { key: 'sync', label: 'Auto Sync', soon: false,
      tag: '🔗 Auto Sync', title: 'Zero manual logging. Ever.',
      desc: 'Connect your apps once. Dailu polls them on a schedule and automatically turns new activity into habit entries. You just have to show up.',
      bullets: ['Activities detected & logged automatically', 'Regular polling, zero config needed', 'Growing library of supported integrations', 'Disconnect anytime, data preserved'] },
    { key: 'milestones', label: 'Milestones', soon: false,
      tag: '🏆 Milestones', title: 'Hit targets that matter',
      desc: 'Set a milestone target for any habit and watch your progress bar fill up. Milestones give long-term meaning to daily actions.',
      bullets: ['Custom milestone targets per habit', 'Progress bar on habit cards', 'Current / target display', 'Resets for new milestone cycles'] },
    { key: 'reminders', label: 'Smart Reminders', soon: true,
      tag: '🔔 Smart Reminders', title: 'Never miss a day again',
      desc: "Dailu learns your patterns and sends reminders at the right moment. Streak at risk? We'll let you know.",
      bullets: ['Pattern-aware reminder timing', 'Streak protection alerts', 'Email & browser push options', 'Per-habit reminder settings'] },
    { key: 'ai', label: 'AI Recommendations', soon: true,
      tag: '🤖 AI Recommendations', title: 'Your personal progress coach',
      desc: 'Dailu will analyze your habit patterns and activity data to surface personalized insights — suggesting the best time to log and when to rest.',
      bullets: ['Pattern analysis across all habits', 'Weekly AI-generated progress summaries', 'Habit suggestions based on your goals', 'Burnout detection & recovery nudges'] },
  ];

  protected selectTab(key: string): void {
    this.$activeTab.set(key);
  }

  protected activeTab(): FeatureTab {
    return (this.tabs.find(t => t.key === this.$activeTab()) ?? this.tabs[0])!;
  }
}
