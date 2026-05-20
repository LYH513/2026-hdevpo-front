import { ENDPOINT } from '@/apis/endPoint';
import { http } from '@/apis/http';

/** 언어별 비율 (GitHub linguist 등) */
export interface PortfolioRepositoryLanguage {
  name: string;
  percentage: number;
}

/** 팀 구성 한 줄 (역할 + 인원 수) */
export interface TeamCompositionEntry {
  role: string;
  count: number;
}

/** 내 역할·기여도 */
export interface PortfolioRepositoryMyRole {
  role: string;
  contribution_percent: number;
}

/** 기간: GitHub 메타 + 사용자 표시용 override */
export interface PortfolioRepositoryDuration {
  started_at_github?: string;
  updated_at_github?: string;
  /** 사용자 override; 빈 문자열로 PATCH 시 해당 override 삭제 */
  started_at?: string;
  updated_at?: string;
}

/** PATCH duration — 필드 생략은 유지, 빈 문자열은 해당 override 삭제 */
export interface PatchRepositoryDuration {
  started_at?: string | null;
  updated_at?: string | null;
}

/** 활동 요약 - 포트폴리오 레포지토리 한 건 (GET/PATCH 응답) */
export interface PortfolioRepositoryItem {
  id: number;
  repo_id: number;
  custom_title: string | null;
  description: string;
  /** GitHub 원본 설명 (커스텀 description 비우면 UI에서 fallback으로 사용) */
  github_description?: string;
  is_visible: boolean;
  display_order: number;
  /** GitHub 저장소 이름 (REST `name`에 해당) */
  github_title: string;
  html_url: string;
  /** 단일 대표 언어(하위 호환). `languages`가 있으면 우선 사용 */
  language?: string;
  languages?: PortfolioRepositoryLanguage[];
  created_at: string;
  updated_at: string;
  visibility: string;
  owner: string;
  commit_count?: number;
  stargazers_count?: number;
  forks_count?: number;
  /** 전체 팀 구성(역할별 인원) */
  team_composition?: TeamCompositionEntry[];
  /** 내 역할 및 기여도(0–100) */
  my_role?: PortfolioRepositoryMyRole | null;
  /** 주요 기여 상세(마크다운·불릿 등 자유 입력) */
  key_contributions?: string | null;
  /** 표시 기간·GitHub 기준 시각 */
  duration?: PortfolioRepositoryDuration | null;
}

/** PATCH /api/portfolio/repositories/:id 요청 body — 부분 업데이트(null = 해당 필드 변경 없음) */
export interface PatchRepositoryBody {
  custom_title?: string | null;
  description?: string | null;
  is_visible?: boolean;
  display_order?: number;
  team_composition?: TeamCompositionEntry[] | null;
  my_role?: PortfolioRepositoryMyRole | null;
  key_contributions?: string | null;
  duration?: PatchRepositoryDuration | null;
}

export interface RepositoriesResponse {
  repositories: PortfolioRepositoryItem[];
  /** 필터 적용 후 전체 건수 (페이지네이션 계산용) */
  total: number;
}

/** PUT /api/portfolio/repositories — 표시 설정 일괄 동기화 응답 */
export interface PutRepositoriesSyncResponse {
  warnings?: string[];
  skipped?: string[];
}

/** POST /api/portfolio/repositories/github-cache/refresh 응답 */
export interface GithubRepositoriesCacheRefreshResponse {
  reposSynced: number;
}

/** 활동 요약 - 포트폴리오 레포지토리 PUT 요청 한 건 */
export interface PutRepositoryItem {
  repo_id: number;
  custom_title: string | null;
  description: string;
  is_visible: boolean;
}

export interface GetRepositoriesParams {
  page?: number;
  per_page?: number;
  visible_only?: boolean;
  /** owner_login(조직/유저) 정확 일치 */
  owner?: string;
  /** 레포 이름·owner·URL·설명·언어·repo_id·커스텀 제목/설명 (공백 AND) */
  search?: string;
}

/** GitHub 레포 캐시 갱신 (마이페이지 연결 직후·모달에서 수동 호출) */
export const postGithubRepositoriesCacheRefresh = async () => {
  const response = await http.post<
    undefined,
    GithubRepositoriesCacheRefreshResponse
  >(ENDPOINT.PORTFOLIO_REPOSITORIES_GITHUB_CACHE_REFRESH);
  return response;
};

/** 활동 요약 - 포트폴리오 레포지토리 조회 (페이지네이션) */
export const getRepositories = async (params?: GetRepositoriesParams) => {
  const searchParams = new URLSearchParams();
  if (params?.page != null) searchParams.set('page', String(params.page));
  if (params?.per_page != null) searchParams.set('per_page', String(params.per_page));
  if (params?.visible_only != null) {
    searchParams.set('visible_only', String(params.visible_only));
  }
  if (params?.owner != null && params.owner.trim() !== '') {
    searchParams.set('owner', params.owner.trim());
  }
  if (params?.search != null && params.search.trim() !== '') {
    searchParams.set('search', params.search.trim());
  }
  const query = searchParams.toString();
  const url = query ? `${ENDPOINT.PORTFOLIO_REPOSITORIES}?${query}` : ENDPOINT.PORTFOLIO_REPOSITORIES;
  const response = await http.get<RepositoriesResponse>(url);
  return response;
};

/** 빈 배열 나올 때까지 모든 페이지 조회 (병렬 배치로 속도 개선) */
export const getAllRepositories = async (
  options: GetRepositoriesParams & { perPage?: number } = {},
): Promise<PortfolioRepositoryItem[]> => {
  const { perPage = 20, ...baseParams } = options;
  const BATCH = 5;
  const MAX_PAGES = 100;

  // 1페이지를 먼저 가져와 데이터가 더 있는지 확인
  const firstRes = await getRepositories({ ...baseParams, page: 1, per_page: perPage });
  const firstList = firstRes.repositories ?? [];
  if (firstList.length < perPage) return firstList;

  const all = [...firstList];
  let startPage = 2;

  for (;;) {
    if (startPage > MAX_PAGES) break;
    // BATCH 개 페이지를 병렬로 요청
    const pages = Array.from({ length: BATCH }, (_, i) => startPage + i);
    const results = await Promise.all(
      pages.map(p => getRepositories({ ...baseParams, page: p, per_page: perPage })),
    );

    let done = false;
    for (const res of results) {
      const list = res.repositories ?? [];
      if (list.length === 0) { done = true; break; }
      all.push(...list);
      if (list.length < perPage) { done = true; break; }
    }
    if (done) break;
    startPage += BATCH;
  }

  return all;
};

/** 활동 요약 - 포트폴리오 레포지토리 전체 교체 (PUT) */
export const putRepositories = async (body: PutRepositoryItem[]) => {
  const response = await http.put<
    PutRepositoryItem[],
    PutRepositoriesSyncResponse
  >(ENDPOINT.PORTFOLIO_REPOSITORIES, body);
  return response;
};

/** 활동 요약 - 포트폴리오 레포지토리 한 건 수정 (PATCH) */
export const patchRepository = async (
  id: number,
  body: PatchRepositoryBody,
) => {
  const response = await http.patch<
    PatchRepositoryBody,
    PortfolioRepositoryItem
  >(`${ENDPOINT.PORTFOLIO_REPOSITORIES}/${id}`, body);
  return response;
};
