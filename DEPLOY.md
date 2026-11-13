# DHA 배포 가이드 (설치형 앱 / PWA)

코드는 준비돼 있어요. 아래는 **계정을 만들고 연결하는 단계**예요. 비밀번호·결제·API 키 입력은 직접 해 주세요.
📋 표시 값은 Claude에게 알려 주면 나머지 연결을 대신해요. **Anthropic API 키와 Supabase service_role 키, 캘린더 iCal 비공개 주소는 채팅에 붙여넣지 마세요.**

로그인은 **이메일 로그인 링크**(비밀번호 없음), 캘린더는 **iCal 비공개 주소**로 연결해요. Google Cloud 설정은 필요 없어요.

---

## 1. Supabase (데이터·로그인·서버 함수)
1. https://supabase.com 가입 → **New project**
   - Region: **Northeast Asia (Seoul)**
   - Database password: 강한 비밀번호 (따로 보관)
2. 왼쪽 **SQL Editor** → `supabase/schema.sql` 내용을 붙여넣고 **Run**
3. **Authentication → Sign In / Providers → Email**이 켜져 있는지 확인 (기본값으로 켜져 있어요)
4. **Project Settings → API** 에서 📋 두 값 복사
   - `Project URL`
   - `anon public` 키 (공개돼도 되는 키예요)

## 2. 서버 함수 2개 배포 (Supabase 화면에서)
**Edge Functions → Deploy a new function → Via editor**로 두 번 만들어요.

| 이름 | 붙여넣을 파일 |
|---|---|
| `calendar` | `supabase/functions/calendar/index.ts` 와 같은 폴더의 `ics.ts` (편집기에서 파일 추가) |
| `weekly-review` | `supabase/functions/weekly-review/index.ts` |

## 3. Anthropic (주간 회고용 Claude API)
1. https://console.anthropic.com → **API Keys → Create key** (사용량만큼 과금, 주 1~2회면 월 수백 원 수준)
2. Supabase → **Edge Functions → Secrets** → 이름 `ANTHROPIC_API_KEY`로 저장

## 4. GitHub + Vercel (앱 주소)
1. GitHub에서 **private** 저장소 `dha` 만들기 (README 없이) → 📋 저장소 주소를 Claude에게 알려 주기
2. Claude가 코드를 올리면, https://vercel.com → GitHub로 가입 → **Add New → Project** → `dha` Import
   - Build Command: `npm run build:web`
   - Output Directory: `dist-web`
   - Environment Variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
3. 배포 주소(예: `https://dha-xxx.vercel.app`)를 Supabase **Authentication → URL Configuration**의
   **Site URL**과 **Redirect URLs**에 넣기 (로그인 링크가 이 주소로 돌아와요)

## 5. 휴대폰에 설치 + 데이터·캘린더 연결
1. 휴대폰 브라우저로 Vercel 주소 열기 → 이메일 입력 → **메일의 로그인 링크를 같은 휴대폰에서** 누르기
2. 홈 맨 아래 **홈 화면 설정 → 계정과 데이터**
   - **캘린더 연결**: PC에서 Google Calendar → 설정 → 내 캘린더(이름) → **캘린더 통합** →
     **iCal 형식의 비공개 주소** 복사 → 붙여넣기 (대한민국 휴일은 기본으로 들어 있어요)
   - **데이터 가져오기**: `dha-export.json` 선택 (한 기기에서 한 번만 하면 모든 기기에 반영)
3. 설치
   - iPhone(Safari): 공유 → **홈 화면에 추가**
   - Android(Chrome): ⋮ → **앱 설치**

> iCal 비공개 주소는 "아는 사람은 일정을 볼 수 있는 열쇠"예요. 앱은 내 계정 전용 저장소에만 보관해요.
> 유출이 의심되면 Google Calendar 설정에서 **재설정**하고 새 주소로 다시 연결하면 돼요.

## 로컬에서 확인
```bash
npm run build:web
npm run dev:web
```
`.env.example`을 `.env.web.local`로 복사해 값을 넣으면 됩니다.
