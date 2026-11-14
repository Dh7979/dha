// Fixed monthly expenses (월세, 구독료…): recorded automatically once their day comes.
import type {Expense} from './useDha';

export type Fixed = {id: string; name: string; amount: number; cat: string; day: number};
export type BudgetDoc = {monthly?: number; cats?: Record<string, number>; fixed?: Fixed[]; skip?: string[]};

export function daysInMonth(m: string) {
  const [y, mo] = m.split('-').map(Number);
  return new Date(Date.UTC(y, mo, 0)).getUTCDate();
}

/** Stable id, so the same fixed item is never recorded twice in a month (even from two devices). */
export const fixedId = (f: Fixed, month: string) => `fx-${f.id}-${month}`;

/** Day the item falls on in `month` (31 → the last day of shorter months). */
export const fixedDate = (f: Fixed, month: string) => `${month}-${String(Math.min(Math.max(1, f.day), daysInMonth(month))).padStart(2, '0')}`;

/**
 * Entries still to be recorded for `month`: their day has come (≤ today), they aren't in the
 * month yet, and the viewer hasn't deleted them (`skip`).
 */
export function dueFixed(fixed: Fixed[], month: string, today: string, existing: Expense[], skip: string[] = [], now = Date.now()): Expense[] {
  if (today.slice(0, 7) !== month) return [];
  return fixed
    .filter((f) => f.amount > 0)
    .map((f) => ({f, id: fixedId(f, month), date: fixedDate(f, month)}))
    .filter(({id, date}) => date <= today && !existing.some((x) => x.id === id) && !skip.includes(id))
    .map(({f, id, date}) => ({id, date, amount: f.amount, cat: f.cat, memo: f.name, createdAt: now, fixed: true}));
}

/** Keep only skip markers for the current and previous month. */
export const pruneSkip = (skip: string[], months: string[]) => skip.filter((id) => months.some((m) => id.endsWith('-' + m)));
