import { formatRingDuration, placeLabels, sampleClockHabits, sampleTimeline } from './sample-day';

describe('sample-day', () => {
  it('should colour slots by the real time: done, active, later', () => {
    const { slots } = sampleTimeline(new Date('2026-11-12T16:12:00'));
    const state = (name: string) => slots.find((s) => s.name === name)!.state;
    expect(state('Morning run')).toBe('done');
    expect(state('Take a pill')).toBe('done');
    expect(state('Work')).toBe('active');
    expect(state('Embedded lessons')).toBe('later');
    expect(state('Sleep')).toBe('later');
  });

  it('should clip Sleep at midnight and total the planned time inside the day', () => {
    const { slots, planned } = sampleTimeline(new Date('2026-11-12T12:00:00'));
    const sleep = slots.find((s) => s.name === 'Sleep')!;
    expect(sleep.left + sleep.width).toBeCloseTo(1, 5);
    expect(planned).toBe('12 h 50 m');
  });

  it('should give the dial the same six habits', () => {
    expect(sampleClockHabits().map((h) => h.name)).toEqual([
      'Morning run', 'Take a pill', 'Work', 'Embedded lessons', 'Evening walk', 'Sleep',
    ]);
  });

  describe('formatRingDuration', () => {
    it('should fit the ring: 45m, 1h30, 2h', () => {
      expect(formatRingDuration(45)).toBe('45m');
      expect(formatRingDuration(90)).toBe('1h30');
      expect(formatRingDuration(120)).toBe('2h');
      expect(formatRingDuration(480)).toBe('8h');
      expect(formatRingDuration(5)).toBe('5m');
    });
  });

  describe('placeLabels', () => {
    // 10 px per character keeps the arithmetic readable.
    const place = (labels: { name: string; left: number }[], trackPx: number) => placeLabels(labels, trackPx, 10, 6);

    it('should keep labels on the first row when they fit', () => {
      const out = place([{ name: 'Run', left: 0 }, { name: 'Work', left: 0.5 }], 400);
      expect(out.map((l) => l.row)).toEqual([0, 0]);
      expect(out[1]!.left).toBe(0.5);
    });

    it('should drop a label to the next row when it would touch the previous one', () => {
      // "Embedded lessons" (160 px) from 280 px reaches 440 px; "Evening walk" starts at 400 px.
      const out = place([{ name: 'Embedded lessons', left: 0.4 }, { name: 'Evening walk', left: 400 / 700 }], 700);
      expect(out.map((l) => l.row)).toEqual([0, 1]);
    });

    it('should go back to the first row once there is room again', () => {
      const out = place(
        [{ name: 'Morning run', left: 0 }, { name: 'Take a pill', left: 0.05 }, { name: 'Work', left: 0.5 }],
        600,
      );
      expect(out.map((l) => l.row)).toEqual([0, 1, 0]);
    });

    it('should pull a label inside the right edge', () => {
      const out = place([{ name: 'Sleep', left: 0.95 }], 400); // 50 px wide from 380 px would end at 430
      expect(out[0]!.left).toBeCloseTo((400 - 50) / 400, 5);
    });

    it('should use the least crowded row when every row is taken', () => {
      const out = place([{ name: 'AAAAAAAAAA', left: 0 }, { name: 'BBBBBBBBBB', left: 0.01 }, { name: 'C', left: 0.02 }], 400);
      expect(out[2]!.row === 0 || out[2]!.row === 1).toBeTrue();
    });
  });
});
