// Unit tests for the date-heavy logic: repeats, streaks, sleep, fixed expenses, stats, weather.
import {describe, expect, it} from 'vitest';
import {addDays, diffDays, dow} from './dates';
import {currentSlot, isDone, repeatsOn, sleepMinutes, streak, monthOf, prevMonth, type Habit, type Todo} from './useDha';
import {daysInMonth, dueFixed, fixedDate, pruneSkip, type Fixed} from './fixed';
import {computeStats} from './stats';
import {describe as sky, pmGrade, tip, type Weather} from './weather';

const todo = (p: Partial<Todo>): Todo => ({id: 't', title: 'x', done: false, created: '2026-11-01', doneDate: null, ...p});

describe('dates', () => {
  it('adds days across month and year ends', () => {
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDays('2028-03-01', -1)).toBe('2028-02-29');
  });
  it('counts days and weekdays', () => {
    expect(diffDays('2026-11-14', '2026-11-21')).toBe(7);
    expect(diffDays('2026-11-14', '2026-11-13')).toBe(-1);
    expect(dow('2026-11-14')).toBe(6); // Saturday
  });
  it('months', () => {
    expect(monthOf('2026-11-14')).toBe('2026-11');
    expect(prevMonth('2026-01')).toBe('2025-12');
    expect(daysInMonth('2026-02')).toBe(28);
    expect(daysInMonth('2028-02')).toBe(29);
  });
});

describe('repeating to-dos', () => {
  it('daily, weekdays and weekly', () => {
    expect(repeatsOn(todo({repeat: 'daily'}), '2026-11-15')).toBe(true);
    expect(repeatsOn(todo({repeat: 'weekdays'}), '2026-11-14')).toBe(false); // Sat
    expect(repeatsOn(todo({repeat: 'weekdays'}), '2026-11-16')).toBe(true); // Mon
    expect(repeatsOn(todo({repeat: 'weekly', repeatDow: 1}), '2026-11-16')).toBe(true);
    expect(repeatsOn(todo({repeat: 'weekly', repeatDow: 1}), '2026-11-17')).toBe(false);
    // weekly without repeatDow follows the creation weekday (2026-11-01 is a Sunday)
    expect(repeatsOn(todo({repeat: 'weekly'}), '2026-11-08')).toBe(true);
  });
  it('done state resets every day for repeats only', () => {
    expect(isDone(todo({repeat: 'daily', lastDone: '2026-11-13'}), '2026-11-14')).toBe(false);
    expect(isDone(todo({repeat: 'daily', lastDone: '2026-11-14'}), '2026-11-14')).toBe(true);
    expect(isDone(todo({done: true, doneDate: '2026-11-10'}), '2026-11-14')).toBe(true);
  });
});

describe('routines', () => {
  const h = (log: Habit['log']): Habit => ({id: 'h', name: 'x', log});
  it('streak counts back from today, or from yesterday when today is still open', () => {
    expect(streak(h({'2026-11-12': true, '2026-11-13': true, '2026-11-14': 20}), '2026-11-14')).toBe(3);
    expect(streak(h({'2026-11-12': true, '2026-11-13': true}), '2026-11-14')).toBe(2);
    expect(streak(h({'2026-11-11': true, '2026-11-13': true}), '2026-11-14')).toBe(1);
    expect(streak(h({}), '2026-11-14')).toBe(0);
  });
  it('morning until 2 pm', () => {
    expect(currentSlot(13)).toBe('morning');
    expect(currentSlot(14)).toBe('evening');
  });
});

describe('sleep', () => {
  it('handles going to bed before and after midnight', () => {
    expect(sleepMinutes({bed: '23:30', wake: '07:00', q: null})).toBe(450);
    expect(sleepMinutes({bed: '01:00', wake: '08:30', q: null})).toBe(450);
  });
});

describe('fixed expenses', () => {
  const rent: Fixed = {id: 'r', name: '월세', amount: 500000, cat: 'living', day: 25};
  const netflix: Fixed = {id: 'n', name: '넷플릭스', amount: 17000, cat: 'culture', day: 31};
  it('records only items whose day has come, once', () => {
    expect(dueFixed([rent], '2026-11', '2026-11-24', [])).toHaveLength(0);
    const due = dueFixed([rent], '2026-11', '2026-11-25', [], [], 1);
    expect(due).toEqual([{id: 'fx-r-2026-11', date: '2026-11-25', amount: 500000, cat: 'living', memo: '월세', createdAt: 1, fixed: true}]);
    expect(dueFixed([rent], '2026-11', '2026-11-30', due)).toHaveLength(0);
  });
  it('day 31 falls on the last day of shorter months', () => {
    expect(fixedDate(netflix, '2026-11')).toBe('2026-11-30');
    expect(fixedDate(netflix, '2026-02')).toBe('2026-02-28');
    expect(dueFixed([netflix], '2026-11', '2026-11-30', [])).toHaveLength(1);
  });
  it('respects deleted entries and other months', () => {
    expect(dueFixed([rent], '2026-11', '2026-11-26', [], ['fx-r-2026-11'])).toHaveLength(0);
    expect(dueFixed([rent], '2026-10', '2026-11-26', [])).toHaveLength(0);
    expect(pruneSkip(['fx-r-2026-09', 'fx-r-2026-10', 'fx-r-2026-11'], ['2026-11', '2026-10'])).toEqual(['fx-r-2026-10', 'fx-r-2026-11']);
  });
});

describe('stats', () => {
  it('averages, totals and the sleep–mood insight', () => {
    const today = '2026-11-14';
    const s = computeStats({
      today,
      days: 7,
      sleep: {
        '2026-11-10': {bed: '23:00', wake: '07:00', q: null}, // 8h
        '2026-11-11': {bed: '23:00', wake: '07:30', q: null}, // 8.5h
        '2026-11-12': {bed: '01:00', wake: '06:00', q: null}, // 5h
        '2026-11-13': {bed: '02:00', wake: '07:00', q: null}, // 5h
      },
      journal: [
        {date: '2026-11-10', mood: 5, text: ''},
        {date: '2026-11-11', mood: 4, text: ''},
        {date: '2026-11-12', mood: 2, text: ''},
        {date: '2026-11-13', mood: 3, text: ''},
      ],
      habits: [{id: 'a', name: 'a', log: {'2026-11-14': true, '2026-11-13': true}}],
      expenses: [
        {id: '1', date: '2026-11-14', amount: 1000, cat: 'food', createdAt: 0},
        {id: '2', date: '2026-11-01', amount: 9999, cat: 'food', createdAt: 0},
      ],
    });
    expect(s.dates[0]).toBe(addDays(today, -6));
    expect(s.dates[6]).toBe(today);
    expect(s.avgSleep).toBe(398); // (480 + 510 + 300 + 300) / 4 = 397.5
    expect(s.avgMood).toBe(3.5);
    expect(s.totalSpend).toBe(1000);
    expect(s.routineRate).toBe(29); // 2 of 7
    expect(s.sleepMood).toEqual({rested: 4.5, short: 2.5});
  });
  it('no insight with too little data', () => {
    const s = computeStats({today: '2026-11-14', days: 7, sleep: {}, journal: [], habits: [], expenses: []});
    expect(s.sleepMood).toBeNull();
    expect(s.routineRate).toBeNull();
    expect(s.avgSleep).toBeNull();
  });
});

describe('weather', () => {
  const w = (p: Partial<Weather>): Weather => ({temp: 10, feels: 9, code: 0, max: 14, min: 6, rain: 0, pm10: 20, pm25: 10, at: 0, ...p});
  it('labels and grades', () => {
    expect(sky(0).l).toBe('맑음');
    expect(sky(63).l).toBe('비');
    expect(sky(73).l).toBe('눈');
    expect(pmGrade('pm10', 30)).toBe('좋음');
    expect(pmGrade('pm10', 81)).toBe('나쁨');
    expect(pmGrade('pm25', 76)).toBe('매우 나쁨');
    expect(pmGrade('pm25', null)).toBeNull();
  });
  it('one tip, rain first', () => {
    expect(tip(w({rain: 70, pm10: 200}))).toContain('우산');
    expect(tip(w({pm25: 50}))).toContain('마스크');
    expect(tip(w({max: 20, min: 5}))).toContain('일교차');
    expect(tip(w({}))).toBeNull();
  });
});
