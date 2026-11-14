// Trends for the 기록 tab: sleep, mood, spending and routines over the last 7 or 30 days.
import {addDays} from './dates';
import {sleepMinutes, type Expense, type Habit, type Journal, type Sleep} from './useDha';

export type StatsInput = {
  today: string;
  days: number;
  sleep: Record<string, Sleep>;
  journal: Journal[];
  habits: Habit[];
  expenses: Expense[];
};

export type Stats = {
  dates: string[];
  sleep: Array<number | null>;
  mood: Array<number | null>;
  spend: number[];
  avgSleep: number | null;
  avgMood: number | null;
  totalSpend: number;
  routineRate: number | null;
  /** Average mood on nights with ≥ 7h sleep vs. shorter nights (needs 2+ days on each side). */
  sleepMood: {rested: number; short: number} | null;
};

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const present = <T,>(xs: Array<T | null>) => xs.filter((x): x is T => x != null);

export function computeStats({today, days, sleep, journal, habits, expenses}: StatsInput): Stats {
  const dates = Array.from({length: days}, (_, i) => addDays(today, i - days + 1));
  const moodBy: Record<string, number> = {};
  journal.forEach((j) => {
    if (j.mood) moodBy[j.date] = j.mood;
  });
  const sleepArr = dates.map((k) => (sleep[k] ? sleepMinutes(sleep[k]) : null));
  const moodArr = dates.map((k) => moodBy[k] ?? null);
  const spend = dates.map((k) => expenses.filter((x) => x.date === k).reduce((s, x) => s + x.amount, 0));

  let checks = 0;
  habits.forEach((h) => dates.forEach((k) => h.log?.[k] && checks++));
  const routineRate = habits.length ? Math.round((checks / (habits.length * days)) * 100) : null;

  const rested: number[] = [];
  const short: number[] = [];
  dates.forEach((_, i) => {
    const s = sleepArr[i];
    const m = moodArr[i];
    if (s == null || m == null) return;
    (s >= 420 ? rested : short).push(m);
  });
  const sleepMood = rested.length >= 2 && short.length >= 2 ? {rested: avg(rested)!, short: avg(short)!} : null;

  const s = avg(present(sleepArr));
  return {
    dates,
    sleep: sleepArr,
    mood: moodArr,
    spend,
    avgSleep: s == null ? null : Math.round(s),
    avgMood: avg(present(moodArr)),
    totalSpend: spend.reduce((a, b) => a + b, 0),
    routineRate,
    sleepMood,
  };
}
