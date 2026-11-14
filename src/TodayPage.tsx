// DHA app shell: one scrolling tab at a time and a bottom tab bar.
// Scaffolded from the Astryx `blank` page template.
'use client';

import {useEffect, useRef, useState, type RefObject} from 'react';
import {Layout, LayoutContent, LayoutFooter} from '@astryxdesign/core/Layout';
import {VStack} from '@astryxdesign/core/VStack';
import {Icon} from '@astryxdesign/core/Icon';
import {Banner} from '@astryxdesign/core/Banner';
import {Tab, TabList} from '@astryxdesign/core/TabList';
import {HomeIcon, CheckCircleIcon, PencilSquareIcon, WalletIcon} from '@heroicons/react/24/outline';
import {
  HomeIcon as HomeSolid,
  CheckCircleIcon as CheckSolid,
  PencilSquareIcon as PencilSolid,
  WalletIcon as WalletSolid,
} from '@heroicons/react/24/solid';
import {Text} from '@astryxdesign/core/Text';
import {useDha, useToday} from './lib/useDha';
import {requestRefresh} from './lib/refresh';
import {haptic} from './ui';
import {HomeTab} from './HomeTab';
import {TodoTab} from './TodoTab';
import {RecordTab} from './RecordTab';
import {MoneyTab} from './Expenses';

const TABS = [
  {k: 'home', l: '홈', icon: HomeIcon, on: HomeSolid},
  {k: 'todo', l: '할 일', icon: CheckCircleIcon, on: CheckSolid},
  {k: 'record', l: '기록', icon: PencilSquareIcon, on: PencilSolid},
  {k: 'money', l: '지출', icon: WalletIcon, on: WalletSolid},
];

// Safe-area insets only in the installed app; the claude.ai Artifact frame already pads them.
const STANDALONE = import.meta.env.MODE === 'web';
// The page canvas paints the theme's body colour itself (the document behind it is unthemed).
const SAFE_TOP = {
  background: 'var(--color-background-body)',
  ...(STANDALONE ? {paddingTop: 'env(safe-area-inset-top, 0px)'} : {}),
};
const SAFE_BOTTOM = STANDALONE ? {paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 6px)'} : undefined;

const PULL_AT = 64;
/** Pull down at the top of the page to reload calendar and weather. */
function usePullToRefresh(anchor: RefObject<HTMLElement | null>) {
  const [pull, setPull] = useState(0);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let sc: HTMLElement | null = anchor.current?.parentElement || null;
    while (sc && !/(auto|scroll)/.test(getComputedStyle(sc).overflowY)) sc = sc.parentElement;
    const el = sc || (document.scrollingElement as HTMLElement);
    let startY: number | null = null;
    let dist = 0;
    const start = (e: TouchEvent) => {
      startY = el.scrollTop <= 0 ? e.touches[0].clientY : null;
      dist = 0;
    };
    const move = (e: TouchEvent) => {
      if (startY == null) return;
      dist = Math.max(0, (e.touches[0].clientY - startY) * 0.5);
      if (el.scrollTop > 0) {
        startY = null;
        dist = 0;
      }
      setPull(Math.min(dist, 88));
    };
    const end = () => {
      if (startY != null && dist >= PULL_AT) {
        haptic('tap');
        requestRefresh();
        setBusy(true);
        setTimeout(() => setBusy(false), 1200);
      }
      startY = null;
      dist = 0;
      setPull(0);
    };
    el.addEventListener('touchstart', start, {passive: true});
    el.addEventListener('touchmove', move, {passive: true});
    el.addEventListener('touchend', end);
    el.addEventListener('touchcancel', end);
    return () => {
      el.removeEventListener('touchstart', start);
      el.removeEventListener('touchmove', move);
      el.removeEventListener('touchend', end);
      el.removeEventListener('touchcancel', end);
    };
  }, [anchor]);
  return {pull, busy};
}

function readTab() {
  const h = location.hash.slice(1);
  if (TABS.some((t) => t.k === h)) return h;
  try {
    const s = localStorage.getItem('dha-tab');
    if (s && TABS.some((t) => t.k === s)) return s;
  } catch {
    /* ignore */
  }
  return 'home';
}

export default function Page() {
  const today = useToday();
  const d = useDha(today);
  const [tab, setTab] = useState(readTab);
  // A one-shot request for the target tab, e.g. 'add' opens its add sheet.
  const [intent, setIntent] = useState<string | null>(null);
  const top = useRef<HTMLElement | null>(null);

  const go = (k: string, wish?: string) => {
    setTab(k);
    setIntent(wish || null);
    try {
      localStorage.setItem('dha-tab', k);
    } catch {
      /* ignore */
    }
    if (location.hash.slice(1) !== k) history.replaceState(null, '', '#' + k);
  };
  useEffect(() => {
    const onHash = () => setTab(readTab());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  const firstTab = useRef(true);
  useEffect(() => {
    if (firstTab.current) {
      firstTab.current = false;
      return;
    }
    top.current?.scrollIntoView({block: 'start'});
  }, [tab]);
  const used = () => setIntent(null);
  const {pull, busy} = usePullToRefresh(top);

  return (
    // Installed app (viewport-fit=cover): keep content clear of the notch / status bar.
    <VStack height="100dvh" style={SAFE_TOP}>
      <Layout
        height="fill"
        contentWidth={600}
        content={
          <LayoutContent padding={4} label={TABS.find((t) => t.k === tab)?.l}>
            <VStack gap={3} ref={top}>
              {pull > 8 || busy ? (
                <VStack height={busy ? 32 : pull} hAlign="center" vAlign="center">
                  <Text type="supporting" size="sm">
                    {busy ? '새로 불러오는 중…' : pull >= PULL_AT ? '놓으면 새로고침' : '당겨서 새로고침'}
                  </Text>
                </VStack>
              ) : null}
              {d.error ? <Banner status="error" title={d.error} isDismissable onDismiss={d.clearError} collapsible={false} /> : null}
              {tab === 'home' ? <HomeTab d={d} today={today} go={go} /> : null}
              {tab === 'todo' ? <TodoTab d={d} today={today} intent={intent} onIntent={used} /> : null}
              {tab === 'record' ? <RecordTab d={d} today={today} /> : null}
              {tab === 'money' ? <MoneyTab d={d} today={today} intent={intent} onIntent={used} /> : null}
            </VStack>
          </LayoutContent>
        }
        footer={
          <LayoutFooter hasDivider padding={1} label="메뉴">
            {/* Lift the tab bar above the phone's home indicator / gesture bar. */}
            <VStack style={SAFE_BOTTOM}>
              <TabList value={tab} onChange={(k) => go(k)} layout="fill" size="lg">
                {TABS.map((t) => (
                  <Tab key={t.k} value={t.k} label={t.l} icon={<Icon icon={t.icon} />} selectedIcon={<Icon icon={t.on} />} />
                ))}
              </TabList>
            </VStack>
          </LayoutFooter>
        }
      />
    </VStack>
  );
}
