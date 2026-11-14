// Standalone entry: Supabase session gate, then the same DHA app on the shimmed runtime.
import {useEffect, useState, type ReactNode} from 'react';
import {createClient, type Session} from '@supabase/supabase-js';
import {Layout, LayoutContent} from '@astryxdesign/core/Layout';
import {VStack} from '@astryxdesign/core/VStack';
import {Card} from '@astryxdesign/core/Card';
import {Heading} from '@astryxdesign/core/Heading';
import {Text} from '@astryxdesign/core/Text';
import {Button} from '@astryxdesign/core/Button';
import {TextInput} from '@astryxdesign/core/TextInput';
import {SegmentedControl, SegmentedControlItem} from '@astryxdesign/core/SegmentedControl';
import {Spinner} from '@astryxdesign/core/Spinner';
import {installShim} from './shim';

const url = import.meta.env.VITE_SUPABASE_URL as string;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
export const supabase = createClient(url, anon, {auth: {persistSession: true, detectSessionInUrl: true}});

function Center({children}: {children: ReactNode}) {
  return (
    <Layout
      height="auto"
      contentWidth={420}
      content={
        <LayoutContent padding={6} isScrollable={false}>
          {children}
        </LayoutContent>
      }
    />
  );
}

function Login() {
  // Email + password: signing in never sends an email or leaves the installed app.
  // Requires "Confirm email" to be off in Supabase so sign-up logs in right away.
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState<string | null>(null);

  const explain = (code?: string, msg?: string) => {
    switch (code) {
      case 'invalid_credentials':
        return '이메일 또는 비밀번호가 맞지 않아요. 처음이라면 ‘처음이에요’에서 가입해 주세요.';
      case 'user_already_exists':
      case 'email_exists':
        return '이미 가입된 이메일이에요. ‘로그인’에서 들어와 주세요.';
      case 'weak_password':
        return '비밀번호가 너무 쉬워요. 8자 이상으로 만들어 주세요.';
      case 'email_not_confirmed':
        return '이메일 확인이 켜져 있어 로그인할 수 없어요. Supabase에서 Confirm email을 꺼 주세요.';
      case 'over_request_rate_limit':
      case 'over_email_send_rate_limit':
        return '시도가 너무 많아요. 몇 분 뒤 다시 해 주세요.';
      case 'signup_disabled':
        return '새 계정 만들기가 꺼져 있어요. Supabase에서 가입 허용을 켜 주세요.';
      default:
        return `처리하지 못했어요. ${msg ? `(${msg})` : '네트워크를 확인해 주세요.'}`;
    }
  };

  const submit = async () => {
    const e = email.trim();
    if (!/^\S+@\S+\.\S+$/.test(e)) return setHint('이메일 주소를 정확히 적어 주세요.');
    if (password.length < 8) return setHint('비밀번호는 8자 이상이에요.');
    if (mode === 'signup' && password !== password2) return setHint('비밀번호 확인이 달라요. 같은 비밀번호를 두 번 입력해 주세요.');
    setHint(null);
    setBusy(true);
    const {data, error} =
      mode === 'login'
        ? await supabase.auth.signInWithPassword({email: e, password})
        : await supabase.auth.signUp({email: e, password});
    setBusy(false);
    if (error) return setHint(explain((error as {code?: string}).code, error.message));
    if (mode === 'signup' && !data.session)
      setHint('가입은 됐지만 Supabase의 이메일 확인이 켜져 있어 아직 로그인할 수 없어요. Confirm email을 끄고 ‘로그인’에서 들어와 주세요.');
    // On success onAuthStateChange swaps this screen for the app.
  };

  return (
    <Center>
      <VStack gap={6} minHeight="80dvh" vAlign="center">
        <VStack gap={2}>
          <Text type="label" color="accent" weight="bold">
            DHA
          </Text>
          <Heading level={1}>하루를 한 화면에</Heading>
          <Text type="supporting">일정, 할 일, 루틴, 기록, 지출을 한곳에서 관리해요.</Text>
        </VStack>
        <Card padding={5}>
          <VStack gap={3}>
            <SegmentedControl
              label="로그인 또는 가입"
              layout="fill"
              value={mode}
              onChange={(v) => {
                setMode(v as 'login' | 'signup');
                setHint(null);
              }}
            >
              <SegmentedControlItem value="login" label="로그인" />
              <SegmentedControlItem value="signup" label="처음이에요" />
            </SegmentedControl>
            <TextInput label="이메일" placeholder="you@example.com" type="email" autoComplete="email" inputMode="email" autoCapitalize="none" hasAutoCorrect={false} hasSpellCheck={false} size="lg" value={email} onChange={setEmail} />
            <TextInput
              label="비밀번호"
              description={mode === 'signup' ? '8자 이상으로 만들어 주세요.' : undefined}
              type="password"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              size="lg"
              value={password}
              onChange={setPassword}
              onEnter={mode === 'login' ? submit : undefined}
            />
            {mode === 'signup' ? (
              <TextInput label="비밀번호 확인" type="password" autoComplete="new-password" size="lg" value={password2} onChange={setPassword2} onEnter={submit} />
            ) : null}
            {hint ? (
              <Text type="supporting" size="sm" color="primary">
                {hint}
              </Text>
            ) : null}
            <Button label={mode === 'login' ? '로그인' : '가입하고 시작하기'} variant="primary" size="lg" width="100%" isLoading={busy} onClick={submit} />
            <Text type="supporting" size="sm" justify="center">
              메일 없이 앱 안에서 바로 로그인돼요. 한 번 로그인하면 이 기기에서 계속 유지돼요.
            </Text>
          </VStack>
        </Card>
      </VStack>
    </Center>
  );
}

export function Standalone({app}: {app: ReactNode}) {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [installed, setInstalled] = useState(false);
  useEffect(() => {
    supabase.auth.getSession().then(({data}) => setSession(data.session));
    const {data} = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);
  useEffect(() => {
    if (session && !installed) {
      installShim(supabase, session);
      setInstalled(true);
    }
  }, [session, installed]);
  if (session === undefined || (session && !installed))
    return (
      <Center>
        <VStack minHeight="80dvh" vAlign="center" hAlign="center">
          <Spinner size="lg" />
        </VStack>
      </Center>
    );
  if (!session) return <Login />;
  return <>{app}</>;
}
