import { frequencyTypes } from '@habits/enums/frequency-type.enum';
import { FrequencyModel } from '@habits/models/frequency.model';
import { frequencyFor, scheduleLabel, scheduleModeOf } from './habit-schedule';

const daily = (timesPerPeriod = 1): FrequencyModel => ({ type: frequencyTypes.daily, timesPerPeriod });
const weekly = (timesPerPeriod: number): FrequencyModel => ({ type: frequencyTypes.weekly, timesPerPeriod });
const monthly = (timesPerPeriod: number): FrequencyModel => ({ type: frequencyTypes.monthly, timesPerPeriod });

describe('habit-schedule', () => {
  describe('scheduleModeOf', () => {
    it('should map daily × 1 to daily', () => {
      expect(scheduleModeOf(daily())).toBe('daily');
    });

    it('should map weekly × 5 to weekdays', () => {
      expect(scheduleModeOf(weekly(5))).toBe('weekdays');
    });

    it('should map every other frequency to custom', () => {
      expect(scheduleModeOf(daily(3))).toBe('custom');
      expect(scheduleModeOf(weekly(3))).toBe('custom');
      expect(scheduleModeOf(monthly(2))).toBe('custom');
    });
  });

  describe('frequencyFor', () => {
    it('should save daily as daily × 1', () => {
      expect(frequencyFor('daily', weekly(3))).toEqual(daily());
    });

    it('should save weekdays as weekly × 5', () => {
      expect(frequencyFor('weekdays', monthly(2))).toEqual(weekly(5));
    });

    it('should save custom as the custom frequency', () => {
      expect(frequencyFor('custom', daily(3))).toEqual(daily(3));
    });
  });

  describe('scheduleLabel', () => {
    it('should label each frequency the way the row shows it', () => {
      expect(scheduleLabel(daily())).toBe('Daily');
      expect(scheduleLabel(weekly(5))).toBe('Weekdays');
      expect(scheduleLabel(daily(2))).toBe('2× / day');
      expect(scheduleLabel(weekly(3))).toBe('3× / week');
      expect(scheduleLabel(monthly(2))).toBe('2× / month');
    });
  });
});
