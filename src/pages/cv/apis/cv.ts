import { BASE_URL } from '@/apis/config';
import { ENDPOINT } from '@/apis/endPoint';
import { http } from '@/apis/http';
import axios from 'axios';

/** 인증 인터셉터(401 시 로그아웃) 없이 공개 엔드포인트만 호출 */
const cvSharePublicClient = axios.create({
  baseURL: BASE_URL,
});

/** GET 응답 — 디자인 선호 (추후 UI에서 사용 예정) */
export interface PortfolioCvDesignPreferences {
  layout: string;
  color_theme: string;
  density: string;
  additional_notes: string;
}

/** GET /api/portfolio/cv 목록 한 건 */
export interface PortfolioCvListItem {
  id: number;
  title: string;
  job_posting: string;
  target_position: string;
  additional_notes: string;
  design_preferences: PortfolioCvDesignPreferences;
  /** `cv` · 취업 준비 / `archive` · 역량 평가 등 */
  mode: string;
  public_token: string;
  created_at: string;
  updated_at: string;
  is_public: boolean;
  is_favorite: boolean;
}

export type PortfolioCvListSort = 'newest' | 'favorites';

export interface GetPortfolioCvListParams {
  /** 기본 `newest`. `favorites` — 즐겨찾기 먼저, 그다음 최신순 */
  sort?: PortfolioCvListSort;
}

export interface PortfolioCvListResponse {
  cvs: PortfolioCvListItem[];
  total: number;
}

/** GET /api/portfolio/cv/{id} 상세 */
export interface PortfolioCvDetail extends PortfolioCvListItem {
  prompt: string;
  html_content: string;
  selected_repo_ids: number[];
  selected_mileage_ids: number[];
  selected_activity_ids: number[];
  /** POST generate-html 등 응답에 포함될 수 있음 */
  model_used?: string;
  tokens_used?: number;
  last_generated_at?: string;
}

function readCvId(o: Record<string, unknown>): number {
  const v = o.id;
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v))) {
    return Number(v);
  }
  return 0;
}

function hasOwnKey(o: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(o, key);
}

/** 일부 배포 서버는 `is_public` 대신 `_public`(Jackson 등)으로 내려줌 */
function readCvIsPublic(o: Record<string, unknown>): boolean {
  if (
    !hasOwnKey(o, 'is_public') &&
    !hasOwnKey(o, '_public') &&
    !hasOwnKey(o, 'isPublic')
  ) {
    return false;
  }
  const v = o.is_public ?? o._public ?? o.isPublic;
  return Boolean(v);
}

function readCvIsFavorite(o: Record<string, unknown>): boolean {
  if (
    !hasOwnKey(o, 'is_favorite') &&
    !hasOwnKey(o, 'isFavorite') &&
    !hasOwnKey(o, '_favorite')
  ) {
    return false;
  }
  const v = o.is_favorite ?? o.isFavorite ?? o._favorite;
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v !== 0;
  if (typeof v === 'string') {
    const s = v.trim().toLowerCase();
    if (s === 'true' || s === '1') return true;
    if (s === 'false' || s === '0') return false;
  }
  return Boolean(v);
}

function readDesignPreferences(raw: unknown): PortfolioCvDesignPreferences {
  if (raw == null || typeof raw !== 'object') {
    return {
      layout: '',
      color_theme: '',
      density: '',
      additional_notes: '',
    };
  }
  const d = raw as Record<string, unknown>;
  return {
    layout: String(d.layout ?? ''),
    color_theme: String(d.color_theme ?? ''),
    density: String(d.density ?? ''),
    additional_notes: String(d.additional_notes ?? ''),
  };
}

function readCvMode(o: Record<string, unknown>): string {
  const m = o.mode;
  if (m === 'archive') return 'archive';
  if (m === 'cv') return 'cv';
  if (typeof m === 'string' && m.trim() !== '') return m.trim();
  return 'cv';
}

function readIdArray(raw: unknown): number[] {
  if (!Array.isArray(raw)) return [];
  const out: number[] = [];
  for (const x of raw) {
    if (typeof x === 'number' && Number.isFinite(x)) {
      out.push(x);
      continue;
    }
    if (typeof x === 'string' && x.trim() !== '' && !Number.isNaN(Number(x))) {
      out.push(Number(x));
    }
  }
  return out;
}

function normalizePortfolioCvListItem(raw: unknown): PortfolioCvListItem {
  if (raw == null || typeof raw !== 'object') {
    return {
      id: 0,
      title: '',
      job_posting: '',
      target_position: '',
      additional_notes: '',
      design_preferences: readDesignPreferences(undefined),
      mode: 'cv',
      public_token: '',
      created_at: '',
      updated_at: '',
      is_public: false,
      is_favorite: false,
    };
  }
  const o = raw as Record<string, unknown>;
  return {
    id: readCvId(o),
    title: String(o.title ?? ''),
    job_posting: String(o.job_posting ?? ''),
    target_position: String(o.target_position ?? ''),
    additional_notes: String(o.additional_notes ?? ''),
    design_preferences: readDesignPreferences(o.design_preferences),
    mode: readCvMode(o),
    public_token: String(o.public_token ?? ''),
    created_at: String(o.created_at ?? ''),
    updated_at: String(o.updated_at ?? ''),
    is_public: readCvIsPublic(o),
    is_favorite: readCvIsFavorite(o),
  };
}

function readOptionalTokensUsed(v: unknown): number | undefined {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v))) {
    return Number(v);
  }
  return undefined;
}

export function normalizePortfolioCvDetail(raw: unknown): PortfolioCvDetail {
  const base = normalizePortfolioCvListItem(raw);
  const o =
    raw != null && typeof raw === 'object'
      ? (raw as Record<string, unknown>)
      : {};
  const detail: PortfolioCvDetail = {
    ...base,
    prompt: String(o.prompt ?? ''),
    html_content: String(o.html_content ?? ''),
    selected_repo_ids: readIdArray(o.selected_repo_ids),
    selected_mileage_ids: readIdArray(o.selected_mileage_ids),
    selected_activity_ids: readIdArray(o.selected_activity_ids),
  };
  if (o.model_used != null && String(o.model_used).trim() !== '') {
    detail.model_used = String(o.model_used);
  }
  const tu = readOptionalTokensUsed(o.tokens_used);
  if (tu !== undefined) {
    detail.tokens_used = tu;
  }
  if (o.last_generated_at != null && String(o.last_generated_at).trim() !== '') {
    detail.last_generated_at = String(o.last_generated_at);
  }
  return detail;
}

export const getPortfolioCvList = async (params?: GetPortfolioCvListParams) => {
  const searchParams = new URLSearchParams();
  if (params?.sort != null && params.sort !== 'newest') {
    searchParams.set('sort', params.sort);
  }
  const query = searchParams.toString();
  const url = query ? `${ENDPOINT.PORTFOLIO_CV}?${query}` : ENDPOINT.PORTFOLIO_CV;
  const raw = await http.get<{ cvs?: unknown[]; total?: number }>(url);
  const cvs = (raw.cvs ?? []).map(normalizePortfolioCvListItem);
  const total =
    typeof raw.total === 'number' && Number.isFinite(raw.total) ? raw.total : cvs.length;
  return { cvs, total } satisfies PortfolioCvListResponse;
};

export const getPortfolioCvById = async (id: number) => {
  const raw = await http.get<unknown>(`${ENDPOINT.PORTFOLIO_CV}/${id}`);
  return normalizePortfolioCvDetail(raw);
};

/** POST /api/portfolio/cv/build-prompt */
export type PortfolioCvBuildPromptMode = 'cv' | 'archive';

export interface PortfolioCvBuildPromptRequest {
  /** 취업 준비 ON → `cv`, OFF → `archive` (서버 기본은 cv) */
  mode: PortfolioCvBuildPromptMode;
  job_posting: string;
  target_position: string;
  additional_notes: string;
  title: string;
  selected_mileage_ids: number[];
  selected_activity_ids: number[];
  selected_repo_ids: number[];
  /**
   * 2→3단계에서는 `null`로 전송. 객체 전송 시 서버가 STEP 2에 [design_preferences] 블록으로 반영·저장.
   */
  design_preferences: PortfolioCvDesignPreferences | null;
}

export interface PortfolioCvBuildPromptResponse {
  prompt: string;
  cv_id: number;
  public_token: string;
}

export const postPortfolioCvBuildPrompt = async (body: PortfolioCvBuildPromptRequest) => {
  return http.post<PortfolioCvBuildPromptRequest, PortfolioCvBuildPromptResponse>(
    `${ENDPOINT.PORTFOLIO_CV}/build-prompt`,
    body,
  );
};

/**
 * POST /api/portfolio/cv/{id}/generate-html
 * design_preferences 적용 + OpenAI로 HTML 생성. `model`은 서버 기본 사용 시 생략.
 */
export interface PortfolioCvGenerateHtmlRequest {
  design_preferences: PortfolioCvDesignPreferences;
  model?: string;
}

export const postPortfolioCvGenerateHtml = async (
  id: number,
  body: PortfolioCvGenerateHtmlRequest,
) => {
  const payload: { design_preferences: PortfolioCvDesignPreferences } = {
    design_preferences: body.design_preferences,
  };
  const raw = await http.post<typeof payload, unknown>(
    `${ENDPOINT.PORTFOLIO_CV}/${id}/generate-html`,
    payload,
  );
  return normalizePortfolioCvDetail(raw);
};

/** PATCH /api/portfolio/cv/{id} — title·html_content·is_public 각각 선택(부분 갱신 가능) */
export interface PortfolioCvPatchRequest {
  title?: string;
  html_content?: string;
  is_public?: boolean;
  is_favorite?: boolean;
}

/** 부분 PATCH 응답에 is_favorite 등이 빠질 수 있어 raw 반환 — 캐시 병합은 mutation에서 처리 */
export const patchPortfolioCv = async (id: number, body: PortfolioCvPatchRequest) => {
  return http.patch<PortfolioCvPatchRequest, unknown>(
    `${ENDPOINT.PORTFOLIO_CV}/${id}`,
    body,
  );
};

/** DELETE /api/portfolio/cv/{id} */
export const deletePortfolioCv = async (id: number) => {
  return http.delete<void>(`${ENDPOINT.PORTFOLIO_CV}/${id}`);
};

/**
 * GET /api/portfolio/share/cv/{publicToken}/html
 * JWT 없이 호출. 200·204·403·404 는 본 함수에서 예외 없이 구분 반환, 그 외·네트워크 오류는 throw.
 */
export type PortfolioCvShareHtmlResult =
  | { status: 200; html: string }
  | { status: 204 }
  | { status: 403; guidanceHtml: string }
  | { status: 404; guidanceHtml: string };

export const getPortfolioCvShareHtml = async (
  publicToken: string,
): Promise<PortfolioCvShareHtmlResult> => {
  const path = `${ENDPOINT.PORTFOLIO_CV_SHARE}/${encodeURIComponent(publicToken)}/html`;
  const res = await cvSharePublicClient.get<string>(path, {
    responseType: 'text',
    validateStatus: s => [200, 204, 403, 404].includes(s),
  });
  const body = typeof res.data === 'string' ? res.data : '';
  if (res.status === 200) {
    return { status: 200, html: body };
  }
  if (res.status === 204) {
    return { status: 204 };
  }
  if (res.status === 403) {
    return { status: 403, guidanceHtml: body };
  }
  if (res.status === 404) {
    return { status: 404, guidanceHtml: body };
  }
  throw new Error(`Unexpected CV share response: ${res.status}`);
};
