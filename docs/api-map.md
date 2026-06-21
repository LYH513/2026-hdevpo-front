# API 맵

## 공통 규칙

API base URL은 `src/apis/config.ts`의 `BASE_URL`입니다.

- 환경 변수 `VITE_API_URL`이 있으면 그 값을 사용합니다.
- 없으면 `http://localhost:8080/milestone25`를 사용합니다.

공통 요청 흐름은 다음 파일을 기준으로 합니다.

- Axios 인스턴스: `src/apis/axios.ts`
- HTTP 래퍼: `src/apis/http.ts`
- endpoint 상수: `src/apis/endPoint.ts`

공통 Axios 설정:

- `withCredentials: true`로 쿠키 인증을 사용합니다.
- 500 응답은 Sentry에 capture합니다.
- 401 응답은 인증 실패 toast를 띄우고 `useAuthStore.logout()`을 호출합니다.

## 인증과 사용자

파일:

- `src/pages/auth/apis/auth.ts`
- `src/pages/auth/types/auth.ts`

Endpoints:

- `POST /api/mileage/auth/login`: HISNet token과 `AUTH_ACCESS_KEY`로 로그인합니다.
- `GET /api/mileage/users`: 로그인 사용자 정보를 조회합니다.
- `POST /api/mileage/auth/logout`: 로그아웃합니다.

관련 화면:

- `src/pages/auth/LoginPage`
- 인증이 필요한 전체 내부 화면

주의사항:

- 로그인 성공 후 사용자 정보는 `src/stores/useAuthStore.ts`에 저장됩니다.
- 로그아웃은 auth store와 포트폴리오/GitHub localStorage를 함께 정리합니다.

## 유지보수와 FAQ

파일:

- `src/apis/maintenance.ts`
- `src/apis/faq.ts`

Endpoints:

- `GET /api/mileage/maintenance`: 유지보수 상태를 확인합니다.
- `GET /api/mileage/contact`: FAQ/contact 안내를 조회합니다.

관련 화면:

- `src/components/MaintenanceGate`
- `src/pages/etc/MaintenancePage`
- `src/pages/dashboard/DashboardPage`

주의사항:

- `MaintenanceGate`가 전체 라우트 상위에 있으므로, 유지보수 모드가 켜지면 대부분의 화면 진입 전에 안내 화면이 표시됩니다.

## 대시보드 역량

파일:

- `src/pages/dashboard/apis/capability.ts`
- `src/pages/dashboard/types/capability.ts`

Endpoints:

- `GET /api/mileage/capability/milestone`: 마일스톤 역량 요약을 조회합니다.
- `GET /api/mileage/capability/semester`: 학기별 역량 데이터를 조회합니다.
- `GET /api/mileage/capability/milestone/compare`: term, entryYear, major 조건으로 비교 데이터를 조회합니다.
- `GET /api/mileage/detail`: 역량 상세 데이터를 조회합니다.
- `GET /api/mileage/capability/suggest`: 활동 추천 데이터를 조회합니다.

관련 화면:

- `src/pages/dashboard/DashboardPage`
- `src/pages/dashboard/DashboardPage/components`

주의사항:

- 비교 API는 빈 query string이 서버 500을 유발할 수 있어 빈 값은 요청 파라미터에서 제외합니다.

## 마일리지

파일:

- `src/pages/mileage/apis/mileage.ts`
- `src/pages/mileage/types/mileage.ts`

Endpoints:

- `GET /api/mileage/search`: 키워드, 카테고리, 학기, 이수 여부로 마일리지 목록을 검색합니다.
- `GET /api/mileage/etc`: 기타 마일리지 항목을 조회합니다.
- `POST /api/mileage/etc/{studentId}`: 추가 마일리지를 등록합니다.
- `GET /api/mileage/etc/get`: 제출한 추가 마일리지 목록을 조회합니다.
- `PATCH /api/mileage/etc/{studentId}/{recordId}`: 제출한 추가 마일리지를 수정합니다.
- `DELETE /api/mileage/etc/{studentId}/{recordId}`: 제출한 추가 마일리지를 삭제합니다.
- `GET /api/mileage/etc/file/{uniqueFileName}`: 첨부 파일을 Blob으로 다운로드합니다.

관련 화면:

- `src/pages/mileage/MileageListPage`
- `src/pages/mileage/MileageAddPage`

주의사항:

- 등록/수정 요청은 `multipart/form-data`입니다.
- `studentId`가 path에 포함됩니다.
- 전체 학기 필터는 API 요청 전 `all`로 변환됩니다.

## 장학금 신청

파일:

- `src/pages/mileage/apis/scholarship.ts`
- `src/pages/mileage/types/scholarship.ts`

Endpoints:

- `POST /api/mileage/apply/{studentId}`: 개인정보 동의 여부와 함께 장학금을 신청합니다.
- `GET /api/mileage/apply/status`: 현재 사용자의 신청 여부를 조회합니다.
- `GET /api/mileage/apply`: 장학금 신청 기간을 조회합니다.

관련 화면:

- `src/pages/mileage/ScholarshipApplyPage`
- `src/pages/dashboard/DashboardPage/components/ScholarshipDurationSection.tsx`

주의사항:

- 신청 가능 기간 계산은 `src/utils/getIsScholarshipDuration.ts`도 함께 확인합니다.
- 개인정보 동의 문구는 `src/pages/mileage/constants/personalInfoConsent.ts`에 있습니다.

## 수상 내역

파일:

- `src/pages/award/apis/award.ts`
- `src/pages/award/types/award.ts`

Endpoints:

- `GET /api/mileage/award`: 수상 내역 목록을 조회합니다.

관련 화면:

- `src/pages/award/AwardArchivePage`

주의사항:

- 연도, 수상 유형, 키워드 필터는 프론트 hook에서 처리합니다.

## GitHub 연동

파일:

- `src/pages/profile/apis/github.ts`
- `src/pages/profile/types/github.ts`

Endpoints:

- `GET /api/mileage/github/status`: GitHub 연결 상태를 조회합니다.
- `GET /api/mileage/github/orgs`: GitHub 조직 목록을 조회합니다.
- `GET /api/mileage/github/connect`: OAuth 연결 URL입니다. 프론트에서는 직접 이동합니다.
- `DELETE /api/mileage/github/connect`: GitHub 연결을 해제합니다.

관련 화면:

- `src/pages/profile/MyPage`
- `src/pages/portfolio/PortfolioPage/components/RepoSelectModal.tsx`

주의사항:

- OAuth 연결은 `http.get`이 아니라 `window.location.href = BASE_URL + ENDPOINT.GITHUB_CONNECT`로 처리합니다.
- 연결 상태는 서버 응답 후 `github-storage` localStorage에도 동기화됩니다.

## 프로필과 공지

파일:

- `src/pages/profile/apis/announcement.ts`
- `src/pages/portfolio/apis/userInfo.ts`

Endpoints:

- `GET /api/mileage/announcement`: 공지 정보를 조회합니다.
- `GET /api/portfolio/user-info`: 포트폴리오 사용자 정보를 조회합니다.
- `PATCH /api/portfolio/user-info`: bio, profile links, profile image URL 등을 부분 수정합니다.
- `PUT /api/portfolio/user-info/image`: 프로필 이미지를 업로드합니다.
- `GET /api/portfolio/user-info/image/{filename}`: 프로필 이미지 파일을 조회합니다.

관련 화면:

- `src/pages/profile/MyPage`
- `src/pages/portfolio/PortfolioPage`

주의사항:

- 이미지 업로드는 `multipart/form-data`이며 필드명은 `profile_image`입니다.
- profile link URL은 스킴이 없으면 `https://`를 붙여 정규화합니다.

## 포트폴리오 저장소

파일:

- `src/pages/portfolio/apis/repositories.ts`

Endpoints:

- `POST /api/portfolio/repositories/github-cache/refresh`: GitHub 저장소 메타 캐시를 갱신합니다.
- `GET /api/portfolio/repositories`: 저장소 목록을 조회합니다. page, per_page, visible_only, owner, search query를 지원합니다.
- `PUT /api/portfolio/repositories`: 저장소 표시 설정을 일괄 동기화합니다.
- `PATCH /api/portfolio/repositories/{id}`: 저장소 한 건의 제목, 설명, 표시 여부, 기여도, 기간 등을 수정합니다.

관련 화면:

- `src/pages/portfolio/PortfolioPage/components/RepoSectionContent.tsx`
- `src/pages/portfolio/PortfolioPage/components/RepoSelectModal.tsx`

주의사항:

- `getAllRepositories`는 페이지를 병렬 배치로 가져옵니다.
- `duration` override는 빈 문자열로 PATCH하면 해당 override 삭제 의미로 사용됩니다.

## 포트폴리오 활동

파일:

- `src/pages/portfolio/apis/activities.ts`

Endpoints:

- `GET /api/portfolio/activities`: 활동 목록을 조회합니다. category query를 여러 개 전달할 수 있습니다.
- `POST /api/portfolio/activities`: 활동을 추가합니다.
- `PATCH /api/portfolio/activities`: 활동을 일괄 수정합니다.
- `PUT /api/portfolio/activities/{id}`: 활동 한 건을 전체 수정합니다.
- `PATCH /api/portfolio/activities/{id}`: 활동 한 건을 부분 수정합니다.
- `DELETE /api/portfolio/activities/{id}`: 활동을 삭제합니다.

관련 화면:

- `src/pages/portfolio/PortfolioPage/components/ActivitiesSectionContent.tsx`

주의사항:

- 단건 PUT은 전체 덮어쓰기 성격입니다.
- PATCH는 null이 아닌 필드만 갱신하는 계약을 따릅니다.

## 포트폴리오 기술스택

파일:

- `src/pages/portfolio/apis/techStack.ts`

Endpoints:

- `GET /api/portfolio/tech-stack`: 기술스택 도메인 목록을 조회합니다.
- `PUT /api/portfolio/tech-stack`: 기술스택 도메인 목록을 저장합니다.

관련 화면:

- `src/pages/portfolio/PortfolioPage/components`

주의사항:

- 도메인별 `order_index`와 기술별 `level`이 UI 정렬/표시에 영향을 줍니다.

## 포트폴리오 마일리지

파일:

- `src/pages/portfolio/apis/mileage.ts`

Endpoints:

- `GET /api/portfolio/mileage`: 포트폴리오에 사용할 마일리지 목록을 조회합니다.
- `PUT /api/portfolio/mileage`: 포트폴리오 마일리지 선택을 전체 교체합니다.
- `PUT /api/portfolio/mileage/{id}`: 포트폴리오 마일리지 한 건의 추가 설명을 수정합니다.

관련 화면:

- `src/pages/portfolio/PortfolioPage/components/MileageSelectModal.tsx`

주의사항:

- `{id}`는 원본 마일리지 ID가 아니라 포트폴리오 항목 ID입니다.

## CV 생성, 관리, 공유

파일:

- `src/pages/cv/apis/cv.ts`

Endpoints:

- `GET /api/portfolio/cv`: CV 목록을 조회합니다. sort query로 `newest`, `favorites`를 사용할 수 있습니다.
- `GET /api/portfolio/cv/{id}`: CV 상세를 조회합니다.
- `POST /api/portfolio/cv/build-prompt`: 선택한 포트폴리오 자료와 입력값으로 prompt를 생성합니다.
- `POST /api/portfolio/cv/{id}/generate-html`: 디자인 선호도를 반영해 HTML을 생성합니다.
- `PATCH /api/portfolio/cv/{id}`: title, html_content, is_public, is_favorite 등을 부분 수정합니다.
- `DELETE /api/portfolio/cv/{id}`: CV를 삭제합니다.
- `GET /api/portfolio/share/cv/{publicToken}/html`: 로그인 없이 공개 CV HTML을 조회합니다.

관련 화면:

- `src/pages/cv/CVPage/CvManagePage.tsx`
- `src/pages/cv/CVPage/CvGeneratePage.tsx`
- `src/pages/cv/CVPage/CvSharePage.tsx`

주의사항:

- 공개 공유 API는 인증 인터셉터 없는 별도 Axios client를 사용합니다.
- 공개 공유 API는 200, 204, 403, 404를 정상 분기 값으로 반환하고 그 외 상태나 네트워크 오류만 throw합니다.
- 서버가 `is_public`, `_public`, `isPublic`처럼 다른 필드명을 내려줄 수 있어 normalize 로직이 있습니다.
- 서버가 `is_favorite`, `isFavorite`, `_favorite`처럼 다른 필드명을 내려줄 수 있어 normalize 로직이 있습니다.
- `selected_repo_ids`, `selected_mileage_ids`, `selected_activity_ids`는 문자열/숫자 혼합 응답을 숫자 배열로 정규화합니다.

## API 변경 시 점검 순서

1. `src/apis/endPoint.ts`의 endpoint 상수를 먼저 확인합니다.
2. 도메인 API 파일의 request/response 타입을 수정합니다.
3. 해당 hook의 query key와 cache invalidation을 확인합니다.
4. MSW handler와 fixture를 실제 응답 계약에 맞춥니다.
5. `docs/api-map.md`와 `docs/demo-scenario.md`의 관련 부분을 갱신합니다.
