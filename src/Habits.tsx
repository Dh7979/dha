// Routines as a mission list: each row ends in one action button, headers say how many are left.
import {useState} from 'react';
import {VStack} from '@astryxdesign/core/VStack';
import {HStack} from '@astryxdesign/core/HStack';
import {Text} from '@astryxdesign/core/Text';
import {Button} from '@astryxdesign/core/Button';
import {IconButton} from '@astryxdesign/core/IconButton';
import {Icon} from '@astryxdesign/core/Icon';
import {Badge} from '@astryxdesign/core/Badge';
import {List, ListItem} from '@astryxdesign/core/List';
import {TextInput} from '@astryxdesign/core/TextInput';
import {SegmentedControl, SegmentedControlItem} from '@astryxdesign/core/SegmentedControl';
import {ProgressBar} from '@astryxdesign/core/ProgressBar';
import {StatusDot} from '@astryxdesign/core/StatusDot';
import {Switch} from '@astryxdesign/core/Switch';
import {Heading} from '@astryxdesign/core/Heading';
import {CheckIcon, PlusIcon, XMarkIcon, SunIcon, MoonIcon, ClockIcon} from '@heroicons/react/24/outline';
import {addDays, kstHour, shortDate, uid} from './lib/dates';
import {currentSlot, habitMinutes, hm, streak, type Habit} from './lib/useDha';
import {Panel, Sheet, StoreGate, useNotify, type Dha} from './ui';

const SLOTS = [
  {k: 'morning', l: '아침 루틴', icon: SunIcon},
  {k: 'evening', l: '저녁 루틴', icon: MoonIcon},
  {k: 'any', l: '언제든', icon: ClockIcon},
] as const;
const QUICK_MIN = [10, 15, 20, 30, 45, 60];
const digits = (s: string) => s.replace(/[^0-9]/g, '').slice(0, 4);

export const weekKeys = (today: string) => Array.from({length: 7}, (_, i) => addDays(today, i - 6));
export const weekMinutes = (h: Habit, today: string) => weekKeys(today).reduce((s, k) => s + habitMinutes(h, k), 0);
const fmtMin = (m: number) => (m >= 60 ? hm(m) : `${m}분`);
/** Most recent minutes logged for this habit, used as the default next time. */
function lastMinutes(h: Habit) {
  const keys = Object.keys(h.log || {}).sort().reverse();
  for (const k of keys) if (typeof h.log[k] === 'number') return h.log[k] as number;
  return 0;
}

/** Add a habit; `initialName` + `onCreated` turn a to-do into a habit. */
export function HabitSheet({
  d,
  open,
  setOpen,
  initialName = '',
  onCreated,
}: {
  d: Dha;
  open: boolean;
  setOpen: (o: boolean) => void;
  initialName?: string;
  onCreated?: () => void;
}) {
  const notify = useNotify();
  const [name, setName] = useState(initialName);
  const [slot, setSlot] = useState<Habit['slot']>(currentSlot(kstHour()));
  const [timed, setTimed] = useState(false);
  const [goal, setGoal] = useState('');
  const add = () => {
    if (!name.trim()) return '어떤 루틴인지 이름을 적어 주세요.';
    if (!d.writable) return '저장소에 연결된 뒤에 추가할 수 있어요.';
    const h: Habit = {id: uid(), name: name.trim(), log: {}, slot};
    if (timed) {
      h.timed = true;
      if (Number(goal) > 0) h.weeklyGoal = Number(goal);
    }
    const before = d.habits;
    d.saveHabits([...before, h]);
    onCreated?.();
    notify(`‘${h.name}’ 루틴을 만들었어요`, onCreated ? undefined : () => d.saveHabits(before));
    setName('');
    setTimed(false);
    setGoal('');
    setOpen(false);
  };
  return (
    <Sheet isOpen={open} onOpenChange={setOpen} title={initialName ? '루틴으로 옮기기' : '루틴 추가'} cta={initialName ? '루틴으로 옮기기' : '추가하기'} onSubmit={add}>
      <TextInput label="매일 하고 싶은 일" placeholder="예: 스픽, 헬스, 물 2L" value={name} onChange={setName} size="lg" />
      <VStack gap={2}>
        <Text type="label">언제 할까요?</Text>
        <SegmentedControl label="루틴 시간대" layout="fill" value={slot || 'any'} onChange={(v) => setSlot(v as Habit['slot'])}>
          {SLOTS.map((s) => (
            <SegmentedControlItem key={s.k} value={s.k} label={s.l.replace(' 루틴', '')} icon={<Icon icon={s.icon} />} />
          ))}
        </SegmentedControl>
      </VStack>
      <VStack gap={1}>
        <Switch label="걸린 시간도 기록하기" value={timed} onChange={(v) => setTimed(v)} />
        <Text type="supporting" size="sm">
          공부나 운동처럼 몇 분 했는지 남기고 주간 합계를 볼 수 있어요.
        </Text>
      </VStack>
      {timed ? (
        <TextInput label="주간 목표 (분)" placeholder="예: 150" inputMode="numeric" value={goal} onChange={(v) => setGoal(digits(v))} description="비워 두면 합계만 보여줘요." />
      ) : null}
    </Sheet>
  );
}

function MinutesSheet({open, setOpen, habit, onSave}: {open: boolean; setOpen: (o: boolean) => void; habit: Habit | null; onSave: (m: number) => void}) {
  const [min, setMin] = useState(() => (habit && lastMinutes(habit) ? String(lastMinutes(habit)) : ''));
  const save = () => {
    const n = Number(min);
    if (!n) return '몇 분 했는지 골라 주세요.';
    onSave(n);
    setOpen(false);
  };
  return (
    <Sheet isOpen={open} onOpenChange={setOpen} title={habit ? `${habit.name}, 몇 분 했나요?` : '몇 분 했나요?'} cta={min ? `${min}분 기록하기` : '기록하기'} onSubmit={save}>
      {habit && lastMinutes(habit) ? (
        <Text type="supporting" size="sm">
          지난번에는 {lastMinutes(habit)}분 했어요. 같으면 바로 기록하기를 누르세요.
        </Text>
      ) : null}
      <HStack gap={1} wrap="wrap">
        {QUICK_MIN.map((q) => (
          <Button key={q} label={`${q}분`} variant={Number(min) === q ? 'primary' : 'secondary'} onClick={() => setMin(String(q))} />
        ))}
      </HStack>
      <TextInput label="직접 입력 (분)" inputMode="numeric" placeholder="예: 25" value={min} onChange={(v) => setMin(digits(v))} size="lg" />
    </Sheet>
  );
}

/** Mission-style rows: name + progress line, one action button at the end. */
export function HabitList({d, today, habits, canDelete = false}: {d: Dha; today: string; habits: Habit[]; canDelete?: boolean}) {
  const notify = useNotify();
  const [timing, setTiming] = useState<Habit | null>(null);
  const week = weekKeys(today);
  const setLog = (id: string, value: boolean | number | null) => {
    const before = d.habits;
    d.saveHabits(
      before.map((h) => {
        if (h.id !== id) return h;
        const log = {...(h.log || {})};
        if (value === null) delete log[today];
        else log[today] = value;
        return {...h, log};
      }),
    );
    return before;
  };
  const complete = (h: Habit) => {
    if (h.timed) return setTiming(h);
    const before = setLog(h.id, true);
    notify(`‘${h.name}’ 완료했어요`, () => d.saveHabits(before));
  };
  const undo = (h: Habit) => setLog(h.id, null);
  const remove = (h: Habit) => {
    const before = d.habits;
    d.saveHabits(before.filter((x) => x.id !== h.id));
    notify(`‘${h.name}’ 루틴을 지웠어요`, () => d.saveHabits(before));
  };
  return (
    <>
      <List hasDividers edge="flush">
        {habits.map((h) => {
          const done = !!h.log?.[today];
          const s = streak(h, today);
          const mins = habitMinutes(h, today);
          const wk = weekMinutes(h, today);
          const goalLeft = h.timed && h.weeklyGoal ? Math.max(0, h.weeklyGoal - wk) : null;
          return (
            <ListItem
              key={h.id}
              itemKey={h.id}
              align="start"
              label={
                <HStack gap={1} vAlign="center" wrap="wrap">
                  <Text type="large" weight="semibold" color={done ? 'secondary' : 'primary'}>
                    {h.name}
                  </Text>
                  {goalLeft !== null ? <Badge variant={goalLeft ? 'neutral' : 'success'} label={goalLeft ? `목표까지 ${fmtMin(goalLeft)}` : '주간 목표 달성'} /> : null}
                </HStack>
              }
              description={
                <VStack gap={1}>
                  <HStack gap={1.5} vAlign="center" wrap="wrap">
                    <HStack gap={0.5} vAlign="center">
                      {week.map((k) => (
                        <StatusDot key={k} variant={h.log?.[k] ? 'accent' : 'neutral'} label={`${shortDate(k)} ${h.log?.[k] ? '완료' : '안 함'}`} />
                      ))}
                    </HStack>
                    {s >= 2 ? <Badge variant="orange" label={`${s}일 연속`} /> : null}
                    <Text type="supporting" size="xsm">
                      {s >= 2 ? '' : s ? '1일째' : '오늘 시작해 보세요'}
                      {mins ? ` · 오늘 ${fmtMin(mins)}` : ''}
                      {h.timed && !h.weeklyGoal ? ` · 7일 ${fmtMin(wk)}` : ''}
                    </Text>
                  </HStack>
                  {h.timed && h.weeklyGoal ? (
                    <ProgressBar label={`${h.name} 주간 목표`} isLabelHidden value={Math.min(wk, h.weeklyGoal)} max={h.weeklyGoal} variant={wk >= h.weeklyGoal ? 'success' : 'accent'} />
                  ) : null}
                </VStack>
              }
              endContent={
                <HStack gap={0.5} vAlign="center">
                  {done ? (
                    <Button label="완료" size="sm" variant="secondary" icon={<Icon icon={CheckIcon} />} tooltip="누르면 완료를 취소해요" onClick={() => undo(h)} />
                  ) : (
                    <Button label={h.timed ? '기록하기' : '완료하기'} size="sm" variant="primary" onClick={() => complete(h)} />
                  )}
                  {canDelete ? <IconButton label={`${h.name} 삭제`} icon={<Icon icon={XMarkIcon} />} variant="ghost" size="sm" onClick={() => remove(h)} /> : null}
                </HStack>
              }
            />
          );
        })}
      </List>
      {timing ? (
        <MinutesSheet
          key={timing.id}
          open
          setOpen={(o) => !o && setTiming(null)}
          habit={timing}
          onSave={(m) => {
            const before = setLog(timing.id, m);
            notify(`‘${timing.name}’ ${fmtMin(m)} 기록했어요`, () => d.saveHabits(before));
          }}
        />
      ) : null}
    </>
  );
}

const leftLabel = (left: number, total: number) => (left ? `${left}개 남았어요` : `${total}개 모두 끝냈어요`);

/** 할 일 tab: all routines grouped by time of day. */
export function RoutinesPanel({d, today}: {d: Dha; today: string}) {
  const [open, setOpen] = useState(false);
  const groups = SLOTS.map((s) => ({...s, items: d.habits.filter((h) => (h.slot || 'any') === s.k)})).filter((g) => g.items.length);
  return (
    <Panel title="루틴" end={<Button label="추가" size="sm" variant="secondary" icon={<Icon icon={PlusIcon} />} onClick={() => setOpen(true)} />}>
      <StoreGate d={d} ready={d.loaded.habits}>
        {groups.length ? (
          <VStack gap={5}>
            {groups.map((g) => {
              const left = g.items.filter((h) => !h.log?.[today]).length;
              return (
                <VStack key={g.k} gap={1}>
                  <HStack gap={1} vAlign="center">
                    <Icon icon={g.icon} size="sm" color="secondary" />
                    <Heading level={4}>{g.l}</Heading>
                    <Text type="supporting" size="sm">
                      · {leftLabel(left, g.items.length)}
                    </Text>
                  </HStack>
                  <HabitList d={d} today={today} habits={g.items} canDelete />
                </VStack>
              );
            })}
          </VStack>
        ) : (
          <Text type="supporting">아침·저녁에 할 일을 루틴으로 묶어 보세요. 할 일 옆 ↻ 버튼으로 기존 할 일을 옮길 수도 있어요.</Text>
        )}
      </StoreGate>
      <HabitSheet d={d} open={open} setOpen={setOpen} />
    </Panel>
  );
}

/** 홈: only the routine for the current time of day. */
export function NowRoutine({d, today}: {d: Dha; today: string}) {
  const slot = currentSlot(kstHour());
  const meta = SLOTS.find((s) => s.k === slot)!;
  const items = d.habits.filter((h) => (h.slot || 'any') === slot || (h.slot || 'any') === 'any');
  if (!d.loaded.habits || !items.length) return null;
  const left = items.filter((h) => !h.log?.[today]).length;
  return (
    <Panel title={`지금은 ${meta.l}`} end={<Text type="supporting" size="sm">{leftLabel(left, items.length)}</Text>}>
      <ProgressBar label={`${meta.l} 진행률`} isLabelHidden value={items.length - left} max={items.length} variant={left ? 'accent' : 'success'} />
      <HabitList d={d} today={today} habits={items} />
    </Panel>
  );
}
