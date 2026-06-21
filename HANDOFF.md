# 인수인계 문서

## 프로젝트 개요

이 프로젝트는 한동대학교 전산전자공학부 마일리지 장학금 신청 서비스의 프론트엔드입니다. 학생은 마일리지 현황을 확인하고, 장학금 신청 기간에 장학금을 신청할 수 있습니다. 최근 기능 범위에는 포트폴리오 편집, GitHub 연동, CV 생성/관리/공유 기능도 포함되어 있습니다.

## 기술 스택

- React 18, TypeScript, Vite
- React Router, TanStack Query, Zustand
- Emotion, MUI, Nivo chart
- Axios, MSW
- Storybook, Chromatic
- Sentry, Amplitude
- DOMPurify, html2canvas, jsPDF

## 로컬 실행

패키지 스크립트는 `package.json`을 기준으로 확인합니다.

```bash
yarn install
yarn dev
```

백엔드 없이 Mock API로 확인할 때는 다음 명령을 사용합니다.

```bash
yarn dev:msw
```

빌드와 정적 확인은 다음 순서로 진행합니다.

```bash
yarn lint
yarn build
```

Storybook은 다음 명령으로 실행합니다.

```bash
yarn storybook
```

주의: 현재 저장소에는 `yarn.lock`과 `package-lock.json`이 함께 있습니다. CI 워크플로와 문서화된 스크립트는 `yarn` 기준이므로, 다음 담당자는 팀 기준 패키지 매니저를 먼저 확정하는 것이 좋습니다.

## 환경 변수

현재 `.env.example`은 없습니다. 실제 `.env` 값은 저장소 외부에서 안전하게 전달하고, 다음 변수의 목적만 문서화해서 공유하세요.

- `VITE_API_URL`: API 서버 base URL입니다. 없으면 `src/apis/config.ts`의 기본값 `http://localhost:8080/milestone25`를 사용합니다.
- `VITE_API_MODE`: `msw`로 설정하면 `src/main.tsx`에서 MSW worker를 실행합니다.
- `VITE_SENTRY_DSN_TOKEN`: Sentry 브라우저 SDK DSN입니다.
- `VITE_AMPLITUDE_API_KEY`: Amplitude 이벤트 수집 키입니다.

Sentry 빌드 플러그인용 값은 `.env.sentry-build-plugin` 또는 CI 시크릿으로 관리해야 합니다. 토큰은 문서나 커밋에 남기지 마세요.

## 운영 경로

앱은 `/milestone25/` 하위 경로에서 동작하도록 설정되어 있습니다.

- `vite.config.ts`: `base: '/milestone25/'`
- `src/router.tsx`: `basename: '/milestone25/'`
- `src/main.tsx`: MSW worker URL `/milestone25/mockServiceWorker.js`
- `src/constants/routePath.ts`: CV 공유 URL 생성 시 `import.meta.env.BASE_URL` 반영

배포 경로를 바꾸면 위 파일들을 함께 확인해야 합니다.

## 라우팅 구조

주요 라우트는 `src/router.tsx`와 `src/constants/routePath.ts`에서 관리합니다.

- `/`: 로그인
- `/dashboard`: 대시보드
- `/mileage`: 마일리지 목록
- `/mileage/add`: 추가 마일리지 등록 // 현재 서비스에서 사용되지 않는 기능
- `/scholarship/apply`: 장학금 신청
- `/portfolio`: 내 활동 관리
- `/cv`: CV 관리(포트폴리오 관리)
- `/cv/generate`: CV 생성 마법사(포트폴리오 생성)
- `/cv/share/:publicToken`: 로그인 없이 접근 가능한 CV 공개 공유 페이지
- `/my`: 마이페이지

대부분의 내부 화면은 `AuthGuard`와 `DrawerLayout` 아래에 있고, 로그인 페이지와 CV 공개 공유 페이지는 기본 `Layout` 아래에 있습니다. 전체 라우트는 `MaintenanceGate`를 통과하므로 유지보수 모드도 라우팅 진입 전에 확인됩니다.

## 상태 관리와 데이터 패칭

- 전역 인증 상태는 `src/stores/useAuthStore.ts`에 있습니다.
- 테마, Drawer, CV 생성 마법사 상태는 `src/stores` 하위 store에서 관리합니다.
- 서버 상태는 TanStack Query를 사용합니다.
- `src/App.tsx`의 QueryClient 기본값은 `staleTime: Infinity`, `refetchOnWindowFocus: false`입니다.
- mutation 에러는 `src/App.tsx`에서 toast로 공통 처리합니다.

## API 구조

- 공통 Axios 인스턴스: `src/apis/axios.ts`
- 공통 HTTP 래퍼: `src/apis/http.ts`
- endpoint 상수: `src/apis/endPoint.ts`
- 도메인 API: 각 `src/pages/**/apis` 하위 파일

Axios는 `withCredentials: true`로 쿠키 인증을 사용합니다. 응답이 401이면 toast를 띄우고 `useAuthStore.logout()`을 호출합니다. 500 에러는 Sentry에 capture합니다.

## Mock API

MSW 파일은 `src/mocks`에 있습니다.

- handler: `src/mocks/handlers`
- fixture: `src/mocks/fixtures`
- worker 진입점: `src/mocks/browser.ts`

Mock API로 화면을 볼 때는 `yarn dev:msw`를 사용합니다. 실제 백엔드와 다른 동작이 있을 수 있으므로, 기능 수정 후에는 실제 API 환경에서도 확인해야 합니다.

## 운영 도구

- Sentry 초기화: `src/service/sentry/sentry.ts`
- Sentry Vite plugin: `vite.config.ts`, org `hgu-mileage`, project `2025-mileage`
- Amplitude 초기화: `src/service/amplitude/amplitudeInitializer.tsx`
- Chromatic workflow: `.github/workflows/storybook_ci.yml`
- Chromatic secret: `CHROMATIC_PROJECT_TOKEN`

운영 계정, 프로젝트 권한, CI secret 접근 권한은 코드와 별도로 다음 담당자에게 넘겨야 합니다.

## 관련 문서

- 기능 맵: `docs/feature-map.md`
- 데모 시나리오: `docs/demo-scenario.md`
- API 맵: `docs/api-map.md`
- 알려진 이슈와 주의사항: `docs/known-issues.md`
