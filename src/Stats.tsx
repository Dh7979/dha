// 흐름: last 7 / 30 days of sleep, mood, spending and routines, with one plain-language insight.
import {useMemo, useState, type ReactNode} from 'react';
import {VStack} from '@astryxdesign/core/VStack';
import {HStack} from '@astryxdesign/core/HStack';
import {Text} from '@astryxdesign/core/Text';
import {ProgressBar} from '@astryxdesign/core/ProgressBar';
import {SegmentedControl, SegmentedControlItem} from '@astryxdesign/core/SegmentedControl';
import {shortDate} from './lib/dates';
import {hm} from './lib/useDha';
import {computeStats} from './lib/stats';
import {won} from './Expenses';
import {Panel, StoreGate, type Dha} from './ui';

const MOOD_FACE = ['😣', '😕', '😐', '🙂', '😄'];

/** Small bar chart; empty days show as a short track-coloured stub. The last bar is today. */
function Bars({values, max, label}: {values: Array<number | null>; max: number; label: string}) {
  const n = values.length;
  const gap = n > 10 ? 1 : 2.5;
  return (
    <svg viewBox={`0 0 ${n * 10} 44`} width="100%" height="44" preserveAspectRatio="none" role="img" aria-label={label}>
      {values.map((v, i) => {
        const h = v ? Math.max(3, (Math.min(v, max) / max) * 44) : 3;
        return (
          <rect
            key={i}
            x={i * 10 + gap / 2}
            y={44 - h}
            width={10 - gap}
            height={h}
            rx={n > 10 ? 1 : 2}
            fill={v ? 'var(--color-accent)' : 'var(--color-track)'}
            fillOpacity={v && i < n - 1 ? 0.6 : 1}
          />
        );
      })}
    </svg>
  );
}

function Block({title, value, children}: {title: string; value: string; children?: ReactNode}) {
  return (
    <VStack gap={1.5}>
      <HStack gap={2} justify="between" vAlign="end">
        <Text type="supporting">{title}</Text>
        <Text type="large" color="accent" hasTabularNumbers>
          {value}
        </Text>
      </HStack>
      {children}
    </VStack>
  );
}

export function StatsPanel({d, today}: {d: Dha; today: string}) {
  const [days, setDays] = useState(7);
  const s = useMemo(
    () =>
      computeStats({
        today,
        days,
        sleep: d.sleep,
        journal: d.journal,
        habits: d.habits,
        expenses: Object.values(d.expenses).flat(),
      }),
    [today, days, d.sleep, d.journal, d.habits, d.expenses],
  );
  const axis = (
    <HStack justify="between">
      <Text type="supporting" size="2xs">
        {shortDate(s.dates[0])}
      </Text>
      <Text type="supporting" size="2xs">
        오늘
      </Text>
    </HStack>
  );
  const insight = s.sleepMood
    ? s.sleepMood.rested - s.sleepMood.short >= 0.3
      ? `7시간 넘게 잔 날은 기분이 평균 ${(s.sleepMood.rested - s.sleepMood.short).toFixed(1)}점 더 좋았어요.`
      : s.sleepMood.short - s.sleepMood.rested >= 0.3
        ? '이 기간에는 잠을 적게 잔 날의 기분이 오히려 더 좋았어요.'
        : '이 기간에는 잠과 기분 사이에 뚜렷한 차이가 없었어요.'
    : null;
  return (
    <Panel
      title="흐름"
      end={
        <SegmentedControl label="기간" value={String(days)} onChange={(v) => setDays(Number(v))} size="sm">
          <SegmentedControlItem value="7" label="7일" />
          <SegmentedControlItem value="30" label="30일" />
        </SegmentedControl>
      }
    >
      <StoreGate d={d} ready={d.loaded.journal && d.loaded.habits && d.sleepLoaded && d.expLoaded}>
        <VStack gap={5}>
          <Block title="수면" value={s.avgSleep ? `평균 ${hm(s.avgSleep)}` : '기록 없음'}>
            <Bars values={s.sleep} max={600} label={`최근 ${days}일 수면 시간`} />
            {axis}
          </Block>
          <Block title="기분" value={s.avgMood ? `${MOOD_FACE[Math.round(s.avgMood) - 1]} 평균 ${s.avgMood.toFixed(1)}점` : '기록 없음'}>
            <Bars values={s.mood} max={5} label={`최근 ${days}일 기분`} />
            {axis}
          </Block>
          <Block title="지출" value={won(s.totalSpend)}>
            <Bars values={s.spend.map((x) => x || null)} max={Math.max(...s.spend, 1)} label={`최근 ${days}일 지출`} />
            {axis}
          </Block>
          {s.routineRate != null ? (
            <Block title="루틴 달성률" value={`${s.routineRate}%`}>
              <ProgressBar label="루틴 달성률" isLabelHidden value={s.routineRate} max={100} variant={s.routineRate >= 80 ? 'success' : 'accent'} />
            </Block>
          ) : null}
          {insight ? (
            <Text color="accent" weight="medium" textWrap="pretty">
              {insight}
            </Text>
          ) : (
            <Text type="supporting" size="sm" textWrap="pretty">
              수면과 기분을 며칠 더 남기면, 잠이 기분에 어떤 영향을 주는지 알려드려요.
            </Text>
          )}
        </VStack>
      </StoreGate>
    </Panel>
  );
}
