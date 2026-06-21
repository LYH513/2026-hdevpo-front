# 알려진 이슈와 주의사항

## 우선 확인할 일

1. README가 매우 간단합니다.
   - 실제 온보딩은 `HANDOFF.md`와 `docs` 하위 문서를 기준으로 진행하세요.
   - 팀에서 README를 공식 진입점으로 쓰려면 `HANDOFF.md` 링크를 README에 추가하는 것이 좋습니다.

2. `.env.example`이 없습니다.
   - 필요한 환경 변수 목록은 `HANDOFF.md`에 정리되어 있습니다.
   - 실제 값은 문서나 커밋에 남기지 말고 별도 보안 채널로 전달해야 합니다.

3. 자동 테스트가 없습니다.
   - `src/**/*.test.*` 파일이 현재 없습니다.
   - 기능 변경 시 `yarn lint`, `yarn build`, `yarn dev:msw` smoke test를 최소 기준으로 삼으세요.

4. Storybook 커버리지가 낮습니다.
   - 현재 확인된 story는 `Button`, `Flex` 중심입니다.
   - Chromatic CI가 있어도 주요 화면 회귀를 충분히 막아주지는 못합니다.

5. 패키지 매니저 기준이 혼재되어 있습니다.
   - `yarn.lock`과 `package-lock.json`이 함께 있습니다.
   - GitHub Actions는 `yarn`을 사용합니다.
   - 다음 담당자는 팀 기준을 정하고 한쪽 lockfile만 유지하는 방향을 검토하세요.

## 검증 체크리스트

변경 후 최소 검증:

```bash
yarn lint
yarn build
```

백엔드 없이 화면 smoke test:

```bash
yarn dev:msw
```

공통 컴포넌트 확인:

```bash
yarn storybook
```

배포 경로 확인:

```bash
yarn build
yarn preview
```

수동으로 반드시 확인할 화면:

- 로그인과 로그아웃
- `/dashboard`
- `/mileage`
- `/mileage/add`
- `/scholarship/apply`
- `/portfolio`
- `/cv`
- `/cv/generate`
- `/cv/share/:publicToken`
- `/my`

## 회귀 위험이 큰 영역

### CV 미리보기와 공유

관련 파일:

- `src/pages/cv/CVPage/components/CvPreviewContent.tsx`
- `src/pages/cv/CVPage/CvSharePage.tsx`
- `src/pages/cv/apis/cv.ts`
- `src/pages/cv/utils/sanitizeCvHtml.ts`
- `src/constants/routePath.ts`

위험 요인:

- HTML 렌더링과 sanitize가 함께 얽혀 있습니다.
- 공개 공유 페이지는 로그인 없이 접근해야 합니다.
- PDF/이미지 출력 의존성으로 `html2canvas`, `jspdf`가 사용됩니다.
- `/milestone25/` base path가 공유 URL 생성에 영향을 줍니다.
- 공개 API는 200, 204, 403, 404를 모두 UI 상태로 분기합니다.

수정 후 확인할 것:

- CV 목록 조회
- CV 생성 Step 1, 2, 3
- HTML 생성 결과 미리보기
- CV 제목 수정
- 공개 여부 변경
- 즐겨찾기 변경
- 공유 URL 새 탭 열기
- 비공개/삭제/HTML 없음 상태
- 모바일 화면
- PDF 또는 이미지 출력

### 인증과 쿠키

관련 파일:

- `src/apis/axios.ts`
- `src/pages/auth/apis/auth.ts`
- `src/stores/useAuthStore.ts`
- `src/components/AuthGuard`

위험 요인:

- 쿠키 기반 인증이므로 `withCredentials`와 백엔드 CORS 설정이 맞아야 합니다.
- 401 응답은 전역 로그아웃으로 이어집니다.
- 로그아웃 시 GitHub/포트폴리오 localStorage도 정리됩니다.

수정 후 확인할 것:

- 로그인 성공
- 새로고침 후 로그인 상태 유지
- 401 응답 시 로그아웃
- 로그아웃 후 localStorage 상태

### 포트폴리오와 GitHub 연동

관련 파일:

- `src/pages/profile/apis/github.ts`
- `src/pages/portfolio/apis/repositories.ts`
- `src/pages/portfolio/PortfolioPage/context/PortfolioContext.tsx`
- `src/pages/portfolio/PortfolioPage/components`

위험 요인:

- GitHub OAuth 연결은 라우터 이동이 아니라 `window.location.href` 직접 이동입니다.
- 연결 상태가 서버와 localStorage에 함께 반영됩니다.
- 저장소 목록은 페이지네이션과 캐시 갱신 API가 섞여 있습니다.
- 포트폴리오 섹션 데이터가 CV 생성 자료로 이어집니다.

수정 후 확인할 것:

- GitHub 연결 상태 표시
- OAuth 연결 버튼 동작
- 연결 해제
- 저장소 캐시 갱신
- 저장소 검색/선택
- 포트폴리오 markdown 생성
- CV 생성 단계에서 선택 자료 반영

### 마일리지 등록과 파일

관련 파일:

- `src/pages/mileage/apis/mileage.ts`
- `src/pages/mileage/MileageAddPage`
- `src/shared/hooks/useFile.ts`
- `src/shared/hooks/useFileWithType.ts`

위험 요인:

- 등록/수정 API가 `multipart/form-data`입니다.
- 첨부 파일 다운로드는 Blob 응답을 사용합니다.
- 학생 ID와 record ID가 path에 포함됩니다.

수정 후 확인할 것:

- 첨부 없는 등록
- 첨부 있는 등록
- 제출 내역 조회
- 제출 내역 수정
- 제출 내역 삭제
- 첨부 파일 다운로드

## 운영 권한 인수인계

다음 항목은 코드만으로는 이어받을 수 없으므로 계정/권한을 별도로 전달해야 합니다.

- 백엔드 API 서버 주소와 운영/개발 환경 구분
- HISNet 로그인 또는 인증 연동 테스트 계정
- Sentry 조직/프로젝트 접근 권한
- Sentry DSN과 빌드 플러그인 토큰
- Chromatic 프로젝트 권한
- GitHub Actions secret `CHROMATIC_PROJECT_TOKEN`
- Amplitude 프로젝트와 API key
- 배포 플랫폼 접근 권한
- GitHub OAuth app 설정 권한

## CI와 배포 주의사항

현재 확인된 GitHub Actions workflow:

- `.github/workflows/storybook_ci.yml`

주의할 점:

- PR 대상 branch는 `main`입니다.
- Node 20을 사용합니다.
- Chromatic 실행 후 PR에 Storybook URL을 댓글로 남깁니다.
- 현재 workflow는 lint/build/test를 실행하지 않습니다.
- `paths: ['*']` 설정은 하위 디렉터리 변경을 모두 감지하지 못할 수 있으므로 필요 시 재검토하세요.

## Mock API 주의사항

관련 파일:

- `src/mocks/handlers`
- `src/mocks/fixtures`
- `src/mocks/browser.ts`

주의할 점:

- `VITE_API_MODE=msw`일 때만 worker가 시작됩니다.
- worker URL은 `/milestone25/mockServiceWorker.js`입니다.
- MSW fixture가 실제 백엔드 응답과 다를 수 있으므로 API 계약 변경 시 함께 갱신해야 합니다.

## 문서 유지보수 기준

다음 변경이 생기면 문서도 함께 수정하세요.

- 라우트가 추가되거나 삭제됨
- `src/apis/endPoint.ts`가 변경됨
- 환경 변수가 추가됨
- 배포 base path가 변경됨
- 인증 방식이 변경됨
- CV 생성/공유 API 계약이 변경됨
- 운영 도구나 CI secret이 변경됨
