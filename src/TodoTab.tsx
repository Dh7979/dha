// 할 일: progress header, todo list, routines; adding happens in bottom sheets.
import {useEffect, useMemo, useState} from 'react';
import {VStack} from '@astryxdesign/core/VStack';
import {HStack} from '@astryxdesign/core/HStack';
import {Text} from '@astryxdesign/core/Text';
import {Button} from '@astryxdesign/core/Button';
import {IconButton} from '@astryxdesign/core/IconButton';
import {Icon} from '@astryxdesign/core/Icon';
import {Badge} from '@astryxdesign/core/Badge';
import {List, ListItem} from '@astryxdesign/core/List';
import {CheckboxInput} from '@astryxdesign/core/CheckboxInput';
import {TextInput} from '@astryxdesign/core/TextInput';
import {DateInput} from '@astryxdesign/core/DateInput';
import {SegmentedControl, SegmentedControlItem} from '@astryxdesign/core/SegmentedControl';
import {ProgressBar} from '@astryxdesign/core/ProgressBar';
import {ArrowPathIcon, ArrowPathRoundedSquareIcon, PlusIcon, XMarkIcon} from '@heroicons/react/24/outline';
import {diffDays, DOW, dow, shortDate, uid} from './lib/dates';
import {isDone, repeatDow, repeatsOn, type Todo} from './lib/useDha';
import {Cta, Figure, Panel, Sheet, StoreGate, TabTitle, useNotify, type Dha} from './ui';
import {HabitSheet, RoutinesPanel} from './Habits';

const repeatLabel = (t: Todo) => (t.repeat === 'daily' ? '매일' : t.repeat === 'weekdays' ? '평일' : '매주 ' + DOW[repeatDow(t)]);
function dueBadge(t: Todo, today: string) {
  if (!t.due || isDone(t, today)) return null;
  const n = diffDays(today, t.due);
  if (n < 0) return <Badge variant="error" label={`마감 ${-n}일 지남`} />;
  if (n === 0) return <Badge variant="warning" label="오늘 마감" />;
  if (n === 1) return <Badge variant="warning" label="내일 마감" />;
  return <Badge variant="neutral" label={`${shortDate(t.due)} 마감`} />;
}

function TodoSheet({d, today, open, setOpen}: {d: Dha; today: string; open: boolean; setOpen: (o: boolean) => void}) {
  const notify = useNotify();
  const [title, setTitle] = useState('');
  const [when, setWhen] = useState('none');
  const [due, setDue] = useState<string | undefined>();
  const add = () => {
    const v = title.trim();
    if (!v) return '무엇을 할지 적어 주세요.';
    if (when === 'due' && !due) return '마감일을 골라 주세요.';
    if (!d.writable) return '저장소에 연결된 뒤에 추가할 수 있어요.';
    const before = d.todos;
    const item: Todo = {id: uid(), title: v, done: false, created: today, doneDate: null};
    if (when === 'due' && due) item.due = due;
    if (['daily', 'weekdays', 'weekly'].includes(when)) {
      item.repeat = when as Todo['repeat'];
      item.lastDone = null;
      if (when === 'weekly') item.repeatDow = dow(today);
    }
    d.saveTodos([...before, item]);
    notify(`‘${v}’ 할 일을 추가했어요`, () => d.saveTodos(before));
    setTitle('');
    setWhen('none');
    setDue(undefined);
    setOpen(false);
  };
  return (
    <Sheet isOpen={open} onOpenChange={setOpen} title="할 일 추가" cta="추가하기" onSubmit={add}>
      <TextInput label="무엇을 할까요?" placeholder="예: 보고서 초안 쓰기" value={title} onChange={setTitle} size="lg" hasAutoFocus />
      <VStack gap={2}>
        <Text type="label">언제까지 / 얼마나 자주</Text>
        <SegmentedControl label="마감과 반복" layout="fill" value={when} onChange={setWhen}>
          <SegmentedControlItem value="none" label="없음" />
          <SegmentedControlItem value="due" label="마감일" />
          <SegmentedControlItem value="daily" label="매일" />
          <SegmentedControlItem value="weekdays" label="평일" />
          <SegmentedControlItem value="weekly" label={`매주 ${DOW[dow(today)]}`} />
        </SegmentedControl>
      </VStack>
      {when === 'due' ? (
        <DateInput label="마감일" value={due as never} onChange={(v) => setDue(v as string | undefined)} min={today as never} format="date_weekday" size="lg" />
      ) : null}
      {['daily', 'weekdays', 'weekly'].includes(when) ? (
        <Text type="supporting" size="sm">
          매일 하는 일이라면 ‘루틴’으로 등록하면 연속 기록과 시간 기록까지 볼 수 있어요.
        </Text>
      ) : null}
    </Sheet>
  );
}

export function TodoTab({d, today, intent, onIntent}: {d: Dha; today: string; intent?: string | null; onIntent?: () => void}) {
  const notify = useNotify();
  const [todoOpen, setTodoOpen] = useState(false);
  const [moving, setMoving] = useState<Todo | null>(null);
  useEffect(() => {
    if (intent === 'add') {
      setTodoOpen(true);
      onIntent?.();
    }
  }, [intent, onIntent]);
  const remove = (t: Todo) => {
    const before = d.todos;
    d.saveTodos(before.filter((x) => x.id !== t.id));
    notify(`‘${t.title}’ 할 일을 지웠어요`, () => d.saveTodos(before));
  };
  const list = useMemo(
    () =>
      d.todos
        .filter((t) => (t.repeat ? t.created <= today && repeatsOn(t, today) : !t.done || t.doneDate === today))
        .sort((a, b) => {
          const da = Number(isDone(a, today));
          const db = Number(isDone(b, today));
          if (da !== db) return da - db;
          const ua = a.due || '9999';
          const ub = b.due || '9999';
          if (ua !== ub) return ua < ub ? -1 : 1;
          return a.created < b.created ? -1 : 1;
        }),
    [d.todos, today],
  );
  const left = list.filter((t) => !isDone(t, today)).length;
  const habitDone = d.habits.filter((h) => h.log?.[today]).length;
  const toggle = (t: Todo) =>
    d.saveTodos(
      d.todos.map((x) =>
        x.id !== t.id ? x : x.repeat ? {...x, lastDone: x.lastDone === today ? null : today} : {...x, done: !x.done, doneDate: !x.done ? today : null},
      ),
    );

  return (
    <VStack gap={3}>
      <TabTitle title="할 일" sub={list.length ? (left ? `오늘 ${left}개 남았어요` : '오늘 할 일을 모두 끝냈어요') : '오늘 할 일을 적어 보세요'} />

      <Panel>
        <HStack gap={4}>
          <Figure label="오늘 할 일" value={`${list.length - left}/${list.length}`} tone={left ? 'primary' : 'accent'} />
          <Figure label="루틴" value={`${habitDone}/${d.habits.length}`} />
        </HStack>
        {list.length ? (
          <ProgressBar label="오늘 할 일 진행률" isLabelHidden value={list.length - left} max={list.length} variant={left ? 'accent' : 'success'} />
        ) : null}
      </Panel>

      <Panel title="오늘 할 일" end={<Button label="추가" size="sm" variant="secondary" icon={<Icon icon={PlusIcon} />} onClick={() => setTodoOpen(true)} />}>
        <StoreGate d={d} ready={d.loaded.todos}>
          {list.length ? (
            <List hasDividers edge="flush">
              {list.map((t) => {
                const done = isDone(t, today);
                const carried = !t.repeat && !t.done && t.created < today ? diffDays(t.created, today) : 0;
                return (
                  <ListItem
                    key={t.id}
                    itemKey={t.id}
                    startContent={<CheckboxInput label={done ? '완료 취소' : '완료로 표시'} isLabelHidden value={done} onChange={() => toggle(t)} />}
                    label={
                      <Text type="large" hasStrikethrough={done} color={done ? 'secondary' : 'primary'}>
                        {t.title}
                      </Text>
                    }
                    description={
                      t.repeat || carried || (t.due && !done) ? (
                        <HStack gap={1} wrap="wrap">
                          {t.repeat ? <Badge variant="blue" icon={<Icon icon={ArrowPathIcon} />} label={repeatLabel(t)} /> : null}
                          {carried ? <Badge variant="neutral" label={carried === 1 ? '어제부터' : `${carried}일째`} /> : null}
                          {dueBadge(t, today)}
                        </HStack>
                      ) : undefined
                    }
                    endContent={
                      <HStack gap={0}>
                        <IconButton label={`${t.title} 루틴으로 옮기기`} tooltip="루틴으로 옮기기" icon={<Icon icon={ArrowPathRoundedSquareIcon} />} variant="ghost" size="sm" onClick={() => setMoving(t)} />
                        <IconButton label={t.repeat ? '반복 할 일 삭제' : '삭제'} icon={<Icon icon={XMarkIcon} />} variant="ghost" size="sm" onClick={() => remove(t)} />
                      </HStack>
                    }
                  />
                );
              })}
            </List>
          ) : (
            <Text type="supporting">아직 할 일이 없어요. 못 끝낸 일은 다음 날로 넘어가요.</Text>
          )}
        </StoreGate>
      </Panel>

      <RoutinesPanel d={d} today={today} />

      <Cta label="할 일 추가하기" icon={<Icon icon={PlusIcon} />} onClick={() => setTodoOpen(true)} />
      <TodoSheet d={d} today={today} open={todoOpen} setOpen={setTodoOpen} />
      {moving ? (
        <HabitSheet
          key={moving.id}
          d={d}
          open
          setOpen={(o) => !o && setMoving(null)}
          initialName={moving.title}
          onCreated={() => d.saveTodos(d.todos.filter((x) => x.id !== moving.id))}
        />
      ) : null}
    </VStack>
  );
}
