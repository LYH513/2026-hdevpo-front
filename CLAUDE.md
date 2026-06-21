# CLAUDE.md

## 기본 작업 원칙

- 모든 요구사항에서 먼저 프로젝트의 폴더 구조, 파일 구조, 코드 구조, 이름 형식을 확인하고 기존 패턴에 맞춰 코드를 추가하거나 변경한다.
- 기능 코드는 현재 도메인 구조를 우선 따른다. 예: `src/pages/mileage`, `src/pages/portfolio`, `src/pages/cv`, `src/pages/dashboard`, `src/pages/award`, `src/pages/auth`, `src/pages/profile`.
- import는 기존처럼 `@/` alias를 우선 사용하고, 공통 컴포넌트는 `src/components/index.ts`의 export 흐름을 존중한다.
- 불필요한 새 추상화, 새 의존성, 전역 스타일 변경, 폴더 구조 변경은 피한다.

## API 작업 규칙

- API 호출은 기존 구조를 따른다.
  - endpoint 상수: `src/apis/endPoint.ts`
  - Axios 인스턴스: `src/apis/axios.ts`
  - 공통 HTTP 래퍼: `src/apis/http.ts`
  - 도메인 API 함수: `src/pages/**/apis`
- request/response 타입은 기존 도메인 API 파일 또는 `types` 폴더의 패턴에 맞춰 둔다.
- 함수와 hook 이름은 기존 스타일을 따른다. 예: `getX`, `postX`, `patchX`, `deleteX`, `useGetXQuery`, `usePostXMutation`.
- 인증 구조를 임의로 바꾸지 않는다. 현재는 쿠키 인증, `withCredentials: true`, 401 전역 로그아웃, 500 Sentry capture 흐름을 사용한다.
- API 변경이 있으면 `src/mocks/handlers`와 `src/mocks/fixtures`도 함께 갱신한다. Mock 코드는 기존처럼 `BASE_URL + ENDPOINT.*`, `http.*`, `HttpResponse` 스타일을 따른다.

## UI와 스타일 규칙

- UI는 `src/components`의 공통 컴포넌트를 먼저 사용한다. 특히 `Button`, `Flex`, `Input`, `Dropdown`, `Modal`, `Table`, `Tabs`, `Text`, `Title`, `Heading`, skeleton, error 컴포넌트를 우선 검토한다.
- 스타일 값은 `@/styles`를 먼저 재사용한다.
  - 색상: `src/styles/palette.ts`
  - 테마: `src/styles/theme.ts`
  - 타이포그래피: `src/styles/typography.ts`
  - 공통 스타일: `src/styles/common.ts`
  - 전역/리셋 스타일: `src/styles/global.ts`, `src/styles/reset.ts`
- `@/styles`에 없는 경우에만 새 스타일 값을 추가한다.
- 레이아웃은 `display: flex`를 최대한 사용한다. `position: absolute` 또는 `position: relative`는 오버레이, 고정 앵커, 브라우저 제약 등 꼭 필요한 상황이 아니면 사용하지 않는다.
- UI를 추가하거나 바꿀 때는 모바일 반응형을 반드시 고려한다. 기존 코드의 반응형 처리 방식을 먼저 확인하고, 주로 `MAX_RESPONSIVE_WIDTH` from `src/constants/system.ts`와 주변 컴포넌트의 media query 패턴을 따른다.

## React 상태와 데이터 규칙

- React 함수형 컴포넌트와 hooks를 사용한다.
- 서버 상태는 TanStack Query 패턴을 따른다.
- 전역 클라이언트 상태는 이미 존재하는 Zustand store 구조를 우선 활용한다.
- 재사용 가능한 로직은 해당 도메인의 `hooks` 폴더 또는 `src/shared/hooks`에 둔다.

## 변경 후 확인

- 코드 변경 후에는 수정한 파일의 lint 진단을 확인한다.
- API나 UI 변경이 있으면 가능한 범위에서 `yarn dev:msw`로 Mock smoke test를 고려한다.
- 넓은 변경이나 배포 영향이 있는 변경은 `yarn lint`와 `yarn build` 확인을 우선한다.
