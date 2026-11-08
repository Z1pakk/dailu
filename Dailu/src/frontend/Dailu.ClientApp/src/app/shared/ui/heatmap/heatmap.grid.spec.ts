import { buildRecentWeeks } from './heatmap.grid';

describe('buildRecentWeeks', () => {
  const end = new Date(2026, 10, 5); // Thu 5 Nov 2026

  it('should build the requested number of Monday-first weeks ending this week', () => {
    const weeks = buildRecentWeeks(end, 20, new Map(), 4);
    expect(weeks.length).toBe(20);
    expect(weeks.every((w) => w.length === 7)).toBeTrue();
    expect(weeks[19]![0]!.date).toBe('2026-11-02');
    expect(weeks[0]![0]!.date).toBe('2026-06-22');
  });

  it('should leave the days after the end date empty', () => {
    const last = buildRecentWeeks(end, 20, new Map(), 4)[19]!;
    expect(last[3]!.date).toBe('2026-11-05');
    expect(last.slice(4)).toEqual([null, null, null]);
  });

  it('should level each day by its count', () => {
    const weeks = buildRecentWeeks(end, 1, new Map([['2026-11-03', 4], ['2026-11-04', 1]]), 4);
    expect(weeks[0]![1]).toEqual({ date: '2026-11-03', count: 4, level: 4 });
    expect(weeks[0]![2]).toEqual({ date: '2026-11-04', count: 1, level: 1 });
    expect(weeks[0]![0]!.level).toBe(0);
  });
});
