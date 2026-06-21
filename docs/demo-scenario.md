# 데모 시나리오

## 목적

다음 담당자가 서비스의 주요 사용자 흐름과 코드 진입점을 빠르게 이해하도록 돕는 시연 순서입니다. 인수인계 미팅에서는 실제 API 환경을 우선 사용하고, 백엔드가 준비되지 않았을 때만 MSW 환경으로 대체합니다.

## 사전 준비

1. 의존성을 설치합니다.

```bash
yarn install
```

2. 실제 API 환경으로 실행합니다.

```bash
yarn dev
```

3. 백엔드 없이 확인할 때는 Mock API로 실행합니다.

```bash
yarn dev:msw
```

4. 운영 경로 관련 이슈를 확인할 때는 build 후 preview를 사용합니다.

```bash
yarn build
yarn preview
```

## 1. 로그인과 인증 상태

시연 경로:

- `/`
- 로그인 버튼 또는 HISNet 로그인 흐름
- 로그인 후 `/dashboard` 진입

확인 포인트:

- 로그인 성공 시 `src/stores/useAuthStore.ts`에 학생 정보, 현재 학기, term이 저장되는지 확인합니다.
- 인증이 필요한 화면은 `AuthGuard` 아래에 있으므로 비로그인 상태에서 접근이 막히는지 확인합니다.
- API가 401을 반환하면 `src/apis/axios.ts`에서 toast를 띄우고 로그아웃되는 흐름을 설명합니다.
- 로그아웃 시 GitHub/포트폴리오 관련 localStorage가 정리되는 것을 설명합니다.

관련 코드:

- `src/pages/auth/LoginPage`
- `src/pages/auth/apis/auth.ts`
- `src/pages/auth/hooks`
- `src/stores/useAuthStore.ts`
- `src/apis/axios.ts`

## 2. 대시보드

시연 경로:

- `/dashboard`

확인 포인트:

- 마일스톤 역량 차트가 정상 렌더링되는지 확인합니다.
- 학기별 역량, 비교 역량, 활동 추천 영역을 확인합니다.
- 장학금 신청 기간 안내와 FAQ/contact 영역을 확인합니다.
- 차트 데이터가 비어 있거나 API 에러가 발생했을 때 fallback이 자연스럽게 표시되는지 봅니다.

관련 코드:

- `src/pages/dashboard/DashboardPage`
- `src/pages/dashboard/apis/capability.ts`
- `src/pages/dashboard/hooks`
- `src/components/Chart`

## 3. 마일리지 목록

시연 경로:

- `/mileage`

확인 포인트:

- 키워드 검색이 동작하는지 확인합니다.
- 학기, 카테고리, 이수 여부 필터를 바꿔 봅니다.
- 데스크톱 테이블과 모바일 UI 차이를 확인합니다.
- 목록 skeleton, empty state, error fallback을 설명합니다.

관련 코드:

- `src/pages/mileage/MileageListPage`
- `src/pages/mileage/apis/mileage.ts`
- `src/pages/mileage/hooks/useFilteredByKeyword.ts`
- `src/pages/mileage/hooks/useFilteredBySemester.ts`

## 4. 추가 마일리지 등록, 수정, 삭제

시연 경로:

- `/mileage/add`

확인 포인트:

- 기타 마일리지 항목을 선택하고 설명을 입력합니다.
- 첨부 파일 업로드가 필요한 항목을 확인합니다.
- 등록 후 제출 내역 모달 또는 목록 갱신을 확인합니다.
- 제출한 마일리지를 수정하고 삭제하는 흐름을 보여줍니다.
- 파일 다운로드 버튼이 Blob 응답을 사용한다는 점을 설명합니다.

관련 코드:

- `src/pages/mileage/MileageAddPage`
- `src/pages/mileage/MileageAddPage/components`
- `src/pages/mileage/apis/mileage.ts`
- `src/shared/hooks/useFile.ts`
- `src/shared/hooks/useFileWithType.ts`

주의할 점:

- 등록/수정 API는 `multipart/form-data`입니다.
- 학생 ID가 URL path에 포함되는 API가 있으므로 로그인 사용자 정보와 함께 확인해야 합니다.

## 5. 장학금 신청

시연 경로:

- `/scholarship/apply`

확인 포인트:

- 장학금 신청 가능 기간 안내를 확인합니다.
- 이미 신청한 사용자인 경우 상태 표시가 적절한지 확인합니다.
- 개인정보 수집/이용 동의 내용을 확인합니다.
- 동의 후 신청 성공 모달이 표시되는지 확인합니다.

관련 코드:

- `src/pages/mileage/ScholarshipApplyPage`
- `src/pages/mileage/apis/scholarship.ts`
- `src/pages/mileage/constants/personalInfoConsent.ts`
- `src/utils/getIsScholarshipDuration.ts`

## 6. 포트폴리오와 GitHub 연동

시연 경로:

- `/portfolio`
- `/my`

확인 포인트:

- 마이페이지에서 GitHub 연결 상태를 확인합니다.
- GitHub 연결 버튼이 OAuth URL로 이동하는 흐름을 설명합니다.
- 연결된 상태에서 포트폴리오의 저장소, 활동, 마일리지, 기술스택 데이터를 확인합니다.
- 포트폴리오 섹션별 선택/수정 흐름을 보여줍니다.
- 포트폴리오 markdown 생성 유틸이 있는 위치를 설명합니다.

관련 코드:

- `src/pages/profile/MyPage`
- `src/pages/profile/apis/github.ts`
- `src/pages/portfolio/PortfolioPage`
- `src/pages/portfolio/apis`
- `src/pages/portfolio/PortfolioPage/context/PortfolioContext.tsx`
- `src/pages/portfolio/PortfolioPage/utils/buildPortfolioMarkdown.ts`

주의할 점:

- GitHub 연결 상태는 서버 응답과 localStorage가 함께 쓰입니다.
- OAuth 리다이렉트는 프론트 라우터가 아니라 `window.location.href`로 이동합니다.

## 7. CV 생성 마법사

시연 경로:

- `/cv`
- `/cv/generate`

확인 포인트:

- CV 목록에서 저장된 CV, 공개 여부, 즐겨찾기 상태를 확인합니다.
- 생성 마법사 Step 1에서 목적, 직무, 채용공고, 추가 메모를 입력합니다.
- Step 2에서 포트폴리오 자료, 마일리지, 활동, GitHub 저장소를 선택합니다.
- Step 3에서 디자인 선호도를 선택하고 HTML 생성을 실행합니다.
- 생성 결과 미리보기, 제목 수정, 저장 흐름을 확인합니다.

관련 코드:

- `src/pages/cv/CVPage/CvManagePage.tsx`
- `src/pages/cv/CVPage/CvGeneratePage.tsx`
- `src/pages/cv/CVPage/components/CvGenerateStep1.tsx`
- `src/pages/cv/CVPage/components/CvGenerateStep2.tsx`
- `src/pages/cv/CVPage/components/CvGenerateStep3.tsx`
- `src/pages/cv/apis/cv.ts`
- `src/stores/useCvWizardStore.ts`

주의할 점:

- prompt 생성과 HTML 생성은 API가 분리되어 있습니다.
- `design_preferences`는 Step 2/3 흐름에서 서버에 저장 또는 반영됩니다.
- 서버 응답 필드가 일부 다른 형태로 내려오는 경우를 대비해 CV API 파일에서 normalize합니다.

## 8. CV 공개 공유와 출력

시연 경로:

- `/cv`
- `/cv/share/:publicToken`

확인 포인트:

- CV 관리 화면에서 공개 여부를 켭니다.
- 공유 URL을 새 탭에서 열어 로그인 없이 접근되는지 확인합니다.
- 비공개, 삭제됨, HTML 없음 상태에서 guidance UI가 나오는지 확인합니다.
- CV 미리보기에서 모바일/데스크톱 표시와 PDF 또는 이미지 출력 흐름을 확인합니다.

관련 코드:

- `src/pages/cv/CVPage/CvSharePage.tsx`
- `src/pages/cv/CVPage/components/CvPreviewContent.tsx`
- `src/pages/cv/CVPage/components/cvHtmlPublicUi.tsx`
- `src/pages/cv/utils/sanitizeCvHtml.ts`
- `src/constants/routePath.ts`

주의할 점:

- 공개 공유 API는 인증 없는 별도 Axios client를 사용합니다.
- HTML은 sanitize 후 렌더링해야 합니다.
- `CvPreviewContent.tsx` 수정 시 공유 페이지와 출력 기능을 같이 확인해야 합니다.

## 9. 유지보수 모드와 에러 처리

시연 경로:

- 임의의 인증 화면
- 존재하지 않는 경로
- API 실패 상태

확인 포인트:

- 유지보수 API가 활성 상태일 때 `MaintenanceGate`가 안내 화면을 보여주는지 설명합니다.
- 존재하지 않는 경로에서 NotFound 페이지가 표시되는지 확인합니다.
- ErrorBoundary와 Suspense fallback 위치를 설명합니다.
- mutation 에러는 toast로 표시되는지 확인합니다.

관련 코드:

- `src/components/MaintenanceGate`
- `src/pages/etc/MaintenancePage`
- `src/pages/etc/NotFoundPage`
- `src/pages/etc/ErrorPage`
- `src/components/Error`
- `src/App.tsx`

## 마무리 검증

인수인계 미팅 마지막에는 다음 명령 결과를 함께 확인합니다.

```bash
yarn lint
yarn build
```

시간이 있으면 `yarn storybook`으로 공통 컴포넌트 스토리도 확인합니다.
