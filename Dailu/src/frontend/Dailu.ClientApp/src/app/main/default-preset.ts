import { definePreset } from '@primeng/themes';
import Aura from '@primeng/themes/aura';

/**
 * Dailu preset — Aura mapped onto the design tokens in
 * src/assets/variables/dailu-tokens.css (mirrored from Figma).
 *
 * Figma only defines teal 100–900, so Aura's 50 / 500 / 950 stops reuse neighbours.
 */
const teal = {
  50: 'var(--dl-teal-100)',
  100: 'var(--dl-teal-100)',
  200: 'var(--dl-teal-200)',
  300: 'var(--dl-teal-300)',
  400: 'var(--dl-teal-400)',
  500: 'var(--dl-teal-600)',
  600: 'var(--dl-teal-600)',
  700: 'var(--dl-teal-700)',
  800: 'var(--dl-teal-800)',
  900: 'var(--dl-teal-900)',
  950: 'var(--dl-teal-900)',
};

/** Mist → slate → ink ramp, shared by both schemes. */
const surface = {
  0: 'var(--dl-white)',
  50: 'var(--dl-mist-25)',
  100: 'var(--dl-mist-50)',
  200: 'var(--dl-mist-200)',
  300: 'var(--dl-mist-300)',
  400: 'var(--dl-slate-400)',
  500: 'var(--dl-slate-500)',
  600: 'var(--dl-slate-600)',
  700: 'var(--dl-ink-700)',
  800: 'var(--dl-ink-800)',
  900: 'var(--dl-ink-900)',
  950: 'var(--dl-ink-950)',
};

export const DefaultPreset = definePreset(Aura, {
  components: {
    // Figma styleguide Button `7:144`: md 20/12 r12, sm 14/8 r10, lg 24/16 r14, SemiBold.
    // md font-size (15px) and the sm/lg radii have no Aura token — see assets/scss/dailu-primeng.scss.
    button: {
      root: {
        borderRadius: '12px',
        gap: 'var(--dl-space-8)',
        paddingX: 'var(--dl-space-20)',
        paddingY: 'var(--dl-space-12)',
        sm: {
          fontSize: '14px',
          paddingX: '14px',
          paddingY: 'var(--dl-space-8)',
        },
        lg: {
          fontSize: '16px',
          paddingX: 'var(--dl-space-24)',
          paddingY: 'var(--dl-space-16)',
        },
        label: {
          fontWeight: '600',
        },
      },
    },
  },
  primitive: {
    // Danger severity reads red.500 in light and red.400 in dark.
    red: {
      400: 'var(--dl-red-400)',
      500: 'var(--dl-red-600)',
    },
  },
  semantic: {
    primary: teal,
    colorScheme: {
      light: {
        surface,
        primary: {
          color: '{primary.500}',
          contrastColor: 'var(--dl-white)',
          hoverColor: '{primary.700}',
          activeColor: '{primary.800}',
        },
        highlight: {
          background: '{primary.100}',
          focusBackground: '{primary.200}',
          color: '{primary.700}',
          focusColor: '{primary.800}',
        },
        text: {
          color: 'var(--dl-ink-900)',
          hoverColor: 'var(--dl-ink-900)',
          mutedColor: 'var(--dl-slate-600)',
          hoverMutedColor: 'var(--dl-slate-700)',
        },
        content: {
          background: 'var(--dl-white)',
          borderColor: 'var(--dl-mist-300)',
        },
      },
      dark: {
        surface,
        primary: {
          color: '{primary.400}',
          contrastColor: 'var(--dl-ink-950)',
          hoverColor: '{primary.300}',
          activeColor: '{primary.200}',
        },
        highlight: {
          background: '{primary.900}',
          focusBackground: '{primary.800}',
          color: '{primary.300}',
          focusColor: '{primary.300}',
        },
        text: {
          color: 'var(--dl-mist-50)',
          hoverColor: 'var(--dl-white)',
          mutedColor: 'var(--dl-slate-400)',
          hoverMutedColor: 'var(--dl-slate-300)',
        },
        content: {
          background: 'var(--dl-ink-900)',
          borderColor: 'var(--dl-ink-700)',
        },
      },
    },
  },
});
