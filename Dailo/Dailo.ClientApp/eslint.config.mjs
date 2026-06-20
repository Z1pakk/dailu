// @ts-check
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import angular from 'angular-eslint';

function asWarnings(config) {
  if (!config.rules) return config;
  return {
    ...config,
    rules: Object.fromEntries(
      Object.entries(config.rules).map(([rule, value]) => {
        if (Array.isArray(value)) return [rule, ['warn', ...value.slice(1)]];
        if (value === 'error' || value === 2) return [rule, 'warn'];
        return [rule, value];
      }),
    ),
  };
}

export default tseslint.config(
  {
    files: ['src/**/*.ts'],
    extends: [
      asWarnings(eslint.configs.recommended),
      ...tseslint.configs.recommended.map(asWarnings),
      ...angular.configs.tsRecommended.map(asWarnings),
    ],
    processor: angular.processInlineTemplates,
    rules: {
      '@angular-eslint/directive-selector': [
        'error',
        { type: 'attribute', prefix: 'app', style: 'camelCase' },
      ],
      '@angular-eslint/component-selector': [
        'error',
        { type: 'element', prefix: 'app', style: 'kebab-case' },
      ],
    },
  },
  {
    files: ['src/**/*.html'],
    extends: [...angular.configs.templateRecommended.map(asWarnings)],
    rules: {
      '@angular-eslint/template/no-inline-styles': 'error',
    },
  },
);
