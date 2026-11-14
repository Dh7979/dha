// 기록: mood + one-line journal, last 7 days, Claude weekly review.
import {useEffect, useState} from 'react';
import {VStack} from '@astryxdesign/core/VStack';
import {Text} from '@astryxdesign/core/Text';
import {Button} from '@astryxdesign/core/Button';
import {Icon} from '@astryxdesign/core/Icon';
import {List, ListItem} from '@astryxdesign/core/List';
import {TextInput} from '@astryxdesign/core/TextInput';
import {SegmentedControl, SegmentedControlItem} from '@astryxdesign/core/SegmentedControl';
import {SparklesIcon} from '@heroicons/react/24/outline';
import {addDays, clock, DOW, dow, shortDate} from './lib/dates';
import {habitMinutes, streak} from './lib/useDha';
import {SleepCard, weekSleepLines} from './Sleep';
import {FieldHint, Panel, StoreGate, TabTitle, useNotify, type Dha} from './ui';
import {weekExpenseLines} from './Expenses';
import {StatsPanel} from './Stats';

export const MOODS = [
  {v: 1, e: '😣', l: '힘듦'},
  {v: 2, e: '😕', l: '별로'},
  {v: 3, e: '😐', l: '보통'},
  {v: 4, e: '🙂', l: '좋음'},
  {v: 5, e: '😄', l: '최고'},
];

function Today({d, today}: {d: Dha; today: string}) {
  const entry = d.journal.find((j) => j.date === today) || null;
  const [mood, setMood] = useState<number | null>(entry?.mood ?? null);
  const [text, setText] = useState(entry?.text ?? '');
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState('');
  useEffect(() => {
    if (!dirty) {
      setMood(entry?.mood ?? null);
      setText(entry?.text ?? '');
      setSaved(entry?.updatedAt ? '저장됨 · ' + clock(entry.updatedAt) : '');
    }
  }, [entry?.mood, entry?.text, entry?.updatedAt, dirty, today]);
  const notify = useNotify();
  const [hint, setHint] = useState<string | null>(null);
  const save = (m: number | null, t: string) => {
    if (!d.writable) return;
    setSaved('저장 중…');
    d.saveJournal(m, t)
      .then(() => {
        setDirty(false);
        setSaved('저장됨 · ' + clock(Date.now()));
      })
      .catch(() => setSaved('저장하지 못했어요'));
  };
  const moodItem = MOODS.find((m) => m.v === mood);
  return (
    <Panel title="오늘 기분은 어땠나요?">
      <SegmentedControl
        label="오늘 기분"
        layout="fill"
        size="lg"
        value={mood ? String(mood) : ''}
        onChange={(v) => {
          const m = Number(v);
          setMood(m);
          save(m, text);
        }}
      >
        {MOODS.map((m) => (
          <SegmentedControlItem key={m.v} value={String(m.v)} label={m.e} />
        ))}
      </SegmentedControl>
      <Text type="supporting" justify="center">
        {moodItem ? `오늘은 ‘${moodItem.l}’` : '이모지를 누르면 바로 저장돼요'}
      </Text>
      <TextInput autoComplete="off"
        label="한 줄 일기"
        placeholder="오늘을 한 줄로 남겨 보세요…"
        value={text}
        size="lg"
        onChange={(v) => {
          setText(v);
          setDirty(true);
        }}
        onEnter={() => save(mood, text)}
        enterKeyHint="done"
      />
      {hint ? <FieldHint>{hint}</FieldHint> : null}
      <Button
        label={dirty || !entry?.text ? '한 줄 저장하기' : '저장됨'}
        variant={dirty || !entry?.text ? 'primary' : 'secondary'}
        size="lg"
        width="100%"
        onClick={() => {
          if (!text.trim()) return setHint('오늘을 한 줄로 적어 주세요.');
          setHint(null);
          save(mood, text);
          notify('오늘의 한 줄을 남겼어요');
        }}
      />
      <Text type="supporting" size="xsm" justify="center">
        {d.store === 'unavailable' ? 'claude.ai에 로그인한 상태에서 열면 저장돼요.' : saved || ' '}
      </Text>
    </Panel>
  );
}

function weekData(d: Dha, today: string) {
  const from = addDays(today, -6);
  const by: Record<string, {mood: number | null; text: string}> = {};
  d.journal.forEach((j) => (by[j.date] = j));
  const lines = ['[기분과 한 줄 일기]'];
  for (let i = 6; i >= 0; i--) {
    const k = addDays(today, -i);
    const j = by[k];
    const m = j?.mood ? `${MOODS[j.mood - 1].l}(${j.mood}/5)` : '기분 기록 없음';
    lines.push(`${k} (${DOW[dow(k)]}): ${m} / ${j?.text || '일기 없음'}`);
  }
  const doneList = d.todos.filter((t) => !t.repeat && t.done && (t.doneDate || '') >= from).map((t) => t.title);
  const open = d.todos.filter((t) => !t.repeat && !t.done);
  const overdue = open.filter((t) => t.due && t.due < today).map((t) => t.title);
  lines.push('', '[이번 주 완료한 할 일] ' + (doneList.length ? doneList.join(', ') : '없음'));
  lines.push(`[아직 남은 할 일] ${open.length}개` + (overdue.length ? ', 마감 지난 일: ' + overdue.join(', ') : ''));
  lines.push('', '[습관 (최근 7일 중 체크한 날)]');
  if (!d.habits.length) lines.push('등록된 습관 없음');
  d.habits.forEach((h) => {
    let n = 0;
    let mins = 0;
    for (let i = 0; i < 7; i++) {
      const k = addDays(today, -i);
      if (h.log?.[k]) n++;
      mins += habitMinutes(h, k);
    }
    const slot = h.slot === 'morning' ? '아침 루틴' : h.slot === 'evening' ? '저녁 루틴' : '언제든';
    lines.push(
      `${h.name} (${slot}): ${n}/7일, 현재 ${streak(h, today)}일 연속` +
        (h.timed ? `, 최근 7일 ${mins}분${h.weeklyGoal ? ` (주간 목표 ${h.weeklyGoal}분)` : ''}` : ''),
    );
  });
  lines.push('', weekSleepLines(d, today));
  lines.push('', weekExpenseLines(d, today));
  return lines.join('\n');
}

function Review({d, today}: {d: Dha; today: string}) {
  const [live, setLive] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  if (!d.sampleFn) return null;
  const canSummarize = d.loaded.journal && d.loaded.todos && d.loaded.habits && d.expLoaded && d.sleepLoaded;
  const summarize = async () => {
    setErr(null);
    setLive('');
    const prompt =
      `너는 개인 하루 기록 앱 'DHA'의 주간 회고 도우미야. 아래는 사용자의 지난 7일(${addDays(today, -6)} ~ ${today}) 기록이야.\n\n` +
      weekData(d, today) +
      '\n\n이 기록만 근거로 한국어 존댓말로 4~6문장의 짧은 주간 회고를 써줘. 순서: 1) 이번 주 기분 흐름과 수면의 관계(수면 기록이 있을 때만, 날짜를 비교해 보이는 경향만), 2) 잘한 점(완료한 일, 루틴, 공부·운동 시간과 목표 달성), 3) 지출 흐름 한 문장(기록이 있을 때만), 4) 다음 주를 위한 작고 구체적인 제안 하나. 기록에 없는 내용은 지어내지 말고, 기록이 적으면 그 점을 담백하게 말해줘. 마크다운, 목록, 이모지 없이 문단 하나로만 써줘.';
    try {
      const r = await d.sampleFn(prompt, {cache: false, onText: (p: {text: string}) => setLive(p.text)});
      const t = (r?.text || '').trim();
      if (t) await d.saveSummary({text: t, createdAt: Date.now(), from: addDays(today, -6), to: today}).catch(() => {});
      else setErr('요약이 비어 있어요. 다시 시도해 주세요.');
    } catch (e: unknown) {
      const code = (e as {code?: string})?.code;
      setErr(
        code === 'rate_limited'
          ? '요청이 많아요. 잠시 후 다시 눌러 주세요.'
          : code === 'not_granted'
            ? 'Claude 사용이 허용되지 않아 요약을 만들 수 없어요.'
            : '요약을 만들지 못했어요. 다시 시도해 주세요.',
      );
    } finally {
      setLive(null);
    }
  };
  const shown = live !== null ? live : d.summary?.text || '';
  return (
    <Panel title="주간 회고" end={<Icon icon={SparklesIcon} size="sm" color="accent" />}>
      {shown ? (
        <Text as="p" type="large" textWrap="pretty">
          {shown}
        </Text>
      ) : (
        <Text type="supporting">최근 7일의 기분, 일기, 할 일, 습관, 지출을 Claude가 읽고 짧게 정리해 드려요.</Text>
      )}
      {err || live !== null || d.summary?.createdAt ? (
        <Text type="supporting" size="xsm">
          {err ||
            (live !== null
              ? 'Claude가 정리하는 중…'
              : `작성 ${shortDate(new Date(d.summary!.createdAt).toISOString().slice(0, 10))} ${clock(d.summary!.createdAt)}`)}
        </Text>
      ) : null}
      <Button
        label={d.summary ? '이번 주 다시 돌아보기' : '이번 주 돌아보기'}
        icon={<Icon icon={SparklesIcon} />}
        variant="secondary"
        size="lg"
        width="100%"
        clickAction={summarize}
        isDisabled={!canSummarize}
      />
    </Panel>
  );
}

function History({d, today}: {d: Dha; today: string}) {
  const by: Record<string, {mood: number | null; text: string}> = {};
  d.journal.forEach((j) => (by[j.date] = j));
  const days = Array.from({length: 7}, (_, i) => addDays(today, -i));
  return (
    <Panel title="최근 7일">
      <StoreGate d={d} ready={d.loaded.journal}>
        <List hasDividers edge="flush">
          {days.map((k, i) => {
            const j = by[k];
            const m = j?.mood ? MOODS[j.mood - 1] : null;
            return (
              <ListItem
                key={k}
                startContent={<Text type="large">{m ? m.e : '·'}</Text>}
                label={<Text color={j?.text ? 'primary' : 'secondary'}>{j?.text || '기록 없음'}</Text>}
                description={i === 0 ? '오늘' : shortDate(k)}
              />
            );
          })}
        </List>
      </StoreGate>
    </Panel>
  );
}

export function RecordTab({d, today}: {d: Dha; today: string}) {
  const streakDays = (() => {
    let n = 0;
    let k = today;
    const has = (x: string) => d.journal.some((j) => j.date === x && (j.text || j.mood));
    if (!has(k)) k = addDays(k, -1);
    while (has(k)) {
      n++;
      k = addDays(k, -1);
    }
    return n;
  })();
  return (
    <VStack gap={3}>
      <TabTitle title="기록" sub={streakDays ? `${streakDays}일째 기록하고 있어요` : '오늘의 기분부터 남겨 보세요'} />
      <SleepCard d={d} today={today} />
      <Today d={d} today={today} />
      <StatsPanel d={d} today={today} />
      <Review d={d} today={today} />
      <History d={d} today={today} />
    </VStack>
  );
}
