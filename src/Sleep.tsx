// Sleep log: one entry per wake-up day (bedtime, wake time, how rested).
import {useEffect, useState} from 'react';
import {VStack} from '@astryxdesign/core/VStack';
import {HStack} from '@astryxdesign/core/HStack';
import {Text} from '@astryxdesign/core/Text';
import {Button} from '@astryxdesign/core/Button';
import {TimeInput} from '@astryxdesign/core/TimeInput';
import {SegmentedControl, SegmentedControlItem} from '@astryxdesign/core/SegmentedControl';
import {List, ListItem} from '@astryxdesign/core/List';
import {ProgressBar} from '@astryxdesign/core/ProgressBar';
import {addDays, shortDate, DOW, dow} from './lib/dates';
import {hm, sleepMinutes, type Sleep} from './lib/useDha';
import {FieldHint, Figure, Panel, StoreGate, useNotify, type Dha} from './ui';

export const SLEEP_Q = ['피곤', '부족', '보통', '좋음', '개운'];
const TARGET = 7 * 60;

function lastWeek(d: Dha, today: string) {
  return Array.from({length: 7}, (_, i) => addDays(today, -i))
    .map((k) => ({k, s: d.sleep[k]}))
    .filter((x) => x.s);
}
export function avgSleep(d: Dha, today: string) {
  const w = lastWeek(d, today);
  return w.length ? Math.round(w.reduce((a, x) => a + sleepMinutes(x.s as Sleep), 0) / w.length) : 0;
}

export function SleepCard({d, today}: {d: Dha; today: string}) {
  const notify = useNotify();
  const entry = d.sleep[today];
  // Smart default: the most recent earlier night, so a regular schedule is one tap.
  const lastKey = Object.keys(d.sleep).filter((k) => k < today).sort().pop();
  const last = lastKey ? d.sleep[lastKey] : null;
  const [bed, setBed] = useState<string | undefined>(entry?.bed ?? last?.bed ?? '23:30');
  const [wake, setWake] = useState<string | undefined>(entry?.wake ?? last?.wake ?? '07:00');
  const [q, setQ] = useState<number | null>(entry?.q ?? null);
  const [dirty, setDirty] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  useEffect(() => {
    if (dirty) return;
    const src = entry || last;
    if (src) {
      setBed(src.bed);
      setWake(src.wake);
    }
    if (entry) setQ(entry.q ?? null);
  }, [entry?.bed, entry?.wake, entry?.q, last?.bed, last?.wake, dirty]); // eslint-disable-line react-hooks/exhaustive-deps
  const mins = bed && wake ? sleepMinutes({bed, wake, q}) : 0;
  const save = () => {
    if (!bed) return setHint('잠든 시간을 골라 주세요.');
    if (!wake) return setHint('일어난 시간을 골라 주세요.');
    if (!d.writable) return setHint('저장소에 연결된 뒤에 기록할 수 있어요.');
    setHint(null);
    const prev = entry || null;
    d.saveSleep(today, {bed, wake, q})
      .then(() => {
        setDirty(false);
        notify(`${hm(sleepMinutes({bed, wake, q}))} 잤다고 기록했어요`, () => d.saveSleep(today, prev));
      })
      .catch(() => {});
  };
  const week = lastWeek(d, today);
  const avg = avgSleep(d, today);
  return (
    <Panel title="어젯밤 잠은 어땠나요?">
      <StoreGate d={d} ready={d.sleepLoaded}>
        <HStack gap={2}>
          <VStack width="50%">
            <TimeInput label="잠든 시간" value={bed as never} onChange={(v) => { setBed(v as string | undefined); setDirty(true); }} hourFormat="24h" increment={10} size="lg" />
          </VStack>
          <VStack width="50%">
            <TimeInput label="일어난 시간" value={wake as never} onChange={(v) => { setWake(v as string | undefined); setDirty(true); }} hourFormat="24h" increment={10} size="lg" />
          </VStack>
        </HStack>
        <VStack gap={2}>
          <Text type="label">얼마나 개운한가요?</Text>
          <SegmentedControl
            label="수면 만족도"
            layout="fill"
            value={q ? String(q) : ''}
            onChange={(v) => {
              setQ(Number(v));
              setDirty(true);
            }}
          >
            {SLEEP_Q.map((l, i) => (
              <SegmentedControlItem key={i} value={String(i + 1)} label={l} />
            ))}
          </SegmentedControl>
        </VStack>
        {!entry && last ? (
          <Text type="supporting" size="sm">
            지난번 기록({last.bed} → {last.wake})으로 채워 뒀어요. 다르면 바꿔 주세요.
          </Text>
        ) : null}
        {hint ? <FieldHint>{hint}</FieldHint> : null}
        <Button
          label={entry && !dirty ? `${hm(mins)} 잤어요 · 저장됨` : mins ? `${hm(mins)} 잤다고 기록하기` : '기록하기'}
          variant={entry && !dirty ? 'secondary' : 'primary'}
          size="lg"
          width="100%"
          onClick={save}
          isDisabled={!!entry && !dirty}
        />
        {week.length ? (
          <VStack gap={2}>
            <HStack gap={4}>
              <Figure label="최근 7일 평균" value={hm(avg)} tone={avg >= TARGET ? 'accent' : 'primary'} />
              <Figure label="기록한 날" value={`${week.length}일`} />
            </HStack>
            <List density="compact" hasDividers edge="flush">
              {week.map(({k, s}) => {
                const m = sleepMinutes(s as Sleep);
                return (
                  <ListItem
                    key={k}
                    label={`${hm(m)}${s?.q ? ` · ${SLEEP_Q[s.q - 1]}` : ''}`}
                    description={`${k === today ? '오늘' : shortDate(k)} · ${s?.bed} → ${s?.wake}`}
                    endContent={
                      <VStack width={72}>
                        <ProgressBar label={`${shortDate(k)} 수면`} isLabelHidden value={Math.min(m, 600)} max={600} variant={m >= TARGET ? 'accent' : 'warning'} />
                      </VStack>
                    }
                  />
                );
              })}
            </List>
          </VStack>
        ) : (
          <Text type="supporting" size="sm">
            아침에 한 번만 남기면 돼요. 일주일이 쌓이면 평균과 기분과의 관계를 주간 회고에서 알려드려요.
          </Text>
        )}
      </StoreGate>
    </Panel>
  );
}

/** For the weekly review prompt. */
export function weekSleepLines(d: Dha, today: string) {
  const lines = ['[수면 (일어난 날 기준)]'];
  let any = false;
  for (let i = 6; i >= 0; i--) {
    const k = addDays(today, -i);
    const s = d.sleep[k];
    if (!s) continue;
    any = true;
    lines.push(`${k} (${DOW[dow(k)]}): ${s.bed}→${s.wake}, ${hm(sleepMinutes(s))}${s.q ? `, 만족도 ${SLEEP_Q[s.q - 1]}(${s.q}/5)` : ''}`);
  }
  if (!any) lines.push('수면 기록 없음');
  return lines.join('\n');
}
