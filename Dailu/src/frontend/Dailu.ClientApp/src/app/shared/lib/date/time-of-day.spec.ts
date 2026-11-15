import { dateToTimeOfDay, formatTimeOfDay, timeOfDayToDate, timeOfDayToMinutes } from './time-of-day';

describe('time-of-day', () => {
  it('should convert the wire value to minutes', () => {
    expect(timeOfDayToMinutes('07:30:00')).toBe(450);
    expect(timeOfDayToMinutes('00:00:00')).toBe(0);
    expect(timeOfDayToMinutes('23:59:00')).toBe(1439);
  });

  it('should format minutes for display', () => {
    expect(formatTimeOfDay(450)).toBe('07:30');
    expect(formatTimeOfDay(0)).toBe('00:00');
    expect(formatTimeOfDay(1439)).toBe('23:59');
  });

  it('should convert a picker date to the wire value without seconds', () => {
    expect(dateToTimeOfDay(new Date(2026, 10, 16, 7, 30, 59))).toBe('07:30:00');
  });

  it('should place the wire value on the given day', () => {
    const date = timeOfDayToDate('07:30:00', new Date(2026, 10, 16, 18, 5));

    expect(date).toEqual(new Date(2026, 10, 16, 7, 30, 0, 0));
  });

  it('should round-trip between the wire value and a date', () => {
    expect(dateToTimeOfDay(timeOfDayToDate('18:45:00'))).toBe('18:45:00');
  });
});
