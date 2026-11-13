// DHA app shell: one scrolling tab at a time and a bottom tab bar.
// Scaffolded from the Astryx `blank` page template.
'use client';

import {useEffect, useRef, useState} from 'react';
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
import {useDha, useToday} from './lib/useDha';
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

  return (
    <VStack height="100dvh">
      <Layout
        height="fill"
        contentWidth={600}
        content={
          <LayoutContent padding={4} label={TABS.find((t) => t.k === tab)?.l}>
            <VStack gap={3} ref={top}>
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
            <TabList value={tab} onChange={(k) => go(k)} layout="fill" size="lg">
              {TABS.map((t) => (
                <Tab key={t.k} value={t.k} label={t.l} icon={<Icon icon={t.icon} />} selectedIcon={<Icon icon={t.on} />} />
              ))}
            </TabList>
          </LayoutFooter>
        }
      />
    </VStack>
  );
}
