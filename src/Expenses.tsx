// 지출: month switcher, total + "compared with last month" insight, a week strip with daily totals,
// a list grouped by day, and an amount keypad sheet with smart defaults.
import {useEffect, useMemo, useState} from 'react';
import {VStack} from '@astryxdesign/core/VStack';
import {HStack} from '@astryxdesign/core/HStack';
import {Grid} from '@astryxdesign/core/Grid';
import {ClickableCard} from '@astryxdesign/core/ClickableCard';
import {Text} from '@astryxdesign/core/Text';
import {Heading} from '@astryxdesign/core/Heading';
import {Button} from '@astryxdesign/core/Button';
import {IconButton} from '@astryxdesign/core/IconButton';
import {Icon} from '@astryxdesign/core/Icon';
import {Token} from '@astryxdesign/core/Token';
import {List, ListItem} from '@astryxdesign/core/List';
import {TextInput} from '@astryxdesign/core/TextInput';
import {ProgressBar} from '@astryxdesign/core/ProgressBar';
import {SegmentedControl, SegmentedControlItem} from '@astryxdesign/core/SegmentedControl';
import {BackspaceIcon, ChevronLeftIcon, ChevronRightIcon, PlusIcon, XMarkIcon} from '@heroicons/react/24/outline';
import {addDays, DOW, dow, shortDate, uid} from './lib/dates';
import {monthOf, prevMonth, type Expense} from './lib/useDha';
import {Cta, Panel, recall, remember, Sheet, StoreGate, TabTitle, useNotify, type Dha} from './ui';

export const EXPENSE_CATS = [
  {k: 'food', l: '식비', e: '🍚'},
  {k: 'cafe', l: '카페', e: '☕'},
  {k: 'transport', l: '교통', e: '🚌'},
  {k: 'shopping', l: '쇼핑', e: '🛍️'},
  {k: 'living', l: '생활', e: '🏠'},
  {k: 'culture', l: '문화·여가', e: '🎬'},
  {k: 'etc', l: '기타', e: '📦'},
];
const catOf = (k: string) => EXPENSE_CATS.find((c) => c.k === k) || EXPENSE_CATS[EXPENSE_CATS.length - 1];
export const won = (n: number) => n.toLocaleString('ko-KR') + '원';
const short = (n: number) => (n >= 10000 ? `${Math.round(n / 1000) / 10}만` : n.toLocaleString('ko-KR'));
const digits = (s: string) => s.replace(/[^0-9]/g, '').replace(/^0+(?=\d)/, '').slice(0, 10);
const pretty = (s: string) => (s ? Number(s).toLocaleString('ko-KR') : '');
const sum = (xs: Expense[]) => xs.reduce((s, x) => s + x.amount, 0);
const QUICK = [1000, 5000, 10000, 50000];
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '00', '0', 'del'];

function daysInMonth(m: string) {
  const [y, mo] = m.split('-').map(Number);
  return new Date(Date.UTC(y, mo, 0)).getUTCDate();
}
const monthLabel = (m: string) => `${Number(m.slice(5))}월`;

export function todaySpent(d: Dha, today: string) {
  return sum((d.expenses[monthOf(today)] || []).filter((x) => x.date === today));
}

function ExpenseSheet({d, today, open, setOpen}: {d: Dha; today: string; open: boolean; setOpen: (o: boolean) => void}) {
  const notify = useNotify();
  const month = monthOf(today);
  const [amount, setAmount] = useState('');
  const [cat, setCat] = useState(() => recall('cat', 'food'));
  const [memo, setMemo] = useState('');
  useEffect(() => {
    if (open) setCat(recall('cat', 'food'));
  }, [open]);
  const press = (k: string) =>
    setAmount((a) => (k === 'del' ? a.slice(0, -1) : digits(a + k)));
  const add = () => {
    const n = Number(amount);
    if (!n) return '금액을 입력해 주세요.';
    if (!d.writable) return '저장소에 연결된 뒤에 기록할 수 있어요.';
    const before = d.expenses[month] || [];
    const item: Expense = {id: uid(), date: today, amount: n, cat, createdAt: Date.now()};
    if (memo.trim()) item.memo = memo.trim();
    d.saveExpenses(month, [...before, item]);
    remember('cat', cat);
    notify(`${won(n)} 기록했어요`, () => d.saveExpenses(month, before));
    setAmount('');
    setMemo('');
    setOpen(false);
  };
  return (
    <Sheet isOpen={open} onOpenChange={setOpen} title="얼마를 썼나요?" cta={amount ? `${pretty(amount)}원 기록하기` : '기록하기'} onSubmit={add}>
      <VStack gap={1}>
        <Text type="display-2" color={amount ? 'primary' : 'secondary'} hasTabularNumbers justify="center">
          {amount ? `${pretty(amount)}원` : '0원'}
        </Text>
        <HStack gap={1} justify="center" wrap="wrap">
          {QUICK.map((q) => (
            <Button key={q} label={`+${short(q)}`} size="sm" variant="secondary" onClick={() => setAmount(String(Number(amount || 0) + q))} />
          ))}
        </HStack>
      </VStack>
      <Grid columns={3} gap={1}>
        {KEYS.map((k) =>
          k === 'del' ? (
            <IconButton key={k} label="한 글자 지우기" icon={<Icon icon={BackspaceIcon} />} variant="ghost" size="lg" width="100%" onClick={() => press(k)} />
          ) : (
            <Button key={k} label={k} variant="ghost" size="lg" width="100%" onClick={() => press(k)} />
          ),
        )}
      </Grid>
      <VStack gap={2}>
        <Text type="label">어디에 썼나요?</Text>
        <HStack gap={1} wrap="wrap">
          {EXPENSE_CATS.map((c) => (
            <Token key={c.k} size="lg" label={`${c.e} ${c.l}`} color={cat === c.k ? 'gray' : 'default'} onClick={() => setCat(c.k)} description={cat === c.k ? '선택됨' : undefined} endContent={cat === c.k ? '✓' : undefined} />
          ))}
        </HStack>
      </VStack>
      <TextInput autoComplete="off" label="메모 (선택)" placeholder="예: 점심, 택시…" value={memo} onChange={setMemo} />
    </Sheet>
  );
}

function BudgetSheet({d, open, setOpen}: {d: Dha; open: boolean; setOpen: (o: boolean) => void}) {
  const notify = useNotify();
  const [draft, setDraft] = useState(d.budget ? String(d.budget) : '');
  const save = () => {
    const n = Number(draft);
    const before = d.budget;
    d.saveBudget(n > 0 ? n : null);
    notify(n > 0 ? `한 달 예산을 ${won(n)}으로 정했어요` : '예산을 지웠어요', () => d.saveBudget(before));
    setOpen(false);
  };
  return (
    <Sheet isOpen={open} onOpenChange={setOpen} title="한 달 예산" cta="저장하기" onSubmit={save}>
      <TextInput autoComplete="off"
        label="예산"
        isLabelHidden
        description="비워 두고 저장하면 예산 없이 합계만 보여줘요."
        placeholder="예: 800,000원…"
        inputMode="numeric"
        size="lg"
        value={draft ? pretty(draft) + '원' : ''}
        onChange={(v) => setDraft(digits(v))}
       
      />
    </Sheet>
  );
}

/** Seven days ending on `end`, each with its daily total; tap to filter the list. */
function WeekStrip({items, end, today, selected, onSelect}: {items: Expense[]; end: string; today: string; selected: string | null; onSelect: (k: string | null) => void}) {
  const days = Array.from({length: 7}, (_, i) => addDays(end, i - 6));
  return (
    <Grid columns={7} gap={0.5}>
      {days.map((k) => {
        const t = sum(items.filter((x) => x.date === k));
        const on = selected === k;
        const future = k > today;
        return (
          <ClickableCard
            key={k}
            label={`${shortDate(k)} ${won(t)}${on ? ', 선택됨' : ''}`}
            padding={1}
            variant={on ? 'gray' : k === today ? 'muted' : 'transparent'}
            isDisabled={future}
            onClick={() => onSelect(on ? null : k)}
          >
            <VStack gap={0} hAlign="center">
              <Text type="supporting" size="xs">
                {DOW[dow(k)]}
              </Text>
              <Text weight={on || k === today ? 'bold' : 'medium'} hasTabularNumbers>
                {Number(k.slice(8))}
              </Text>
              <Text type="supporting" size="2xs" color={t ? 'primary' : 'secondary'} hasTabularNumbers maxLines={1}>
                {t ? short(t) : '·'}
              </Text>
            </VStack>
          </ClickableCard>
        );
      })}
    </Grid>
  );
}

export function MoneyTab({d, today, intent, onIntent}: {d: Dha; today: string; intent?: string | null; onIntent?: () => void}) {
  const notify = useNotify();
  const thisMonth = monthOf(today);
  const [month, setMonth] = useState(thisMonth);
  const [view, setView] = useState('days');
  const [addOpen, setAddOpen] = useState(false);
  const [budgetOpen, setBudgetOpen] = useState(false);
  const [day, setDay] = useState<string | null>(null);
  useEffect(() => {
    if (intent === 'add') {
      setAddOpen(true);
      onIntent?.();
    }
  }, [intent, onIntent]);

  const items = useMemo(() => d.expenses[month] || [], [d.expenses, month]);
  const isCurrent = month === thisMonth;
  const total = sum(items);
  const lastMonth = prevMonth(thisMonth);
  // Same span of days in the previous month, for a fair "지난달보다" comparison.
  const dayOfMonth = Number(today.slice(8, 10));
  const prevSameSpan = sum((d.expenses[lastMonth] || []).filter((x) => Number(x.date.slice(8, 10)) <= dayOfMonth));
  const delta = total - prevSameSpan;
  const byCat = EXPENSE_CATS.map((c) => ({...c, s: sum(items.filter((x) => x.cat === c.k))}))
    .filter((c) => c.s > 0)
    .sort((a, b) => b.s - a.s);
  const filtered = day ? items.filter((x) => x.date === day) : items;
  const groups = useMemo(() => {
    const m = new Map<string, Expense[]>();
    [...filtered]
      .sort((a, b) => (a.date === b.date ? b.createdAt - a.createdAt : a.date < b.date ? 1 : -1))
      .forEach((x) => m.set(x.date, [...(m.get(x.date) || []), x]));
    return [...m.entries()];
  }, [filtered]);
  const stripEnd = isCurrent ? today : `${month}-${String(daysInMonth(month)).padStart(2, '0')}`;
  const daysLeft = daysInMonth(thisMonth) - dayOfMonth + 1;
  const monthTotalNow = sum(d.expenses[thisMonth] || []);
  const remaining = d.budget ? d.budget - monthTotalNow : 0;
  const ratio = d.budget ? monthTotalNow / d.budget : 0;

  const remove = (x: Expense) => {
    const before = d.expenses[month] || [];
    d.saveExpenses(month, before.filter((y) => y.id !== x.id));
    notify(`${won(x.amount)} 내역을 지웠어요`, () => d.saveExpenses(month, before));
  };

  return (
    <VStack gap={3}>
      <TabTitle
        eyebrow={
          <HStack gap={1} vAlign="center">
            <IconButton label="이전 달" icon={<Icon icon={ChevronLeftIcon} />} variant="ghost" size="sm" isDisabled={!isCurrent} onClick={() => { setMonth(lastMonth); setDay(null); }} />
            <Text weight="semibold">{monthLabel(month)}에 쓴 돈</Text>
            <IconButton label="다음 달" icon={<Icon icon={ChevronRightIcon} />} variant="ghost" size="sm" isDisabled={isCurrent} onClick={() => { setMonth(thisMonth); setDay(null); }} />
          </HStack>
        }
        title={d.expLoaded ? won(total) : '–'}
        sub={
          isCurrent && d.expLoaded && prevSameSpan
            ? delta <= 0
              ? `지난달 같은 기간보다 ${won(-delta)} 덜 쓰는 중이에요`
              : `지난달 같은 기간보다 ${won(delta)} 더 쓰는 중이에요`
            : isCurrent
              ? `오늘 ${won(todaySpent(d, today))}`
              : '지난달 기록이에요'
        }
      />

      {isCurrent ? (
        <Panel title="예산" end={<Button label={d.budget ? '수정' : '설정'} size="sm" variant="secondary" onClick={() => setBudgetOpen(true)} />}>
          {d.budget ? (
            <VStack gap={2}>
              <HStack gap={2} justify="between" vAlign="end" wrap="wrap">
                <Text type="large" weight="bold" hasTabularNumbers>
                  {remaining >= 0 ? `${won(remaining)} 남았어요` : `${won(-remaining)} 넘었어요`}
                </Text>
                <Text type="supporting" size="sm" hasTabularNumbers>
                  {Math.round(ratio * 100)}% 사용
                </Text>
              </HStack>
              <ProgressBar label="이번 달 예산 사용률" isLabelHidden value={Math.min(monthTotalNow, d.budget)} max={d.budget} variant={ratio >= 1 ? 'error' : ratio >= 0.8 ? 'warning' : 'accent'} />
              <Text type="supporting" size="sm" hasTabularNumbers>
                {remaining > 0 ? `남은 ${daysLeft}일 동안 하루 ${won(Math.floor(remaining / daysLeft))}씩 쓸 수 있어요` : `예산 ${won(d.budget)}`}
              </Text>
            </VStack>
          ) : (
            <Text type="supporting">한 달 예산을 정하면 남은 금액과 하루에 쓸 수 있는 금액을 알려드려요.</Text>
          )}
        </Panel>
      ) : null}

      <Panel
        title={day ? `${shortDate(day)} 내역` : '내역'}
        end={day ? <Button label="전체 보기" size="sm" variant="secondary" onClick={() => setDay(null)} /> : undefined}
      >
        <StoreGate d={d} ready={d.expLoaded}>
          <WeekStrip items={items} end={stripEnd} today={today} selected={day} onSelect={setDay} />
          {items.length ? (
            <VStack gap={3}>
              {!day ? (
                <SegmentedControl label="내역 보기" layout="fill" value={view} onChange={setView}>
                  <SegmentedControlItem value="days" label="날짜별" />
                  <SegmentedControlItem value="cats" label="항목별" />
                </SegmentedControl>
              ) : null}
              {view === 'days' || day ? (
                groups.length ? (
                  <VStack gap={4}>
                    {groups.map(([k, xs]) => (
                      <VStack key={k} gap={1}>
                        <HStack gap={2} justify="between" vAlign="end">
                          <Heading level={4}>
                            {k === today ? '오늘' : k === addDays(today, -1) ? '어제' : `${Number(k.slice(8))}일 ${DOW[dow(k)]}요일`}
                          </Heading>
                          <Text type="supporting" size="sm" hasTabularNumbers>
                            {won(sum(xs))}
                          </Text>
                        </HStack>
                        <List hasDividers edge="flush">
                          {xs.map((x) => {
                            const c = catOf(x.cat);
                            return (
                              <ListItem
                                key={x.id}
                                itemKey={x.id}
                                startContent={<Text type="large">{c.e}</Text>}
                                label={
                                  <Text type="large" weight="bold" hasTabularNumbers>
                                    -{won(x.amount)}
                                  </Text>
                                }
                                description={x.memo ? `${x.memo} · ${c.l}` : c.l}
                                endContent={<IconButton label="지출 삭제" icon={<Icon icon={XMarkIcon} />} variant="ghost" size="sm" onClick={() => remove(x)} />}
                              />
                            );
                          })}
                        </List>
                      </VStack>
                    ))}
                  </VStack>
                ) : (
                  <Text type="supporting">이날은 기록이 없어요.</Text>
                )
              ) : (
                <VStack gap={3}>
                  {byCat.map((c) => (
                    <VStack key={c.k} gap={1}>
                      <HStack gap={2} justify="between">
                        <Text type="large">
                          {c.e} {c.l}
                        </Text>
                        <Text type="large" weight="semibold" hasTabularNumbers>
                          {won(c.s)}
                        </Text>
                      </HStack>
                      <HStack gap={2} vAlign="center">
                        <VStack width="100%">
                          <ProgressBar label={`${c.l} 비중`} isLabelHidden value={c.s} max={total} />
                        </VStack>
                        <Text type="supporting" size="xsm" hasTabularNumbers>
                          {Math.round((c.s / total) * 100)}%
                        </Text>
                      </HStack>
                    </VStack>
                  ))}
                </VStack>
              )}
            </VStack>
          ) : (
            <Text type="supporting">{isCurrent ? '이번 달 지출 기록이 없어요.' : '지난달 지출 기록이 없어요.'}</Text>
          )}
        </StoreGate>
      </Panel>

      {isCurrent ? <Cta label="지출 기록하기" icon={<Icon icon={PlusIcon} />} onClick={() => setAddOpen(true)} /> : null}
      <ExpenseSheet d={d} today={today} open={addOpen} setOpen={setAddOpen} />
      {budgetOpen ? <BudgetSheet d={d} open={budgetOpen} setOpen={setBudgetOpen} /> : null}
    </VStack>
  );
}

// For the weekly review prompt.
export function weekExpenseLines(d: Dha, today: string) {
  const from = addDays(today, -6);
  const all = [...(d.expenses[monthOf(today)] || []), ...(monthOf(from) !== monthOf(today) ? d.expenses[monthOf(from)] || [] : [])];
  const week = all.filter((x) => x.date >= from && x.date <= today);
  const lines = [`[최근 7일 지출] 합계 ${won(sum(week))}`];
  EXPENSE_CATS.forEach((c) => {
    const s = sum(week.filter((x) => x.cat === c.k));
    if (s) lines.push(`${c.l}: ${won(s)}`);
  });
  if (d.budget) lines.push(`이번 달 예산 ${won(d.budget)} 중 ${won(sum(d.expenses[monthOf(today)] || []))} 사용`);
  return lines.join('\n');
}
