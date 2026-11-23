# 눈꽃마을 안전 광장

특수교육대상학생이 겨울방학 안전 규칙(빙판길, 난방, 체온, 얼음)을 미니게임으로 익히는 블록풍 3D 웹 게임.
교실 태블릿(터치)용. 비스듬히 내려다보는 고정 쿼터뷰, 터치한 곳으로 걸어가는 조작.

- 광장 + 미니게임 4종 × 가·나·다 3수준: **펭귄걸음 오비**(빙판길) · **따끈따끈 우리집 타이쿤**(난방) · **체온 지킴이 눈밭 탐험** · **얼음 위는 안 돼! 순찰대**
- 게임오버·감점 없음, 실패하면 바로 앞에서 다시 + 이유 한 문장, 모든 문구는 음성과 짝
- 보상: 장비(아바타에 착용) · 눈사람 조각 · 4개 모두 깨면 마을 축제와 '겨울 안전 지킴이' 배지
- 교사 페이지(`#/teacher`): 학급·학생 등록, 학생별 수준, 클리어 현황

문서: [PRD](docs/PRD.md) · [개발 문서](docs/DEVELOPMENT.md) · [디자인](docs/DESIGN.md)

## 바로 해 보기

```bash
npm install
npm run dev
```

브라우저에서 열고 **바로 해 보기**(기록 안 남음)를 누르면 수준을 골라 4종을 모두 해 볼 수 있다.
같은 와이파이의 태블릿에서는 `http://컴퓨터주소:5173`.

서버(Supabase)를 연결하지 않으면 **체험 모드**로 돌아간다: 학급·학생·진행이 *이 태블릿의 브라우저 안에만* 저장된다.
교사 페이지(`http://…/#/teacher`)에서 학급을 만들고 학생을 등록하면 시작 화면에서 학급 코드 → 이름 → 그림 비밀번호로 들어갈 수 있다.

## 서버(Supabase) 연결 — 여러 태블릿에서 같은 기록을 쓰려면
1. Supabase 프로젝트를 만든다. Authentication → Providers에서 **Anonymous sign-ins**와 **Email**을 켠다.
2. SQL Editor에 `supabase/schema.sql` 전체를 붙여 넣고 실행한다. (테이블, RLS, 함수가 만들어진다.)
3. `.env.example`을 `.env.local`로 복사하고 Project URL과 **anon(publishable) 키**를 넣는다. *service role 키는 절대 넣지 않는다.*
4. 교사 페이지에서 이메일로 가입한다(확인 메일을 쓰는 설정이면 링크를 누른 뒤 로그인).

보안 규칙은 `scripts/test-sql.sh`로 로컬 Postgres에서 점검한다(다른 학생 기록 못 읽음, 학생은 직접 쓰기 불가, `pin_hash` 비공개, 5번 틀리면 잠금 등).

## 음성(TTS) mp3 만들기
문구는 `src/data/voice/*.ts` 한 곳에 있다. 지금은 mp3가 없어서 태블릿에 내장된 한국어 음성이 대신 읽는다.
교실에서 쓰기 전에 한 번 mp3를 만들어 커밋한다.

```bash
GOOGLE_TTS_API_KEY=발급받은키 npm run tts:generate
npm run voice:check
```

## 배포 (Vercel)
1. 이 저장소를 Vercel에 연결한다(Framework: Vite). 환경변수에 `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`를 넣는다.
2. 보안 헤더는 `vercel.json`에 들어 있다.
3. **공개 배포 전에 `edu-app-launch` 점검**(개인정보처리방침·이용약관, 링크 미리보기, 학생 정보 유출 점검)을 한 번 돌린다. 이 저장소에는 아직 개인정보처리방침 문서가 없다.

## 점검
```bash
npm test            # 게임 규칙·저장 기능
npm run build       # 타입 검사 + 배포 파일
scripts/test-sql.sh # DB 보안 규칙 (로컬 Postgres 필요)
```
브라우저에서 4종을 끝까지 해 보는 자동 점검은 `scripts/e2e-smoke.cjs`(Playwright 필요, `npm run build && npm run preview` 뒤에 실행).

## 알려진 한계
- 실시간 협동(7단계 2차 범위)의 서버 쪽 Realtime 연결은 아직 없다. 순찰대는 혼자 + NPC 동료로 동작한다. → [DEVELOPMENT.md](docs/DEVELOPMENT.md) 3장 7단계 참고.
- 캐릭터·건물은 코드로 만든 상자 모델이다. 직접 만든 에셋으로 바꾸는 시점은 PRD 열린 질문.
- 실제 교실 태블릿 기종에서의 성능 확인은 사람 손이 필요하다(그림자 끄기·픽셀비율 제한은 이미 적용).
