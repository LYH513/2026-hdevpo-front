# 기능별 코드 맵

## 전체 앱 진입점

- 앱 시작: `src/main.tsx`
- 전역 provider와 QueryClient: `src/App.tsx`
- 라우팅: `src/router.tsx`
- 경로 상수: `src/constants/routePath.ts`
- 공통 레이아웃: `src/components/Layout`, `src/components/Drawer`, `src/components/Header`, `src/components/Footer`
- 에러/로딩 처리: `src/components/Error`

## 인증과 사용자 상태

- 로그인 화면: `src/pages/auth/LoginPage`
- 로그인 API: `src/pages/auth/apis/auth.ts`
- 로그인 hook: `src/pages/auth/hooks`
- 인증 store: `src/stores/useAuthStore.ts`
- 인증 guard: `src/components/AuthGuard`
- 유지보수 gate: `src/components/MaintenanceGate`

주의할 점:

- 쿠키 인증을 사용하므로 Axios 인스턴스의 `withCredentials: true` 설정이 중요합니다.
- 401 응답은 `src/apis/axios.ts`에서 로그아웃 처리됩니다.
- 로그아웃 시 GitHub/포트폴리오 관련 localStorage도 함께 정리합니다.

## 대시보드

- 페이지 진입점: `src/pages/dashboard/DashboardPage`
- API: `src/pages/dashboard/apis/capability.ts`, `src/apis/faq.ts`
- hooks: `src/pages/dashboard/hooks`
- 주요 컴포넌트: `src/pages/dashboard/DashboardPage/components`
- 차트 공통 컴포넌트: `src/components/Chart`

주요 기능:

- 마일스톤 역량 차트
- 학기별 역량 조회
- 비교 그룹별 역량 비교
- 활동 추천
- 장학금 신청 기간 안내
- FAQ/contact 안내

## 마일리지

- 목록 페이지: `src/pages/mileage/MileageListPage`
- 추가 마일리지 등록 페이지: `src/pages/mileage/MileageAddPage` // 현재 사용되고 있지 않음
- 장학금 신청 페이지: `src/pages/mileage/ScholarshipApplyPage`
- 마일리지 API: `src/pages/mileage/apis/mileage.ts`
- 장학금 API: `src/pages/mileage/apis/scholarship.ts`
- 타입: `src/pages/mileage/types`
- hooks: `src/pages/mileage/hooks`
- 필터 상수: `src/pages/mileage/constants`

주요 기능:

- 마일리지 목록 검색, 학기 필터, 이수 여부 필터
- 기타 마일리지 등록, 수정, 삭제 // 현재 사용되고 있지 않음
- 첨부 파일 업로드와 다운로드
- 장학금 신청 기간 확인
- 개인정보 동의 후 장학금 신청

주의할 점:

- 추가 마일리지 등록/수정은 `multipart/form-data`로 전송합니다.
- 학기 필터에서 전체 학기는 API 요청 시 `all`로 변환됩니다.

## 수상 내역(현재 사용되고 있지 않은 코드)

- 페이지 진입점: `src/pages/award/AwardArchivePage`
- API: `src/pages/award/apis/award.ts`
- hooks: `src/pages/award/hooks`
- 타입: `src/pages/award/types/award.ts`
- 상수: `src/pages/award/constants`

주요 기능:

- 수상 내역 목록 조회
- 연도, 수상 유형, 키워드 필터
- 테이블/그리드 UI

## 포트폴리오

- 레이아웃: `src/pages/portfolio/PortfolioPage/PortfolioLayout.tsx`
- 편집 페이지: `src/pages/portfolio/PortfolioPage/PortfolioEditPage.tsx`
- context: `src/pages/portfolio/PortfolioPage/context/PortfolioContext.tsx`
- API: `src/pages/portfolio/apis`
- hooks: `src/pages/portfolio/hooks`
- markdown builder: `src/pages/portfolio/PortfolioPage/utils/buildPortfolioMarkdown.ts`
- 주요 컴포넌트: `src/pages/portfolio/PortfolioPage/components`

주요 기능:

- 사용자 프로필 정보 조회
- GitHub 저장소 선택
- 활동/마일리지/기술스택 기반 포트폴리오 구성
- 섹션별 prompt 품질 안내
- 포트폴리오 markdown 생성

주의할 점:

- `src/pages/portfolio/apis/portfolio.ts`는 하위 호환 re-export 파일입니다.
- 새 코드는 `userInfo.ts`, `repositories.ts`, `activities.ts`, `techStack.ts`, `mileage.ts` 등 도메인별 API 파일을 직접 import하는 흐름을 따릅니다.

## GitHub 연동과 마이페이지

- 마이페이지: `src/pages/profile/MyPage`
- GitHub API: `src/pages/profile/apis/github.ts`
- 공지 API: `src/pages/profile/apis/announcement.ts`
- hooks: `src/pages/profile/hooks`
- 타입: `src/pages/profile/types`

주요 기능:

- 사용자 정보 확인
- 중요 공지 조회
- GitHub 연결 상태 확인
- GitHub OAuth 연결/해제
- GitHub 조직 조회

주의할 점:

- GitHub 연결은 API 호출이 아니라 `window.location.href`로 OAuth URL에 직접 이동합니다.
- 연결 상태 일부는 `github-storage` localStorage에 동기화됩니다.

## CV 생성, 관리, 공유

- CV 라우트 레이아웃: `src/pages/cv/CVPage/CvRoutesLayout.tsx`
- CV 관리 페이지: `src/pages/cv/CVPage/CvManagePage.tsx`
- CV 생성 페이지: `src/pages/cv/CVPage/CvGeneratePage.tsx`
- CV 공개 공유 페이지: `src/pages/cv/CVPage/CvSharePage.tsx`
- CV API: `src/pages/cv/apis/cv.ts`
- hooks: `src/pages/cv/hooks`
- wizard store: `src/stores/useCvWizardStore.ts`
- HTML sanitize: `src/pages/cv/utils/sanitizeCvHtml.ts`
- 공개 token/URL 유틸: `src/pages/cv/utils/cvPublicToken.ts`, `src/constants/routePath.ts`
- 주요 미리보기 컴포넌트: `src/pages/cv/CVPage/components/CvPreviewContent.tsx`

주요 기능:

- CV 생성용 prompt 생성
- 디자인 선호도 기반 HTML 생성
- CV 목록 조회, 상세 조회, 수정, 삭제
- 즐겨찾기와 공개 여부 변경
- 공개 token 기반 HTML 공유 페이지
- CV 미리보기와 PDF/이미지 출력

주의할 점:

- 공개 공유 API는 인증 인터셉터 없는 별도 Axios client를 사용합니다.
- 공개 공유는 200, 204, 403, 404를 throw하지 않고 UI에서 분기합니다.
- `CvPreviewContent.tsx`는 길고 복잡하므로 수정 시 데스크톱/모바일, PDF 출력, HTML sanitize 동작을 함께 확인해야 합니다.

## 공통 UI와 스타일

- 공통 컴포넌트: `src/components`
- 전역 스타일: `src/styles/global.ts`, `src/styles/reset.ts`, `src/styles/toast.css`
- 테마: `src/styles/theme`
- 아이콘: `src/assets/icons`
- Storybook stories: `src/components/Button/Button.stories.tsx`, `src/components/Flex/Flex.stories.tsx`

주의할 점:

- Emotion과 MUI ThemeProvider를 함께 사용합니다.
- SVG는 `vite-plugin-svgr`로 React 컴포넌트 import가 가능합니다.

## Mock 데이터

- MSW handler: `src/mocks/handlers`
- MSW fixture: `src/mocks/fixtures`
- 브라우저 worker: `src/mocks/browser.ts`

화면을 백엔드 없이 확인하려면 `yarn dev:msw`를 사용하세요.
