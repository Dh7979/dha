// 홈: one "do this now" card, summary rows with inline actions, routine, schedule, news, D-day.
// Card order and visibility are the viewer's own (홈 화면 설정).
import {useState, type ReactNode} from 'react';
import {VStack} from '@astryxdesign/core/VStack';
import {HStack} from '@astryxdesign/core/HStack';
import {Card} from '@astryxdesign/core/Card';
import {Heading} from '@astryxdesign/core/Heading';
import {Text} from '@astryxdesign/core/Text';
import {Button} from '@astryxdesign/core/Button';
import {IconButton} from '@astryxdesign/core/IconButton';
import {Icon} from '@astryxdesign/core/Icon';
import {Token} from '@astryxdesign/core/Token';
import {List, ListItem} from '@astryxdesign/core/List';
import {Tab, TabList} from '@astryxdesign/core/TabList';
import {TextInput} from '@astryxdesign/core/TextInput';
import {DateInput} from '@astryxdesign/core/DateInput';
import {EmptyState} from '@astryxdesign/core/EmptyState';
import {Switch} from '@astryxdesign/core/Switch';
import {BottomSheet} from '@astryxdesign/core/BottomSheet';
import {FileInput} from '@astryxdesign/core/FileInput';
import {
  ArrowDownIcon,
  ArrowUpIcon,
  CalendarDaysIcon,
  ClockIcon,
  Cog6ToothIcon,
  PlusIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import {clock, diffDays, kstHour, longDate, shortDate, uid} from './lib/dates';
import {currentSlot, hm, isDone, repeatsOn, sleepMinutes} from './lib/useDha';
import {avgSleep} from './Sleep';
import {NowRoutine} from './Habits';
import {Loading, Panel, Sheet, StoreGate, TabTitle, useNotify, type Dha} from './ui';
import {todaySpent, won} from './Expenses';

export type Go = (tab: string, intent?: string) => void;

const NEWS_CATS = [
  {k: 'economy', l: '경제'},
  {k: 'world', l: '세계'},
  {k: 'society', l: '사회'},
  {k: 'ai', l: 'AI'},
  {k: 'marketing', l: '마케팅'},
];
const safeUrl = (u?: string) => (typeof u === 'string' && /^https?:\/\//i.test(u) ? u : undefined);

// ---------- home layout preferences (per viewer, this browser) ----------
const CARDS = [
  {k: 'now', l: '지금 할 일'},
  {k: 'summary', l: '오늘 요약'},
  {k: 'routine', l: '지금 루틴'},
  {k: 'schedule', l: '오늘 일정'},
  {k: 'news', l: '오늘의 뉴스'},
  {k: 'dday', l: 'D-day'},
];
type Layout = {order: string[]; hidden: string[]};
function loadLayout(): Layout {
  try {
    const v = JSON.parse(localStorage.getItem('dha-home-layout') || 'null');
    if (v && Array.isArray(v.order)) {
      const order = [...v.order.filter((k: string) => CARDS.some((c) => c.k === k)), ...CARDS.map((c) => c.k).filter((k) => !v.order.includes(k))];
      return {order, hidden: Array.isArray(v.hidden) ? v.hidden : []};
    }
  } catch {
    /* fall back to defaults */
  }
  return {order: CARDS.map((c) => c.k), hidden: []};
}
function saveLayout(l: Layout) {
  try {
    localStorage.setItem('dha-home-layout', JSON.stringify(l));
  } catch {
    /* per-viewer convenience only */
  }
}

// ---------- 지금 할 일 ----------
type Nudge = {key: string; eyebrow: string; title: string; cta: string; tab: string; intent?: string};
function pickNudge(d: Dha, today: string): Nudge | null {
  const h = kstHour();
  const slot = currentSlot(h);
  const routine = d.habits.filter((x) => (x.slot || 'any') === slot || (x.slot || 'any') === 'any');
  const routineLeft = routine.filter((x) => !x.log?.[today]).length;
  const dueToday = d.todos.filter((t) => !t.repeat && !t.done && t.due && t.due <= today).length;
  const journal = d.journal.find((j) => j.date === today);
  const list: Nudge[] = [];
  if (d.sleepLoaded && h < 12 && !d.sleep[today])
    list.push({key: 'sleep', eyebrow: '아침 체크', title: '어젯밤 몇 시간 잤는지 남겨 보세요', cta: '수면 기록하기', tab: 'record'});
  if (d.loaded.todos && dueToday)
    list.push({key: 'due', eyebrow: '오늘 마감', title: `마감이 오늘까지인 할 일이 ${dueToday}개 있어요`, cta: '할 일 보기', tab: 'todo'});
  if (d.loaded.habits && routineLeft)
    list.push({
      key: 'routine-' + slot,
      eyebrow: slot === 'morning' ? '아침 루틴' : '저녁 루틴',
      title: `루틴 ${routineLeft}개만 더 하면 오늘 끝이에요`,
      cta: '루틴 하러 가기',
      tab: 'todo',
    });
  if (d.loaded.journal && h >= 19 && !journal?.mood)
    list.push({key: 'mood', eyebrow: '하루 마무리', title: '오늘 기분을 한 번만 눌러 남겨 보세요', cta: '기분 남기기', tab: 'record'});
  if (d.expLoaded && h >= 20 && !todaySpent(d, today))
    list.push({key: 'spend', eyebrow: '하루 마무리', title: '오늘 쓴 돈이 있다면 지금 남겨 두세요', cta: '지출 기록하기', tab: 'money', intent: 'add'});
  const dismissed = (k: string) => {
    try {
      return localStorage.getItem(`dha-nudge-${today}-${k}`) === '1';
    } catch {
      return false;
    }
  };
  return list.find((n) => !dismissed(n.key)) || null;
}
function NowCard({d, today, go}: {d: Dha; today: string; go: Go}) {
  const [, force] = useState(0);
  const n = pickNudge(d, today);
  if (!n) return null;
  const dismiss = () => {
    try {
      localStorage.setItem(`dha-nudge-${today}-${n.key}`, '1');
    } catch {
      /* ignore */
    }
    force((x) => x + 1);
  };
  return (
    <Card padding={5} variant="muted">
      <VStack gap={4}>
        <HStack gap={2} justify="between" vAlign="start">
          <VStack gap={1}>
            <Text type="supporting" weight="semibold" color="accent">
              {n.eyebrow}
            </Text>
            <Heading level={2} textWrap="pretty">
              {n.title}
            </Heading>
          </VStack>
          <IconButton label="오늘은 그만 보기" icon={<Icon icon={XMarkIcon} />} variant="ghost" size="sm" onClick={dismiss} />
        </HStack>
        <Button label={n.cta} variant="primary" size="lg" width="100%" onClick={() => go(n.tab, n.intent)} />
      </VStack>
    </Card>
  );
}

// ---------- 오늘 요약: number + one inline action per row ----------
function Row({label, description, value, action, onAction, tone = 'accent'}: {label: string; description: ReactNode; value: string; action: string; onAction: () => void; tone?: 'primary' | 'accent'}) {
  return (
    <ListItem
      label={label}
      description={description}
      endContent={
        <HStack gap={2} vAlign="center">
          <Text type="large" weight="bold" color={tone} hasTabularNumbers maxLines={1}>
            {value}
          </Text>
          <Button label={action} size="sm" variant="secondary" onClick={onAction} />
        </HStack>
      }
    />
  );
}
function Summary({d, today, go}: {d: Dha; today: string; go: Go}) {
  const visible = d.todos.filter((t) => (t.repeat ? t.created <= today && repeatsOn(t, today) : !t.done || t.doneDate === today));
  const left = visible.filter((t) => !isDone(t, today)).length;
  const habitDone = d.habits.filter((x) => x.log?.[today]).length;
  const journal = d.journal.find((j) => j.date === today);
  const sleep = d.sleep[today];
  const avg = avgSleep(d, today);
  return (
    <Panel title="오늘 요약">
      <List hasDividers edge="flush">
        <Row
          label="할 일"
          description={visible.length ? `${visible.length}개 중 ${visible.length - left}개 끝냈어요` : '오늘 할 일을 적어 보세요'}
          value={d.loaded.todos ? `${left}개 남음` : '–'}
          tone={left ? 'accent' : 'primary'}
          action={visible.length ? '보기' : '추가'}
          onAction={() => go('todo', visible.length ? undefined : 'add')}
        />
        <Row
          label="루틴"
          description={d.habits.length ? '오늘 체크한 루틴' : '아침·저녁 루틴을 만들어 보세요'}
          value={d.loaded.habits ? `${habitDone}/${d.habits.length}` : '–'}
          action="체크"
          onAction={() => go('todo')}
        />
        <Row
          label="지난밤 수면"
          description={sleep ? `${sleep.bed} → ${sleep.wake}${avg ? ` · 7일 평균 ${hm(avg)}` : ''}` : '잠든·일어난 시간을 남겨요'}
          value={sleep ? hm(sleepMinutes(sleep)) : '–'}
          action={sleep ? '보기' : '기록'}
          onAction={() => go('record')}
        />
        <Row
          label="오늘 지출"
          description={d.budget ? `이번 달 예산 ${won(d.budget)}` : '쓴 돈을 바로 남겨요'}
          value={d.expLoaded ? won(todaySpent(d, today)) : '–'}
          action="기록"
          onAction={() => go('money', 'add')}
        />
        <Row
          label="오늘의 기록"
          description={journal?.text || '기분과 한 줄을 남겨요'}
          value={journal?.mood ? ['😣', '😕', '😐', '🙂', '😄'][journal.mood - 1] : '–'}
          action={journal?.mood ? '보기' : '기록'}
          onAction={() => go('record')}
        />
      </List>
    </Panel>
  );
}

// ---------- 오늘 일정 ----------
const CAL_ERR: Record<string, {title: string; description: string; action?: boolean}> = {
  needs_reauth: {title: 'Google Calendar 연결이 만료됐어요', description: 'claude.ai 설정 → 커넥터에서 다시 연결해 주세요.'},
  server_not_connected: {title: 'Google Calendar가 연결되어 있지 않아요', description: 'claude.ai 설정 → 커넥터에서 추가해 주세요.'},
  approval_required: {title: '캘린더 읽기를 허용해 주세요', description: '이 페이지가 오늘 일정을 읽으려면 허용이 필요해요.', action: true},
  not_in_manifest: {title: '캘린더 읽기를 허용해 주세요', description: '이 페이지가 오늘 일정을 읽으려면 허용이 필요해요.', action: true},
  blocked_by_policy: {title: '일정을 읽을 수 없어요', description: '조직 정책으로 Google Calendar가 막혀 있어요.'},
  not_granted: {title: '이 화면에서는 일정을 불러올 수 없어요', description: 'claude.ai에서 열어 주세요.'},
};
function Schedule({d}: {d: Dha}) {
  const c = d.cal;
  let body: ReactNode;
  if (c.status === 'loading') body = <Loading />;
  else if (c.status === 'error') {
    const info = CAL_ERR[c.code] || {title: '일정을 불러오지 못했어요', description: '잠시 후 다시 시도해 주세요.', action: true};
    body = (
      <EmptyState
        isCompact
        title={info.title}
        description={info.description}
        actions={info.action ? <Button label="다시 불러오기" variant="secondary" clickAction={d.allowCalendar} /> : undefined}
      />
    );
  } else
    body = c.events.length ? (
      <List hasDividers edge="flush">
        {c.events.map((e, i) => (
          <ListItem
            key={i}
            startContent={
              <Text type="label" color="accent" weight="bold" hasTabularNumbers>
                {e.time}
              </Text>
            }
            label={e.title}
            description={[e.loc, e.cal].filter(Boolean).join(' · ') || undefined}
          />
        ))}
      </List>
    ) : (
      <Text type="supporting">오늘은 일정이 없어요.</Text>
    );
  const meta =
    c.status === 'ok'
      ? [c.note, c.stamp ? `${clock(c.stamp)} 기준` : '', c.calendars > 1 ? `캘린더 ${c.calendars}개` : ''].filter(Boolean).join(' · ')
      : '';
  return (
    <Panel
      title="오늘 일정"
      end={
        meta ? (
          <Text type="supporting" size="xsm">
            {meta}
          </Text>
        ) : (
          <Icon icon={CalendarDaysIcon} size="sm" color="tertiary" />
        )
      }
    >
      {body}
    </Panel>
  );
}

// ---------- 오늘의 뉴스: top 3, expand to 5 ----------
function News({d, today}: {d: Dha; today: string}) {
  const [tab, setTab] = useState(() => {
    try {
      return localStorage.getItem('dha-news-tab') || 'economy';
    } catch {
      return 'economy';
    }
  });
  const [all, setAll] = useState(false);
  const choose = (k: string) => {
    setTab(k);
    setAll(false);
    try {
      localStorage.setItem('dha-news-tab', k);
    } catch {
      /* per-viewer convenience only */
    }
  };
  const n = d.news;
  const stale = !!(n && n.date && n.date !== today);
  const items = n?.categories?.[tab] || [];
  const shown = items.slice(0, all ? 5 : 3);
  return (
    <Panel
      title="오늘의 뉴스"
      end={
        n?.generatedAt ? (
          <Text type="supporting" size="xsm">
            {stale ? `${shortDate(n.date)} ` : ''}
            {clock(n.generatedAt)} 기준
          </Text>
        ) : undefined
      }
    >
      <TabList value={tab} onChange={choose} overflow="scroll" role="tablist" hasDivider>
        {NEWS_CATS.map((c) => (
          <Tab key={c.k} value={c.k} label={c.l} />
        ))}
      </TabList>
      <StoreGate d={d} ready={n !== undefined}>
        {!n || !n.categories ? (
          <EmptyState isCompact icon={<Icon icon={ClockIcon} />} title="아직 오늘 뉴스가 없어요" description="매일 오전 8시에 채워져요. 이 PC의 Claude 앱이 켜져 있을 때 업데이트돼요." />
        ) : shown.length ? (
          <VStack gap={2}>
            <List listStyle="decimal" hasDividers edge="flush">
              {shown.map((it, i) => (
                <ListItem
                  key={i}
                  align="start"
                  label={
                    <Text weight="semibold" textWrap="pretty">
                      {it.title}
                    </Text>
                  }
                  description={[it.summary, it.source].filter(Boolean).join(' · ')}
                  href={safeUrl(it.url)}
                  target="_blank"
                />
              ))}
            </List>
            {items.length > 3 ? (
              <Button label={all ? '접기' : `${Math.min(items.length, 5) - 3}개 더 보기`} variant="ghost" width="100%" onClick={() => setAll(!all)} />
            ) : null}
          </VStack>
        ) : (
          <Text type="supporting">이 분야는 아직 정리된 뉴스가 없어요.</Text>
        )}
        {stale ? (
          <Text type="supporting" size="xsm">
            오늘 뉴스가 아직 업데이트되지 않아 이전 뉴스를 보여주고 있어요.
          </Text>
        ) : null}
      </StoreGate>
    </Panel>
  );
}

// ---------- D-day ----------
function Ddays({d, today}: {d: Dha; today: string}) {
  const notify = useNotify();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [date, setDate] = useState<string | undefined>();
  const list = d.ddays.filter((x) => x.date >= today).sort((a, b) => (a.date < b.date ? -1 : 1));
  const add = () => {
    if (!name.trim()) return '무엇의 D-day인지 이름을 적어 주세요.';
    if (!date) return '날짜를 골라 주세요.';
    if (date < today) return '오늘 이후 날짜를 골라 주세요.';
    if (!d.writable) return '저장소에 연결된 뒤에 등록할 수 있어요.';
    d.saveDdays([...d.ddays.filter((x) => x.date >= today), {id: uid(), name: name.trim(), date}]);
    notify(`‘${name.trim()}’ D-day를 등록했어요`);
    setName('');
    setDate(undefined);
    setOpen(false);
  };
  const remove = (id: string) => {
    const before = d.ddays;
    d.saveDdays(before.filter((y) => y.id !== id));
    notify('D-day를 지웠어요', () => d.saveDdays(before));
  };
  return (
    <Panel title="D-day" end={<Button label="추가" variant="ghost" icon={<Icon icon={PlusIcon} />} onClick={() => setOpen(true)} />}>
      <StoreGate d={d} ready={d.loaded.ddays}>
        {list.length ? (
          <HStack gap={1.5} wrap="wrap">
            {list.map((x) => {
              const n = diffDays(today, x.date);
              return <Token key={x.id} size="lg" color={n <= 3 ? 'orange' : 'default'} label={`${n === 0 ? 'D-Day' : 'D-' + n} ${x.name}`} onRemove={() => remove(x.id)} />;
            })}
          </HStack>
        ) : (
          <Text type="supporting">다가오는 D-day가 없어요.</Text>
        )}
      </StoreGate>
      <Sheet isOpen={open} onOpenChange={setOpen} title="D-day 추가" cta="등록하기" onSubmit={add}>
        <TextInput label="이름" placeholder="예: 시험, 여행" value={name} onChange={setName} size="lg" />
        <DateInput label="날짜" value={date as never} onChange={(v) => setDate(v as string | undefined)} min={today as never} format="date_weekday" size="lg" />
      </Sheet>
    </Panel>
  );
}

// ---------- 홈 화면 설정 ----------
function HomeSettings({open, setOpen, layout, setLayout}: {open: boolean; setOpen: (o: boolean) => void; layout: Layout; setLayout: (l: Layout) => void}) {
  const move = (k: string, dir: -1 | 1) => {
    const order = [...layout.order];
    const i = order.indexOf(k);
    const j = i + dir;
    if (j < 0 || j >= order.length) return;
    [order[i], order[j]] = [order[j], order[i]];
    setLayout({...layout, order});
  };
  const toggle = (k: string, on: boolean) => setLayout({...layout, hidden: on ? layout.hidden.filter((x) => x !== k) : [...layout.hidden, k]});
  return (
    <BottomSheet isOpen={open} onOpenChange={setOpen} label="홈 화면 설정" height="hug" padding={5}>
      <VStack gap={4}>
        <Heading level={2}>홈 화면 설정</Heading>
        <Text type="supporting">보고 싶은 카드만 켜고, 화살표로 순서를 바꿔요.</Text>
        <List hasDividers edge="flush">
          {layout.order.map((k, i) => {
            const c = CARDS.find((x) => x.k === k)!;
            const on = !layout.hidden.includes(k);
            return (
              <ListItem
                key={k}
                startContent={<Switch label={`${c.l} 보이기`} isLabelHidden value={on} onChange={(v) => toggle(k, v)} />}
                label={<Text color={on ? 'primary' : 'secondary'}>{c.l}</Text>}
                endContent={
                  <HStack gap={0}>
                    <IconButton label={`${c.l} 위로`} icon={<Icon icon={ArrowUpIcon} />} variant="ghost" size="sm" isDisabled={i === 0} onClick={() => move(k, -1)} />
                    <IconButton label={`${c.l} 아래로`} icon={<Icon icon={ArrowDownIcon} />} variant="ghost" size="sm" isDisabled={i === layout.order.length - 1} onClick={() => move(k, 1)} />
                  </HStack>
                }
              />
            );
          })}
        </List>
        <AccountSection />
        <Button label="완료" variant="primary" size="lg" width="100%" onClick={() => setOpen(false)} />
      </VStack>
    </BottomSheet>
  );
}

/** Installable-app only: import data exported from the claude.ai version, sign out. */
type Cal = {name: string; url: string};
type StandaloneApi = {
  importDocs: (d: Record<string, unknown>) => Promise<number>;
  getCalendars: () => Cal[];
  saveCalendars: (items: Cal[]) => Promise<void>;
  setPassword: (password: string) => Promise<void>;
  signOut: () => void;
  email?: string;
};
const ICAL_RE = /^https:\/\/calendar\.google\.com\/calendar\/ical\/.+\.ics$/;

function CalendarSettings({sa}: {sa: StandaloneApi}) {
  const notify = useNotify();
  const [cals, setCals] = useState<Cal[]>(() => sa.getCalendars());
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [hint, setHint] = useState<string | null>(null);
  const save = (next: Cal[], msg: string) => {
    setCals(next);
    sa.saveCalendars(next).then(() => notify(msg)).catch(() => notify('저장하지 못했어요. 다시 시도해 주세요.'));
  };
  const add = () => {
    if (!ICAL_RE.test(url.trim())) return setHint('Google Calendar 설정의 ‘iCal 형식의 비공개 주소’를 붙여넣어 주세요.');
    setHint(null);
    save([...cals, {name: name.trim() || `캘린더 ${cals.length + 1}`, url: url.trim()}], '캘린더를 연결했어요. 일정은 몇 분 안에 보여요.');
    setName('');
    setUrl('');
  };
  return (
    <VStack gap={2}>
      <Heading level={4}>캘린더 연결</Heading>
      <List hasDividers edge="flush">
        {cals.map((c, i) => (
          <ListItem
            key={i}
            label={c.name}
            description="iCal 주소로 연결됨"
            endContent={<IconButton label={`${c.name} 연결 끊기`} icon={<Icon icon={XMarkIcon} />} variant="ghost" size="sm" onClick={() => save(cals.filter((_, j) => j !== i), `${c.name} 연결을 끊었어요`)} />}
          />
        ))}
      </List>
      <TextInput label="이름" placeholder="예: 내 캘린더" value={name} onChange={setName} />
      <TextInput
        label="iCal 비공개 주소"
        description="Google Calendar(PC) → 설정 → 내 캘린더 → 캘린더 통합 → ‘iCal 형식의 비공개 주소’"
        placeholder="https://calendar.google.com/calendar/ical/.../basic.ics"
        value={url}
        onChange={setUrl}
      />
      {hint ? (
        <Text type="supporting" size="sm" color="primary">
          {hint}
        </Text>
      ) : null}
      <Button label="캘린더 연결하기" variant="secondary" width="100%" onClick={add} />
    </VStack>
  );
}

/** Set or change the sign-in password while signed in (no email needed). */
function PasswordSettings({sa}: {sa: StandaloneApi}) {
  const notify = useNotify();
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [hint, setHint] = useState<string | null>(null);
  const save = async () => {
    if (pw.length < 8) return setHint('비밀번호는 8자 이상이에요.');
    if (pw !== pw2) return setHint('비밀번호 확인이 달라요.');
    setHint(null);
    try {
      await sa.setPassword(pw);
      setPw('');
      setPw2('');
      notify('비밀번호를 저장했어요. 다른 기기에서는 이메일과 이 비밀번호로 로그인하세요.');
    } catch (e) {
      const code = (e as {code?: string})?.code;
      setHint(code === 'same_password' ? '지금 비밀번호와 같아요.' : code === 'weak_password' ? '비밀번호가 너무 쉬워요. 더 길게 만들어 주세요.' : '저장하지 못했어요. 다시 시도해 주세요.');
    }
  };
  return (
    <VStack gap={2}>
      <Heading level={4}>로그인 비밀번호</Heading>
      <Text type="supporting" size="sm">
        비밀번호를 정하거나 바꿔요. 설치한 앱이나 다른 기기에서는 이메일과 이 비밀번호로 로그인해요.
      </Text>
      <TextInput label="새 비밀번호" type="password" autoComplete="new-password" value={pw} onChange={setPw} />
      <TextInput label="새 비밀번호 확인" type="password" autoComplete="new-password" value={pw2} onChange={setPw2} onEnter={save} />
      {hint ? (
        <Text type="supporting" size="sm" color="primary">
          {hint}
        </Text>
      ) : null}
      <Button label="비밀번호 저장" variant="secondary" width="100%" onClick={save} />
    </VStack>
  );
}

function AccountSection() {
  const sa = (window as unknown as {__DHA_STANDALONE__?: StandaloneApi}).__DHA_STANDALONE__;
  const notify = useNotify();
  const [file, setFile] = useState<File | null>(null);
  if (!sa) return null;
  const run = async (f: File | File[] | null) => {
    const one = Array.isArray(f) ? f[0] : f;
    setFile(one || null);
    if (!one) return;
    try {
      const json = JSON.parse(await one.text());
      const docs = json && typeof json.docs === 'object' ? json.docs : json;
      const n = await sa.importDocs(docs);
      notify(`데이터 ${n}개를 가져왔어요`);
    } catch {
      notify('가져오지 못했어요. DHA에서 내보낸 JSON 파일인지 확인해 주세요.');
    }
  };
  return (
    <VStack gap={3}>
      <Heading level={3}>계정과 데이터</Heading>
      <PasswordSettings sa={sa} />
      <CalendarSettings sa={sa} />
      <FileInput label="데이터 가져오기" description="claude.ai 버전에서 내보낸 dha-export.json 파일을 고르세요." accept="application/json,.json" value={file} onChange={(f) => setFile(Array.isArray(f) ? f[0] || null : f)} changeAction={run} />
      <Button label={`로그아웃${sa.email ? ` (${sa.email})` : ''}`} variant="secondary" width="100%" onClick={sa.signOut} />
    </VStack>
  );
}

export function HomeTab({d, today, go}: {d: Dha; today: string; go: Go}) {
  const [layout, setLayoutState] = useState<Layout>(loadLayout);
  const [settings, setSettings] = useState(false);
  const setLayout = (l: Layout) => {
    setLayoutState(l);
    saveLayout(l);
  };
  const h = kstHour();
  const greeting = h < 11 ? '좋은 아침이에요' : h < 18 ? '오늘도 힘내요' : '오늘 하루 수고했어요';
  const render: Record<string, ReactNode> = {
    now: <NowCard key="now" d={d} today={today} go={go} />,
    summary: <Summary key="summary" d={d} today={today} go={go} />,
    routine: <NowRoutine key="routine" d={d} today={today} />,
    schedule: <Schedule key="schedule" d={d} />,
    news: <News key="news" d={d} today={today} />,
    dday: <Ddays key="dday" d={d} today={today} />,
  };
  return (
    <VStack gap={3}>
      <TabTitle eyebrow={longDate(today)} title={greeting} />
      {layout.order.filter((k) => !layout.hidden.includes(k)).map((k) => render[k])}
      <HStack justify="center">
        <Button label="홈 화면 설정" variant="ghost" icon={<Icon icon={Cog6ToothIcon} />} onClick={() => setSettings(true)} />
      </HStack>
      <HomeSettings open={settings} setOpen={setSettings} layout={layout} setLayout={setLayout} />
    </VStack>
  );
}
