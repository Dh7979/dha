import '@astryxdesign/core/reset.css';
import '@astryxdesign/core/astryx.css';
import {StrictMode, Suspense, lazy, useEffect, useState, type ReactNode} from 'react';
import {createRoot} from 'react-dom/client';
import {Theme} from '@astryxdesign/core/theme';
import {themes, defaultThemeSlug} from '../astryx-themes';
import TodayPage from './TodayPage';
import {readMode, MODE_EVENT, type Mode} from './lib/mode';

// Two targets from one codebase:
//  - default build: the claude.ai Artifact (runtime provided by claude.ai)
//  - `--mode web`: the installable app (runtime provided by Supabase, see src/standalone)
const STANDALONE = import.meta.env.MODE === 'web';
const Standalone = STANDALONE ? lazy(() => import('./standalone/boot').then((m) => ({default: m.Standalone}))) : null;

/** Light / dark / follow-the-phone, chosen in 홈 화면 설정 (light by default). */
function ThemeRoot({children}: {children: ReactNode}) {
  const [mode, setMode] = useState<Mode>(readMode);
  useEffect(() => {
    const on = () => setMode(readMode());
    window.addEventListener(MODE_EVENT, on);
    return () => window.removeEventListener(MODE_EVENT, on);
  }, []);
  // Status bar / browser chrome follows the chosen mode, not just the phone's setting.
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const dark = mode === 'dark' || (mode === 'system' && mq.matches);
      document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
      document.querySelectorAll('meta[name="theme-color"]').forEach((m) => {
        m.setAttribute('content', dark ? '#1C2530' : '#EEF2F5');
        m.removeAttribute('media');
      });
    };
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [mode]);
  return (
    <Theme theme={themes[defaultThemeSlug]} mode={mode}>
      {children}
    </Theme>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeRoot>
      {Standalone ? (
        <Suspense fallback={null}>
          <Standalone app={<TodayPage />} />
        </Suspense>
      ) : (
        <TodayPage />
      )}
    </ThemeRoot>
  </StrictMode>,
);
