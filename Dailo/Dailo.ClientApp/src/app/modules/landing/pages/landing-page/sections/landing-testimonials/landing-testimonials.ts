import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NgClass } from '@angular/common';
import { Tag } from 'primeng/tag';

interface Testimonial {
  name: string;
  role: string;
  avatar: string;
  avatarClass: string;
  cardClass: string;
  text: string;
  featured: boolean;
}

@Component({
  selector: 'app-landing-testimonials',
  imports: [Tag, NgClass],
  templateUrl: './landing-testimonials.html',
  styleUrls: ['../../_layout.scss', './landing-testimonials.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LandingTestimonials {
  protected readonly testimonials: Testimonial[] = [
    {
      name: 'Alex M.',
      role: 'Software engineer',
      avatar: 'A',
      cardClass: 'card-dark',
      avatarClass: 'av-white-on-dark',
      featured: true,
      text: 'Finally stopped manually logging my commits. Dailu just picks them up — my streak is actually accurate now.',
    },
    {
      name: 'Sara K.',
      role: 'Marathon runner',
      avatar: 'S',
      cardClass: 'card-blue',
      avatarClass: 'av-white-on-blue',
      featured: false,
      text: 'I track my runs and my coding in the same dashboard. Never had a tool that bridges both worlds.',
    },
    {
      name: 'Tom R.',
      role: 'Product designer',
      avatar: 'T',
      cardClass: 'card-gray',
      avatarClass: 'av-white-on-slate',
      featured: false,
      text: 'The heatmap is addictive. Seeing empty squares genuinely makes me want to show up every day.',
    },
    {
      name: 'Maria P.',
      role: 'Indie hacker',
      avatar: 'M',
      cardClass: 'card-gray',
      avatarClass: 'av-white-on-slate',
      featured: false,
      text: 'No fluff. Does exactly what it says. Auto-sync is the killer feature.',
    },
    {
      name: 'Jake L.',
      role: 'Cyclist & developer',
      avatar: 'J',
      cardClass: 'card-blue',
      avatarClass: 'av-white-on-blue',
      featured: false,
      text: "Tracking rides and open source work in one place — something I didn't know I needed until now.",
    },
  ];
}
