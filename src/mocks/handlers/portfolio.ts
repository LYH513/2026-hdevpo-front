import { http, HttpResponse } from 'msw';

import { BASE_URL } from '@/apis/config';
import { ENDPOINT } from '@/apis/endPoint';
import type {
  ActivityApiItem,
  GithubRepositoriesCacheRefreshResponse,
  PortfolioMileageItem,
  PortfolioRepositoryItem,
  PutPortfolioMileageItem,
  PutRepositoryItem,
  UserInfoPatchRequest,
  UserInfoResponse,
} from '@/pages/portfolio/apis/portfolio';
import type { TechStackPutRequest } from '@/pages/portfolio/apis/portfolio';
import { clampTechLevel } from '@/pages/portfolio/utils/techStackLevel';
import type { PatchRepositoryBody } from '@/pages/portfolio/apis/repositories';
import { mockActivitiesResponse } from '@/mocks/fixtures/portfolioActivities';
import { mockMileageList } from '@/mocks/fixtures/mileageList';
import { mockPortfolioMileage } from '@/mocks/fixtures/portfolioMileage';
import { mockPortfolioRepositories } from '@/mocks/fixtures/portfolioRepositories';
import { mockTechStackResponse } from '@/mocks/fixtures/portfolioTechStack';
import { mockPortfolioCvDetails } from '@/mocks/fixtures/portfolioCv';
import { mockUserInfoResponse } from '@/mocks/fixtures/portfolioUserInfo';
import type {
  PortfolioCvBuildPromptRequest,
  PortfolioCvDesignPreferences,
  PortfolioCvDetail,
} from '@/pages/cv/apis/cv';

const techStackStore = {
  domains: mockTechStackResponse.domains.map(d => ({ ...d, tech_stacks: [...d.tech_stacks] })),
};

const userInfoStore: UserInfoResponse = { ...mockUserInfoResponse };

const activitiesStore: ActivityApiItem[] = mockActivitiesResponse.map(a => ({
  ...a,
}));
let nextActivityId = Math.max(0, ...activitiesStore.map(a => a.id)) + 1;

const repositoriesStore: PortfolioRepositoryItem[] = mockPortfolioRepositories.map(
  r => ({ ...r }),
);
let nextRepoId = Math.max(0, ...repositoriesStore.map(r => r.id)) + 1;

function mockRepositoryMatchesSearch(
  r: PortfolioRepositoryItem,
  searchRaw: string | null,
): boolean {
  if (searchRaw == null || searchRaw.trim() === '') return true;
  const tokens = searchRaw.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return true;
  const langNames = (r.languages ?? []).map(l => (l.name ?? '').toLowerCase());
  const parts = [
    r.github_title,
    r.owner,
    r.html_url,
    r.description,
    r.github_description ?? '',
    r.custom_title ?? '',
    r.language ?? '',
    ...langNames,
    String(r.repo_id),
  ];
  const haystack = parts.join(' ').toLowerCase();
  return tokens.every(t => haystack.includes(t.toLowerCase()));
}

function getMockPortfolioState() {
  const g = globalThis as unknown as {
    __mockPortfolioState?: { repoSelectionReset?: boolean };
  };
  if (!g.__mockPortfolioState) g.__mockPortfolioState = {};
  return g.__mockPortfolioState;
}

const mileageStore: PortfolioMileageItem[] = mockPortfolioMileage.map(m => ({
  ...m,
}));
let nextMileageId = Math.max(0, ...mileageStore.map(m => m.id)) + 1;

const cvStore: PortfolioCvDetail[] = mockPortfolioCvDetails.map(c => ({ ...c }));
let nextCvId = Math.max(0, ...cvStore.map(c => c.id)) + 1;

/** 공개 포폴 share HTML API — 403/404 시 내려주는 안내 HTML (목) */
const CV_SHARE_HTML_404 = `<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>안내</title><style>body{font-family:system-ui,-apple-system,sans-serif;margin:0;padding:2rem;max-width:36rem;line-height:1.65;color:#1a1a1a;background:#fafafa}</style></head><body><h1 style="font-size:1.2rem;margin:0 0 0.75rem">이력서를 찾을 수 없습니다</h1><p style="margin:0;color:#555">형식이 올바르지 않습니다. 링크를 다시 확인해 주세요.</p></body></html>`;

const CV_SHARE_HTML_403 = `<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>안내</title><style>body{font-family:system-ui,-apple-system,sans-serif;margin:0;padding:2rem;max-width:36rem;line-height:1.65;color:#1a1a1a;background:#fafafa}</style></head><body><h1 style="font-size:1.2rem;margin:0 0 0.75rem">비공개 이력서입니다</h1><p style="margin:0;color:#555">작성자가 아직 공개로 설정하지 않았습니다. 필요하면 작성자에게 공개 요청을 해 주세요.</p></body></html>`;

const CV_PUBLIC_TOKEN_REGEX = /^\d{8,12}$/;

function buildPortfolioMileageItem(
  id: number,
  displayOrder: number,
  putItem: PutPortfolioMileageItem,
): PortfolioMileageItem | null {
  const ref = mockMileageList.find(
    m => (m.mileage_id ?? m.subitemId) === putItem.mileage_id,
  );
  if (!ref) return null;
  return {
    id,
    mileage_id: putItem.mileage_id,
    additional_info: putItem.additional_info ?? '',
    display_order: displayOrder,
    subitemId: ref.subitemId,
    subitemName: ref.subitemName,
    categoryId: ref.categoryId,
    categoryName: ref.categoryName,
    semester: ref.semester,
    description1: ref.description1 ?? '',
  };
}

/** 401/500 랜덤 반환 없이 항상 성공. (개발 시 불필요한 로그아웃·passthrough 방지) */
export const PortfolioHandlers = [
  http.get(BASE_URL + ENDPOINT.PORTFOLIO_TECH_STACK, () => {
    return HttpResponse.json(
      {
        domains: techStackStore.domains.map(d => ({
          ...d,
          tech_stacks: d.tech_stacks.map(t => ({ ...t })),
        })),
      },
      { status: 200 },
    );
  }),

  http.put(BASE_URL + ENDPOINT.PORTFOLIO_TECH_STACK, async ({ request }) => {
    const body = (await request.json()) as TechStackPutRequest;
    const raw = body.domains ?? [];
    const cleaned = raw
      .map(d => ({
        name: (d.name ?? '').trim(),
        tech_stacks: (d.tech_stacks ?? [])
          .map(t => ({
            name: (t.name ?? '').trim(),
            level: clampTechLevel(t.level ?? 0),
          }))
          .filter(t => t.name !== ''),
      }))
      .filter(d => d.name !== '');

    techStackStore.domains = cleaned.map((d, i) => ({
      id: i + 1,
      name: d.name,
      order_index: i,
      tech_stacks: d.tech_stacks,
    }));

    return HttpResponse.json(
      {
        domains: techStackStore.domains.map(d => ({
          ...d,
          tech_stacks: d.tech_stacks.map(t => ({ ...t })),
        })),
      },
      { status: 200 },
    );
  }),

  http.get(BASE_URL + ENDPOINT.PORTFOLIO_ACTIVITIES, ({ request }) => {
    const url = new URL(request.url);
    const categoryParams = url.searchParams.getAll('category');
    let list = [...activitiesStore];
    if (categoryParams.length > 0) {
      list = list.filter(a => categoryParams.includes(String(a.category)));
    }
    const sorted = list.sort((a, b) => a.display_order - b.display_order);
    return HttpResponse.json({ activities: sorted }, { status: 200 });
  }),

  http.post(BASE_URL + ENDPOINT.PORTFOLIO_ACTIVITIES, async ({ request }) => {
    const body = (await request.json()) as {
      title: string;
      description: string;
      start_date: string;
      end_date: string;
      category?: string;
      url?: string;
      tags?: string[];
    };
    const newItem: ActivityApiItem = {
      id: nextActivityId++,
      title: body.title ?? '',
      description: body.description ?? '',
      start_date: body.start_date ?? '',
      end_date: body.end_date ?? '',
      category: (body.category ?? '').trim() || '기타',
      display_order: activitiesStore.length,
      url: (body.url ?? '').trim(),
      tags: Array.isArray(body.tags)
        ? body.tags.map(t => String(t).trim()).filter(Boolean)
        : [],
    };
    activitiesStore.push(newItem);
    return HttpResponse.json(newItem, { status: 200 });
  }),

  http.patch(BASE_URL + ENDPOINT.PORTFOLIO_ACTIVITIES, async ({ request }) => {
    const body = (await request.json()) as Array<{
      id: number;
      title: string;
      description: string;
      start_date: string;
      end_date: string;
      category?: string;
      url?: string;
      tags?: string[];
    }>;
    if (!Array.isArray(body)) {
      return HttpResponse.json({ activities: activitiesStore }, { status: 200 });
    }
    for (const item of body) {
      const idx = activitiesStore.findIndex(a => a.id === item.id);
      if (idx !== -1) {
        activitiesStore[idx] = {
          ...activitiesStore[idx],
          title: item.title ?? activitiesStore[idx].title,
          description: item.description ?? activitiesStore[idx].description,
          start_date: item.start_date ?? activitiesStore[idx].start_date,
          end_date: item.end_date ?? activitiesStore[idx].end_date,
          category:
            item.category != null && item.category !== ''
              ? item.category
              : activitiesStore[idx].category,
          url:
            item.url !== undefined ? item.url : activitiesStore[idx].url ?? '',
          tags:
            item.tags !== undefined
              ? item.tags.map(t => String(t).trim()).filter(Boolean)
              : activitiesStore[idx].tags ?? [],
        };
      }
    }
    const sorted = [...activitiesStore].sort(
      (a, b) => a.display_order - b.display_order,
    );
    return HttpResponse.json({ activities: sorted }, { status: 200 });
  }),

  http.put(
    BASE_URL + `${ENDPOINT.PORTFOLIO_ACTIVITIES}/:id`,
    async ({ params, request }) => {
      const id = Number(params.id);
      const body = (await request.json()) as {
        title: string;
        description: string;
        start_date: string;
        end_date: string;
        category: string;
        url: string;
        tags: string[];
      };
      const idx = activitiesStore.findIndex(a => a.id === id);
      if (idx === -1) {
        return HttpResponse.json({}, { status: 404 });
      }
      const prev = activitiesStore[idx];
      activitiesStore[idx] = {
        ...prev,
        title: body.title ?? '',
        description: body.description ?? '',
        start_date: body.start_date ?? '',
        end_date: body.end_date ?? '',
        category: (body.category ?? '').trim() || '기타',
        url: (body.url ?? '').trim(),
        tags: Array.isArray(body.tags)
          ? body.tags.map(t => String(t).trim()).filter(Boolean)
          : [],
      };
      return HttpResponse.json(activitiesStore[idx], { status: 200 });
    },
  ),

  http.patch(
    BASE_URL + `${ENDPOINT.PORTFOLIO_ACTIVITIES}/:id`,
    async ({ params, request }) => {
      const id = Number(params.id);
      const body = (await request.json()) as {
        title?: string;
        description?: string;
        start_date?: string;
        end_date?: string;
        category?: string;
        url?: string | null;
        tags?: string[] | null;
      };
      const idx = activitiesStore.findIndex(a => a.id === id);
      if (idx === -1) {
        return HttpResponse.json({}, { status: 404 });
      }
      const cur = activitiesStore[idx];
      activitiesStore[idx] = {
        ...cur,
        title: body.title ?? cur.title,
        description: body.description ?? cur.description,
        start_date: body.start_date ?? cur.start_date,
        end_date: body.end_date ?? cur.end_date,
        category:
          body.category != null && body.category !== ''
            ? body.category
            : cur.category,
        url:
          body.url !== undefined && body.url !== null
            ? body.url
            : cur.url ?? '',
        tags:
          body.tags !== undefined && body.tags !== null
            ? body.tags.map(t => String(t).trim()).filter(Boolean)
            : cur.tags ?? [],
      };
      return HttpResponse.json(activitiesStore[idx], { status: 200 });
    },
  ),

  http.delete(
    BASE_URL + `${ENDPOINT.PORTFOLIO_ACTIVITIES}/:id`,
    ({ params }) => {
      const id = Number(params.id);
      const idx = activitiesStore.findIndex(a => a.id === id);
      if (idx === -1) {
        return HttpResponse.json({}, { status: 404 });
      }
      activitiesStore.splice(idx, 1);
      return HttpResponse.json({}, { status: 200 });
    },
  ),

  http.get(BASE_URL + ENDPOINT.PORTFOLIO_USER_INFO, () => {
    return HttpResponse.json({ ...userInfoStore }, { status: 200 });
  }),

  http.put(BASE_URL + ENDPOINT.PORTFOLIO_USER_INFO_IMAGE, async ({ request }) => {
    try {
      const formData = await request.formData();
      const profileImage = formData.get('profile_image');
      if (profileImage instanceof File && profileImage.name) {
        userInfoStore.profile_image_url = profileImage.name;
      }
    } catch {
      // ignore
    }
    return HttpResponse.json({ ...userInfoStore }, { status: 200 });
  }),

  http.get(
    BASE_URL + `${ENDPOINT.PORTFOLIO_USER_INFO_IMAGE}/:filename`,
    () => {
      const minimalPng = Uint8Array.from(
        atob(
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
        ),
        c => c.charCodeAt(0),
      );
      return new HttpResponse(new Blob([minimalPng], { type: 'image/png' }), {
        status: 200,
        headers: { 'Content-Type': 'image/png' },
      });
    },
  ),

  http.patch(BASE_URL + ENDPOINT.PORTFOLIO_USER_INFO, async ({ request }) => {
    try {
      const body = (await request.json()) as UserInfoPatchRequest;
      if (body.bio !== undefined) {
        userInfoStore.bio = body.bio;
      }
      if (body.profile_image_url !== undefined) {
        userInfoStore.profile_image_url = body.profile_image_url;
      }
      if (body.profile_links !== undefined) {
        userInfoStore.profile_links = Array.isArray(body.profile_links)
          ? body.profile_links.map(l => ({
              label: String(l.label ?? ''),
              url: String(l.url ?? ''),
            }))
          : [];
      }
    } catch {
      // ignore json parse
    }
    return HttpResponse.json({ ...userInfoStore }, { status: 200 });
  }),

  http.get(BASE_URL + ENDPOINT.PORTFOLIO_CV, () => {
    return HttpResponse.json(
      {
        cvs: cvStore.map(c => ({
          id: c.id,
          title: c.title,
          job_posting: c.job_posting,
          target_position: c.target_position,
          additional_notes: c.additional_notes,
          design_preferences: c.design_preferences,
          mode: c.mode,
          public_token: c.public_token,
          created_at: c.created_at,
          updated_at: c.updated_at,
          is_public: c.is_public,
        })),
      },
      { status: 200 },
    );
  }),

  http.get(BASE_URL + `${ENDPOINT.PORTFOLIO_CV}/:id`, ({ params }) => {
    const id = Number(params.id);
    const item = cvStore.find(c => c.id === id);
    if (!item || Number.isNaN(id)) {
      return new HttpResponse(null, { status: 404 });
    }
    return HttpResponse.json({ ...item }, { status: 200 });
  }),

  http.get(
    `${BASE_URL}${ENDPOINT.PORTFOLIO_CV_SHARE}/:publicToken/html`,
    ({ params }) => {
      const token = decodeURIComponent(String(params.publicToken ?? '')).trim();
      if (!CV_PUBLIC_TOKEN_REGEX.test(token)) {
        return new HttpResponse(CV_SHARE_HTML_404, {
          status: 404,
          headers: { 'Content-Type': 'text/html; charset=UTF-8' },
        });
      }
      const item = cvStore.find(c => c.public_token === token);
      if (!item) {
        return new HttpResponse(CV_SHARE_HTML_404, {
          status: 404,
          headers: { 'Content-Type': 'text/html; charset=UTF-8' },
        });
      }
      if (!item.is_public) {
        return new HttpResponse(CV_SHARE_HTML_403, {
          status: 403,
          headers: { 'Content-Type': 'text/html; charset=UTF-8' },
        });
      }
      if (!item.html_content?.trim()) {
        return new HttpResponse(null, { status: 204 });
      }
      return new HttpResponse(item.html_content, {
        status: 200,
        headers: { 'Content-Type': 'text/html; charset=UTF-8' },
      });
    },
  ),

  http.patch(BASE_URL + `${ENDPOINT.PORTFOLIO_CV}/:id`, async ({ params, request }) => {
    const id = Number(params.id);
    const idx = cvStore.findIndex(c => c.id === id);
    if (idx === -1 || Number.isNaN(id)) {
      return new HttpResponse(null, { status: 404 });
    }
    try {
      const body = (await request.json()) as {
        title?: string;
        html_content?: string;
        is_public?: boolean;
      };
      const now = new Date().toISOString();
      const prev = cvStore[idx];
      const next: PortfolioCvDetail = {
        ...prev,
        title:
          body.title != null && String(body.title).trim() !== ''
            ? String(body.title).trim()
            : prev.title,
        html_content:
          body.html_content !== undefined ? String(body.html_content) : prev.html_content,
        is_public: body.is_public !== undefined ? Boolean(body.is_public) : prev.is_public,
        updated_at: now,
      };
      cvStore[idx] = next;
      return HttpResponse.json({ ...next }, { status: 200 });
    } catch {
      return new HttpResponse(null, { status: 400 });
    }
  }),

  http.post(
    BASE_URL + `${ENDPOINT.PORTFOLIO_CV}/:id/generate-html`,
    async ({ params, request }) => {
      const id = Number(params.id);
      const idx = cvStore.findIndex(c => c.id === id);
      if (idx === -1 || Number.isNaN(id)) {
        return new HttpResponse(null, { status: 404 });
      }
      try {
        const raw = (await request.json()) as {
          design_preferences?: PortfolioCvDesignPreferences | null;
        };
        const rawDp = raw.design_preferences;
        const design_preferences: PortfolioCvDesignPreferences =
          rawDp != null && typeof rawDp === 'object'
            ? {
                layout: String(rawDp.layout ?? ''),
                color_theme: String(rawDp.color_theme ?? ''),
                density: String(rawDp.density ?? ''),
                additional_notes: String(rawDp.additional_notes ?? ''),
              }
            : {
                layout: '',
                color_theme: '',
                density: '',
                additional_notes: '',
              };
        const prev = cvStore[idx];
        const now = new Date().toISOString();
        const promptSuffix = [
          '',
          '---',
          '## generate-html (Mock)',
          `- layout: ${design_preferences.layout || '(없음)'}`,
          `- color_theme: ${design_preferences.color_theme || '(없음)'}`,
          `- density: ${design_preferences.density || '(없음)'}`,
          design_preferences.additional_notes.trim()
            ? `- 추가: ${design_preferences.additional_notes.trim().slice(0, 200)}`
            : '',
        ]
          .filter(Boolean)
          .join('\n');
        const next: PortfolioCvDetail = {
          ...prev,
          design_preferences,
          prompt: `${prev.prompt.trim()}\n${promptSuffix}`,
          html_content:
            '<!DOCTYPE html><html lang="ko"><head><meta charset="utf-8"/><title>Mock CV</title></head><body><main><p>Mock <code>generate-html</code> 응답 HTML입니다. 레이아웃: ' +
            (design_preferences.layout || '-') +
            '</p></main></body></html>',
          model_used: 'gpt-4o-mini (mock)',
          tokens_used: 1280,
          last_generated_at: now,
          updated_at: now,
        };
        cvStore[idx] = next;
        return HttpResponse.json({ ...next }, { status: 200 });
      } catch {
        return new HttpResponse(null, { status: 400 });
      }
    },
  ),

  http.delete(BASE_URL + `${ENDPOINT.PORTFOLIO_CV}/:id`, ({ params }) => {
    const id = Number(params.id);
    const idx = cvStore.findIndex(c => c.id === id);
    if (idx === -1 || Number.isNaN(id)) {
      return new HttpResponse(null, { status: 404 });
    }
    cvStore.splice(idx, 1);
    return new HttpResponse(null, { status: 200 });
  }),

  http.post(BASE_URL + `${ENDPOINT.PORTFOLIO_CV}/build-prompt`, async ({ request }) => {
    try {
      const body = (await request.json()) as PortfolioCvBuildPromptRequest;
      const rawMode = body.mode;
      if (rawMode != null && rawMode !== 'cv' && rawMode !== 'archive') {
        return new HttpResponse(null, { status: 400 });
      }
      const mode: 'cv' | 'archive' = rawMode === 'archive' ? 'archive' : 'cv';
      const title = (body.title ?? '').trim();
      const job = (body.job_posting ?? '').trim();
      const pos = (body.target_position ?? '').trim();
      const notes = (body.additional_notes ?? '').trim();
      const m = body.selected_mileage_ids ?? [];
      const a = body.selected_activity_ids ?? [];
      const r = body.selected_repo_ids ?? [];
      const rawDp = body.design_preferences;
      const hasDesignPrefsObject = rawDp != null && typeof rawDp === 'object';
      const storedDesignPreferences: PortfolioCvDetail['design_preferences'] =
        hasDesignPrefsObject
          ? {
              layout: String((rawDp as { layout?: unknown }).layout ?? ''),
              color_theme: String((rawDp as { color_theme?: unknown }).color_theme ?? ''),
              density: String((rawDp as { density?: unknown }).density ?? ''),
              additional_notes: String(
                (rawDp as { additional_notes?: unknown }).additional_notes ?? '',
              ),
            }
          : {
              layout: '',
              color_theme: '',
              density: '',
              additional_notes: '',
            };
      const designPrefLines: string[] = [];
      if (hasDesignPrefsObject) {
        const d = storedDesignPreferences;
        if (d.layout.trim()) designPrefLines.push(`- 레이아웃: ${d.layout.trim()}`);
        if (d.color_theme.trim()) designPrefLines.push(`- 색상 테마: ${d.color_theme.trim()}`);
        if (d.density.trim()) designPrefLines.push(`- 분량·밀도: ${d.density.trim()}`);
        if (d.additional_notes.trim()) {
          designPrefLines.push(`- 추가 메모: ${d.additional_notes.trim()}`);
        }
      }
      const designPrefBlock =
        designPrefLines.length > 0
          ? ['', '## [design_preferences] (Mock)', ...designPrefLines, ''].join('\n')
          : '';
      const prompt = [
        '# 맞춤 CV 프롬프트 (Mock)',
        '',
        `## mode: ${mode}`,
        '',
        '## 제목',
        title || '(미입력)',
        '',
        '## 지원 직무',
        pos || '(미입력)',
        '',
        '## 공고·자격 요약',
        job ? job.slice(0, 600) + (job.length > 600 ? '…' : '') : '(미입력)',
        '',
        notes ? `## 추가 요청\n${notes}\n` : '',
        designPrefBlock,
        '## 포함한 포트폴리오 항목 (선택 ID)',
        `- 마일리지: ${JSON.stringify(m)}`,
        `- 활동: ${JSON.stringify(a)}`,
        `- 레포지토리: ${JSON.stringify(r)}`,
        '',
        '_이 내용은 목(Mock) 응답입니다._',
      ]
        .filter(Boolean)
        .join('\n');
      const cvId = nextCvId++;
      const public_token = String(9_000_000_000 + cvId);
      const now = new Date().toISOString();
      cvStore.push({
        id: cvId,
        title: title || '무제',
        job_posting: job,
        target_position: pos,
        additional_notes: notes,
        design_preferences: storedDesignPreferences,
        mode,
        prompt,
        html_content: '',
        public_token,
        is_public: false,
        created_at: now,
        updated_at: now,
        selected_repo_ids: [...r],
        selected_mileage_ids: [...m],
        selected_activity_ids: [...a],
      });
      return HttpResponse.json({ prompt, cv_id: cvId, public_token }, { status: 200 });
    } catch {
      return new HttpResponse(null, { status: 400 });
    }
  }),

  http.post(
    BASE_URL + ENDPOINT.PORTFOLIO_REPOSITORIES_GITHUB_CACHE_REFRESH,
    () => {
      const body: GithubRepositoriesCacheRefreshResponse = {
        reposSynced: repositoriesStore.length,
      };
      return HttpResponse.json(body, { status: 200 });
    },
  ),

  http.get(BASE_URL + ENDPOINT.PORTFOLIO_REPOSITORIES, ({ request }) => {
    const url = new URL(request.url);
    const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10));
    const perPage = Math.min(
      100,
      Math.max(1, parseInt(url.searchParams.get('per_page') ?? '20', 10)),
    );
    const visibleOnly =
      url.searchParams.get('visible_only') === 'true' ? true : undefined;
    const ownerParam = url.searchParams.get('owner');
    const searchParam = url.searchParams.get('search');

    const resetSelection = Boolean(getMockPortfolioState().repoSelectionReset);
    let list = resetSelection
      ? repositoriesStore.map(r => ({ ...r, is_visible: false }))
      : [...repositoriesStore];

    if (visibleOnly) {
      list = list.filter(r => r.is_visible);
    }
    if (ownerParam != null && ownerParam.trim() !== '') {
      list = list.filter(r => r.owner === ownerParam.trim());
    }

    list = list.filter(r => mockRepositoryMatchesSearch(r, searchParam));

    // 백엔드 스펙: visible_only=true면 페이지네이션 무시하고 전부 반환
    if (visibleOnly) {
      return HttpResponse.json(
        { repositories: list, total: list.length },
        { status: 200 },
      );
    }

    const start = (page - 1) * perPage;
    const slice = list.slice(start, start + perPage);
    return HttpResponse.json(
      { repositories: slice, total: list.length },
      { status: 200 },
    );
  }),

  http.put(BASE_URL + ENDPOINT.PORTFOLIO_REPOSITORIES, async ({ request }) => {
    const body = (await request.json()) as PutRepositoryItem[];
    getMockPortfolioState().repoSelectionReset = false;
    const byRepoId = new Map(repositoriesStore.map(r => [r.repo_id, r]));
    const warnings: string[] = [];
    const skipped: string[] = [];
    repositoriesStore.length = 0;
    body.forEach((item, index) => {
      const existing = byRepoId.get(item.repo_id);
      if (!existing) {
        skipped.push(`repo_id=${item.repo_id} (캐시에 없음)`);
      }
      repositoriesStore.push({
        id: existing?.id ?? nextRepoId++,
        repo_id: item.repo_id,
        custom_title: item.custom_title ?? null,
        description: item.description ?? '',
        github_description: existing?.github_description ?? '',
        is_visible: item.is_visible ?? true,
        display_order: index,
        github_title: existing?.github_title ?? '',
        html_url: existing?.html_url ?? '',
        language: existing?.language ?? '',
        languages: existing?.languages ?? [],
        created_at: existing?.created_at ?? '',
        updated_at: existing?.updated_at ?? '',
        visibility: existing?.visibility ?? 'public',
        owner: existing?.owner ?? 'user',
        commit_count: existing?.commit_count ?? 0,
        stargazers_count: existing?.stargazers_count ?? 0,
        forks_count: existing?.forks_count ?? 0,
        team_composition: existing?.team_composition ?? [],
        my_role: existing?.my_role ?? null,
        key_contributions: existing?.key_contributions ?? null,
        duration:
          existing?.duration ??
          ({
            started_at_github: existing?.created_at ?? '',
            updated_at_github: existing?.updated_at ?? '',
            started_at: '',
            updated_at: '',
          } as PortfolioRepositoryItem['duration']),
      });
    });
    if (repositoriesStore.length > 0) {
      nextRepoId =
        Math.max(...repositoriesStore.map(r => r.id), nextRepoId) + 1;
    }
    if (skipped.length > 0) {
      warnings.push('일부 레포는 동기화에서 제외되었습니다.');
    }
    return HttpResponse.json({ warnings, skipped }, { status: 200 });
  }),

  http.patch(
    BASE_URL + `${ENDPOINT.PORTFOLIO_REPOSITORIES}/:id`,
    async ({ params, request }) => {
      const id = Number(params.id);
      const body = (await request.json()) as PatchRepositoryBody;
      const idx = repositoriesStore.findIndex(r => r.id === id);
      if (idx === -1) {
        return HttpResponse.json({}, { status: 404 });
      }
      const prev = repositoriesStore[idx];

      const baseDuration =
        prev.duration ??
        ({
          started_at_github: prev.created_at,
          updated_at_github: prev.updated_at,
        } as NonNullable<PortfolioRepositoryItem['duration']>);

      let nextDuration: NonNullable<PortfolioRepositoryItem['duration']> = {
        ...baseDuration,
      };

      if (body.duration !== undefined && body.duration !== null) {
        const d = body.duration;
        nextDuration = { ...nextDuration };
        if (d.started_at !== undefined) {
          if (d.started_at === '' || d.started_at === null) {
            delete nextDuration.started_at;
          } else {
            nextDuration.started_at = d.started_at;
          }
        }
        if (d.updated_at !== undefined) {
          if (d.updated_at === '' || d.updated_at === null) {
            delete nextDuration.updated_at;
          } else {
            nextDuration.updated_at = d.updated_at;
          }
        }
        const sa = nextDuration.started_at;
        const ua = nextDuration.updated_at;
        if (
          sa &&
          ua &&
          !Number.isNaN(Date.parse(sa)) &&
          !Number.isNaN(Date.parse(ua)) &&
          new Date(sa).getTime() > new Date(ua).getTime()
        ) {
          return HttpResponse.json(
            { message: 'started_at must be <= updated_at' },
            { status: 400 },
          );
        }
      }

      repositoriesStore[idx] = {
        ...prev,
        custom_title:
          body.custom_title !== undefined ? body.custom_title : prev.custom_title,
        description:
          body.description !== undefined ? body.description ?? '' : prev.description,
        github_description: prev.github_description ?? '',
        is_visible:
          body.is_visible !== undefined ? body.is_visible : prev.is_visible,
        display_order:
          body.display_order !== undefined
            ? body.display_order
            : prev.display_order,
        team_composition:
          body.team_composition !== undefined
            ? body.team_composition ?? []
            : prev.team_composition,
        my_role: body.my_role !== undefined ? body.my_role : prev.my_role,
        key_contributions:
          body.key_contributions !== undefined
            ? body.key_contributions
            : prev.key_contributions,
        duration:
          body.duration !== undefined ? nextDuration : prev.duration,
      };
      return HttpResponse.json(repositoriesStore[idx], { status: 200 });
    },
  ),

  http.get(BASE_URL + ENDPOINT.PORTFOLIO_MILEAGE, () => {
    const sorted = [...mileageStore].sort(
      (a, b) => a.display_order - b.display_order,
    );
    return HttpResponse.json({ mileage: sorted }, { status: 200 });
  }),

  http.put(BASE_URL + ENDPOINT.PORTFOLIO_MILEAGE, async ({ request }) => {
    const body = (await request.json()) as PutPortfolioMileageItem[];
    mileageStore.length = 0;
    body.forEach((item, index) => {
      const built = buildPortfolioMileageItem(nextMileageId++, index, item);
      if (built) mileageStore.push(built);
    });
    const sorted = [...mileageStore].sort(
      (a, b) => a.display_order - b.display_order,
    );
    return HttpResponse.json({ mileage: sorted }, { status: 200 });
  }),

  http.put(
    BASE_URL + `${ENDPOINT.PORTFOLIO_MILEAGE}/:id`,
    async ({ params, request }) => {
      const id = Number(params.id);
      const body = (await request.json()) as { additional_info?: string };
      const idx = mileageStore.findIndex(m => m.id === id);
      if (idx === -1) {
        return HttpResponse.json({}, { status: 404 });
      }
      if (body.additional_info !== undefined) {
        mileageStore[idx] = {
          ...mileageStore[idx],
          additional_info: body.additional_info,
        };
      }
      return HttpResponse.json(mileageStore[idx], { status: 200 });
    },
  ),
];
