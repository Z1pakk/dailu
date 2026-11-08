import { ClockHabit, clockSummary, resolveClockHabits } from './day-clock.model';

const habit = (id: string, start: number, extra: Partial<ClockHabit> = {}): ClockHabit => ({
  id,
  name: id,
  startMinutes: start,
  endMinutes: start + 30,
  source: 'manual',
  doneLabel: 'by you',
  waitingLabel: 'not done yet',
  ...extra,
});

describe('resolveClockHabits', () => {
  it('should resolve by the clock when habits have no completion flag', () => {
    const views = resolveClockHabits([habit('a', 360), habit('b', 720), habit('c', 1080)], 730);
    expect(views.map((v) => v.state)).toEqual(['done', 'next', 'scheduled']);
  });

  it('should resolve by completion when habits carry isDone', () => {
    const views = resolveClockHabits(
      [
        habit('a', 360, { isDone: false }),
        habit('b', 720, { isDone: true }),
        habit('c', 1080, { isDone: false }),
      ],
      1200,
    );
    expect(views.map((v) => v.state)).toEqual(['next', 'done', 'scheduled']);
    expect(clockSummary(views)).toEqual(
      jasmine.objectContaining({ done: 1, total: 3, next: jasmine.objectContaining({ id: 'a' }) }),
    );
  });

  it('should have no next habit once every habit is done', () => {
    const views = resolveClockHabits([habit('a', 360, { isDone: true })], 0);
    expect(clockSummary(views).next).toBeNull();
  });
});
