import { DATE_PIPE_DEFAULT_OPTIONS } from '@angular/common';

export const provideDefaultDataTimeFormat = () => {
  return {
    provide: DATE_PIPE_DEFAULT_OPTIONS,
    useValue: { dateFormat: 'dd/MM/yyyy HH:mm:ss' },
  };
};
