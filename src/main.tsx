import '@astryxdesign/core/reset.css';
import '@astryxdesign/core/astryx.css';
import {StrictMode, Suspense, lazy} from 'react';
import {createRoot} from 'react-dom/client';
import {Theme} from '@astryxdesign/core/theme';
import {themes, defaultThemeSlug} from '../astryx-themes';
import TodayPage from './TodayPage';

// Two targets from one codebase:
//  - default build: the claude.ai Artifact (runtime provided by claude.ai)
//  - `--mode web`: the installable app (runtime provided by Supabase + Google, see src/standalone)
const STANDALONE = import.meta.env.MODE === 'web';
const Standalone = STANDALONE ? lazy(() => import('./standalone/boot').then((m) => ({default: m.Standalone}))) : null;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Theme theme={themes[defaultThemeSlug]} mode="system">
      {Standalone ? (
        <Suspense fallback={null}>
          <Standalone app={<TodayPage />} />
        </Suspense>
      ) : (
        <TodayPage />
      )}
    </Theme>
  </StrictMode>,
);
