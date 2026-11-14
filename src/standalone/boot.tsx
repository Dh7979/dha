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
  // Email one-time code: the code is typed inside the app, so nothing leaves the installed PWA
  // (a magic link would open Safari/Chrome instead of the installed app).
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  useEffect(() => {
    if (!cooldown) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const explain = (c?: string, msg?: string) => {
    switch (c) {
      case 'over_email_send_rate_limit':
        return '메일은 한 시간에 몇 통만 보낼 수 있어요. 이미 받은 메일이 있다면 가장 최근 메일의 코드를 입력하고, 없다면 잠시 뒤 다시 받아 주세요.';
      case 'over_request_rate_limit':
        return '시도가 너무 많아요. 몇 분 뒤 다시 해 주세요.';
      case 'otp_expired':
        return '코드가 만료됐거나 맞지 않아요. 가장 최근 메일의 코드를 입력하거나 새 코드를 받아 주세요.';
      case 'signup_disabled':
        return '새 계정 만들기가 꺼져 있어요. Supabase에서 가입 허용을 켜 주세요.';
      default:
        return `처리하지 못했어요. ${msg ? `(${msg})` : '네트워크를 확인해 주세요.'}`;
    }
  };

  const sendCode = async () => {
    const e = email.trim();
    if (!/^\S+@\S+\.\S+$/.test(e)) return setHint('이메일 주소를 정확히 적어 주세요.');
    setHint(null);
    setBusy(true);
    const {error} = await supabase.auth.signInWithOtp({email: e, options: {shouldCreateUser: true}});
    setBusy(false);
    if (error) {
      const c = (error as {code?: string}).code;
      setHint(explain(c, error.message));
      // A rate-limited send usually means an earlier code is already in the inbox: let them type it.
      if (c === 'over_email_send_rate_limit') setStep('code');
      return;
    }
    setStep('code');
    setCode('');
    setCooldown(60);
  };

  const verify = async () => {
    const token = code.replace(/\D/g, '');
    if (token.length < 6) return setHint('메일로 받은 숫자 코드를 모두 입력해 주세요.');
    setHint(null);
    setBusy(true);
    const {error} = await supabase.auth.verifyOtp({email: email.trim(), token, type: 'email'});
    setBusy(false);
    if (error) setHint(explain((error as {code?: string}).code, error.message));
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
          {step === 'email' ? (
            <VStack gap={3}>
              <TextInput label="이메일" placeholder="you@example.com" type="email" autoComplete="email" inputMode="email" size="lg" value={email} onChange={setEmail} onEnter={sendCode} />
              {hint ? (
                <Text type="supporting" size="sm" color="primary">
                  {hint}
                </Text>
              ) : null}
              <Button label="인증 코드 받기" variant="primary" size="lg" width="100%" isLoading={busy} onClick={sendCode} />
              <Text type="supporting" size="sm" justify="center">
                메일로 받은 숫자 코드를 앱에 입력하면 로그인돼요. 처음이면 자동으로 가입돼요.
              </Text>
            </VStack>
          ) : (
            <VStack gap={3}>
              <VStack gap={1}>
                <Heading level={3}>인증 코드를 입력해 주세요</Heading>
                <Text type="supporting" size="sm">
                  {email}로 보낸 메일의 숫자 코드를 입력해요. 메일이 안 보이면 스팸함도 확인해 주세요.
                </Text>
              </VStack>
              <TextInput
                label="인증 코드"
                placeholder="숫자 코드"
                inputMode="numeric"
                autoComplete="one-time-code"
                size="lg"
                value={code}
                onChange={(v) => setCode(v.replace(/\D/g, '').slice(0, 10))}
                onEnter={verify}
                hasAutoFocus
              />
              {hint ? (
                <Text type="supporting" size="sm" color="primary">
                  {hint}
                </Text>
              ) : null}
              <Button label="로그인" variant="primary" size="lg" width="100%" isLoading={busy} onClick={verify} />
              <Button
                label={cooldown ? `코드 다시 받기 (${cooldown}초)` : '코드 다시 받기'}
                variant="secondary"
                width="100%"
                isDisabled={cooldown > 0 || busy}
                onClick={sendCode}
              />
              <Button label="다른 이메일 쓰기" variant="ghost" width="100%" onClick={() => { setStep('email'); setHint(null); }} />
            </VStack>
          )}
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
