import { definePreset } from '@primeng/themes';
import Aura from '@primeng/themes/aura';

export const DefaultPreset = definePreset(Aura, {
  semantic: {
    primary: {
      50: 'var(--color-blue-50)',
      100: 'var(--color-blue-100)',
      200: 'var(--color-blue-200)',
      300: 'var(--color-blue-300)',
      400: 'var(--color-blue-400)',
      500: 'var(--color-blue-500)',
      600: 'var(--color-blue-600)',
      700: 'var(--color-blue-700)',
      800: 'var(--color-blue-800)',
      900: 'var(--color-blue-950)',
    },
    colorScheme: {
      light: {
        primary: {
          color: '{primary.500}',
          hoverColor: '{primary.600}',
          activeColor: '{primary.700}',
        },
      },
      dark: {
        primary: {
          color: '{primary.400}',
          hoverColor: '{primary.300}',
          activeColor: '{primary.200}',
        },
      },
    },
  },
});
