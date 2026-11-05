import { ChangeDetectionStrategy, Component } from '@angular/core';
import {
  Accordion,
  AccordionContent,
  AccordionHeader,
  AccordionPanel,
} from 'primeng/accordion';
import { SectionHeader } from '@shared/ui/section-header/section-header';
import { FAQ_ITEMS } from '../../../../data/faq';

/** FAQ (Figma `5:603`): PrimeNG accordion, first item open. */
@Component({
  selector: 'app-landing-faq',
  imports: [Accordion, AccordionPanel, AccordionHeader, AccordionContent, SectionHeader],
  templateUrl: './landing-faq.html',
  styleUrls: ['../../_landing-layout.scss', './landing-faq.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LandingFaq {
  protected readonly items = FAQ_ITEMS;

  /** Scoped PrimeNG design tokens (no ::ng-deep): flat rows, Figma `5:603`. */
  protected readonly accordionTokens = {
    panel: { borderColor: 'var(--dl-border-subtle)' },
    header: {
      padding: '20px 0',
      fontWeight: '500',
      color: '{text.color}',
      hoverColor: '{text.color}',
      activeColor: '{text.color}',
      activeHoverColor: '{text.color}',
      background: 'transparent',
      hoverBackground: 'transparent',
      activeBackground: 'transparent',
      activeHoverBackground: 'transparent',
      toggleIcon: {
        color: '{text.muted.color}',
        hoverColor: '{text.color}',
        activeColor: '{text.color}',
        activeHoverColor: '{text.color}',
      },
    },
    content: { padding: '0 0 20px 0', background: 'transparent' },
  };
}
