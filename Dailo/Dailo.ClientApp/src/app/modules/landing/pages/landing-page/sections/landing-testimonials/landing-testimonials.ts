import { ChangeDetectionStrategy, Component } from '@angular/core';
import { Tag } from 'primeng/tag';

interface Testimonial {
  name: string;
  role: string;
  avatar: string;
  avatarBg: string;
  avatarFg: string;
  cardBg: string;
  text: string;
  featured: boolean;
}

@Component({
  selector: 'app-landing-testimonials',
  imports: [Tag],
  templateUrl: './landing-testimonials.html',
  styleUrl: './landing-testimonials.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LandingTestimonials {
  protected readonly testimonials: Testimonial[] = [
    {
      name: 'Alex M.',
      role: 'Software engineer',
      avatar: 'A',
      avatarBg: '#fff',
      avatarFg: '#0f172a',
      cardBg: '#0f172a',
      featured: true,
      text: 'Finally stopped manually logging my commits. Dailu just picks them up — my streak is actually accurate now.',
    },
    {
      name: 'Sara K.',
      role: 'Marathon runner',
      avatar: 'S',
      avatarBg: '#1d4ed8',
      avatarFg: '#fff',
      cardBg: '#eff6ff',
      featured: false,
      text: 'I track my runs and my coding in the same dashboard. Never had a tool that bridges both worlds.',
    },
    {
      name: 'Tom R.',
      role: 'Product designer',
      avatar: 'T',
      avatarBg: '#374151',
      avatarFg: '#fff',
      cardBg: '#f9fafb',
      featured: false,
      text: 'The heatmap is addictive. Seeing empty squares genuinely makes me want to show up every day.',
    },
    {
      name: 'Maria P.',
      role: 'Indie hacker',
      avatar: 'M',
      avatarBg: '#374151',
      avatarFg: '#fff',
      cardBg: '#fafafa',
      featured: false,
      text: 'No fluff. Does exactly what it says. Auto-sync is the killer feature.',
    },
    {
      name: 'Jake L.',
      role: 'Cyclist & developer',
      avatar: 'J',
      avatarBg: '#1d4ed8',
      avatarFg: '#fff',
      cardBg: '#eff6ff',
      featured: false,
      text: "Tracking rides and open source work in one place — something I didn't know I needed until now.",
    },
  ];
}
