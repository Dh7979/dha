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
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const send = async () => {
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setHint('이메일 주소를 정확히 적어 주세요.');
    setHint(null);
    setBusy(true);
    const {error} = await supabase.auth.signInWithOtp({email: email.trim(), options: {emailRedirectTo: location.origin}});
    setBusy(false);
    if (error) setHint('메일을 보내지 못했어요. 잠시 후 다시 시도해 주세요.');
    else setSent(true);
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
          {sent ? (
            <VStack gap={2}>
              <Heading level={3}>메일함을 확인해 주세요</Heading>
              <Text type="supporting">{email}로 보낸 로그인 링크를 이 기기에서 누르면 바로 시작돼요.</Text>
              <Button label="다른 이메일로 받기" variant="secondary" width="100%" onClick={() => setSent(false)} />
            </VStack>
          ) : (
            <VStack gap={3}>
              <TextInput label="이메일" placeholder="you@example.com" type="email" autoComplete="email" inputMode="email" size="lg" value={email} onChange={setEmail} onEnter={send} />
              {hint ? (
                <Text type="supporting" size="sm" color="primary">
                  {hint}
                </Text>
              ) : null}
              <Button label="로그인 링크 받기" variant="primary" size="lg" width="100%" isLoading={busy} onClick={send} />
              <Text type="supporting" size="sm" justify="center">
                비밀번호 없이, 메일로 받은 링크로 로그인해요. 내 데이터는 내 계정에만 저장돼요.
              </Text>
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
