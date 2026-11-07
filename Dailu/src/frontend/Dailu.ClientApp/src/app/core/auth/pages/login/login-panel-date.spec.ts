import { loginPanelDate } from './login-panel-date';

describe('loginPanelDate', () => {
  it('should format the Figma example date', () => {
    expect(loginPanelDate(new Date(2026, 10, 5))).toBe('TODAY · THU 5 NOV');
  });

  it('should not pad two-digit days', () => {
    expect(loginPanelDate(new Date(2026, 0, 31))).toBe('TODAY · SAT 31 JAN');
  });
});
