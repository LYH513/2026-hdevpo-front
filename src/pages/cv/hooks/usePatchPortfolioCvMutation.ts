import { QUERY_KEYS } from '@/constants/queryKeys';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import {
  patchPortfolioCv,
  type PortfolioCvDetail,
  type PortfolioCvListItem,
  type PortfolioCvListResponse,
  type PortfolioCvPatchRequest,
} from '../apis/cv';

/** 배포 API가 본문 없음 / id 문자열 / isPublic(camelCase) / { data: {...} } 등으로 줄 때 대비 */
function unwrapPatchBody(raw: unknown): unknown {
  if (raw == null || typeof raw !== 'object') return raw;
  const o = raw as Record<string, unknown>;
  if (o.data != null && typeof o.data === 'object' && !Array.isArray(o.data)) {
    return o.data;
  }
  return raw;
}

function coerceRecordId(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v))) {
    return Number(v);
  }
  return null;
}

function hasOwnKey(o: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(o, key);
}

function coerceBoolean(v: unknown): boolean | undefined {
  if (v === undefined || v === null) return undefined;
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v !== 0;
  if (typeof v === 'string') {
    const s = v.trim().toLowerCase();
    if (s === 'true' || s === '1') return true;
    if (s === 'false' || s === '0') return false;
  }
  return Boolean(v);
}

/** 응답에 실제로 포함된 필드만 병합 (부분 PATCH 시 is_favorite 누락 → false 덮어쓰기 방지) */
function mergeDetailFromPatchResponse(
  prev: PortfolioCvDetail,
  raw: unknown,
): Partial<PortfolioCvDetail> {
  const unwrapped = unwrapPatchBody(raw);
  if (unwrapped == null || typeof unwrapped !== 'object') return {};
  const o = unwrapped as Record<string, unknown>;
  const patch: Partial<PortfolioCvDetail> = {};

  const rid = coerceRecordId(o.id);
  if (rid != null && rid !== prev.id) return {};

  if (hasOwnKey(o, 'is_public') || hasOwnKey(o, '_public') || hasOwnKey(o, 'isPublic')) {
    const pub = o.is_public ?? o._public ?? o.isPublic;
    const isPublic = coerceBoolean(pub);
    if (isPublic !== undefined) patch.is_public = isPublic;
  }

  if (
    hasOwnKey(o, 'is_favorite') ||
    hasOwnKey(o, 'isFavorite') ||
    hasOwnKey(o, '_favorite')
  ) {
    const fav = o.is_favorite ?? o.isFavorite ?? o._favorite;
    const isFavorite = coerceBoolean(fav);
    if (isFavorite !== undefined) patch.is_favorite = isFavorite;
  }

  const str = (a: unknown, b?: unknown) =>
    (typeof a === 'string' ? a : typeof b === 'string' ? b : undefined) as
      | string
      | undefined;

  const t = str(o.title);
  if (t !== undefined) patch.title = t;
  const jp = str(o.job_posting, o.jobPosting);
  if (jp !== undefined) patch.job_posting = jp;
  const tp = str(o.target_position, o.targetPosition);
  if (tp !== undefined) patch.target_position = tp;
  const an = str(o.additional_notes, o.additionalNotes);
  if (an !== undefined) patch.additional_notes = an;
  const pt = str(o.public_token, o.publicToken);
  if (pt !== undefined) patch.public_token = pt;
  const ca = str(o.created_at, o.createdAt);
  if (ca !== undefined) patch.created_at = ca;
  const ua = str(o.updated_at, o.updatedAt);
  if (ua !== undefined) patch.updated_at = ua;
  const pr = str(o.prompt);
  if (pr !== undefined) patch.prompt = pr;
  const html = str(o.html_content, o.htmlContent);
  if (html !== undefined) patch.html_content = html;

  if (o.mode !== undefined) {
    patch.mode = String(o.mode);
  }

  if (o.design_preferences != null && typeof o.design_preferences === 'object') {
    const d = o.design_preferences as Record<string, unknown>;
    patch.design_preferences = {
      layout:
        d.layout !== undefined ? String(d.layout) : prev.design_preferences.layout,
      color_theme:
        d.color_theme !== undefined
          ? String(d.color_theme)
          : prev.design_preferences.color_theme,
      density:
        d.density !== undefined ? String(d.density) : prev.design_preferences.density,
      additional_notes:
        d.additional_notes !== undefined
          ? String(d.additional_notes)
          : prev.design_preferences.additional_notes,
    };
  }

  const readIdArray = (rawIds: unknown): number[] => {
    if (!Array.isArray(rawIds)) return [];
    const out: number[] = [];
    for (const x of rawIds) {
      if (typeof x === 'number' && Number.isFinite(x)) out.push(x);
      else if (typeof x === 'string' && x.trim() !== '' && !Number.isNaN(Number(x))) {
        out.push(Number(x));
      }
    }
    return out;
  };
  if (o.selected_repo_ids !== undefined) {
    patch.selected_repo_ids = readIdArray(o.selected_repo_ids);
  }
  if (o.selected_mileage_ids !== undefined) {
    patch.selected_mileage_ids = readIdArray(o.selected_mileage_ids);
  }
  if (o.selected_activity_ids !== undefined) {
    patch.selected_activity_ids = readIdArray(o.selected_activity_ids);
  }

  if (o.model_used != null) {
    const s = String(o.model_used).trim();
    if (s) patch.model_used = s;
  }
  if (typeof o.tokens_used === 'number' && Number.isFinite(o.tokens_used)) {
    patch.tokens_used = o.tokens_used;
  } else if (typeof o.tokens_used === 'string' && o.tokens_used.trim() !== '') {
    const n = Number(o.tokens_used);
    if (!Number.isNaN(n)) patch.tokens_used = n;
  }
  const lga = str(o.last_generated_at, o.lastGeneratedAt);
  if (lga !== undefined) patch.last_generated_at = lga;

  return patch;
}

function applyListPatchFromBody(
  item: PortfolioCvListItem,
  body: PortfolioCvPatchRequest,
  fromResponse: Partial<PortfolioCvDetail>,
): PortfolioCvListItem {
  let next: PortfolioCvListItem = { ...item };

  const {
    is_public: respPublic,
    is_favorite: respFavorite,
    title: respTitle,
    ...rest
  } = fromResponse;

  if (Object.keys(rest).length > 0) {
    next = { ...next, ...rest, id: next.id };
  }

  if (body.title !== undefined) {
    next.title = body.title;
  } else if (respTitle !== undefined) {
    next.title = respTitle;
  }

  if (body.is_public !== undefined) {
    next.is_public = Boolean(body.is_public);
  } else if (respPublic !== undefined) {
    next.is_public = respPublic;
  }

  if (body.is_favorite !== undefined) {
    next.is_favorite = Boolean(body.is_favorite);
  } else if (respFavorite !== undefined) {
    next.is_favorite = respFavorite;
  }

  return next;
}

function applyDetailPatchFromBody(
  detail: PortfolioCvDetail,
  body: PortfolioCvPatchRequest,
  fromResponse: Partial<PortfolioCvDetail>,
): PortfolioCvDetail {
  let next: PortfolioCvDetail = { ...detail };

  const {
    is_public: respPublic,
    is_favorite: respFavorite,
    title: respTitle,
    html_content: respHtml,
    ...rest
  } = fromResponse;

  if (Object.keys(rest).length > 0) {
    next = { ...next, ...rest };
  }

  if (body.title !== undefined) {
    next.title = body.title;
  } else if (respTitle !== undefined) {
    next.title = respTitle;
  }

  if (body.html_content !== undefined) {
    next.html_content = body.html_content;
  } else if (respHtml !== undefined) {
    next.html_content = respHtml;
  }

  if (body.is_public !== undefined) {
    next.is_public = Boolean(body.is_public);
  } else if (respPublic !== undefined) {
    next.is_public = respPublic;
  }

  if (body.is_favorite !== undefined) {
    next.is_favorite = Boolean(body.is_favorite);
  } else if (respFavorite !== undefined) {
    next.is_favorite = respFavorite;
  }

  return next;
}

const usePatchPortfolioCvMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: PortfolioCvPatchRequest }) =>
      patchPortfolioCv(id, body),
    onSuccess: (rawUpdated, { id, body }) => {
      const fromResponse = mergeDetailFromPatchResponse(
        {
          id,
          title: '',
          job_posting: '',
          target_position: '',
          additional_notes: '',
          design_preferences: {
            layout: '',
            color_theme: '',
            density: '',
            additional_notes: '',
          },
          mode: 'cv',
          public_token: '',
          created_at: '',
          updated_at: '',
          is_public: false,
          is_favorite: false,
          prompt: '',
          html_content: '',
          selected_repo_ids: [],
          selected_mileage_ids: [],
          selected_activity_ids: [],
        },
        rawUpdated,
      );

      const responseLooksEmpty =
        rawUpdated == null ||
        (typeof rawUpdated === 'object' &&
          rawUpdated !== null &&
          Object.keys(rawUpdated as object).length === 0);

      queryClient.setQueriesData<PortfolioCvListResponse>(
        { queryKey: [QUERY_KEYS.portfolioCv, 'list'] },
        old => {
          if (!old?.cvs) return old;
          return {
            ...old,
            cvs: old.cvs.map(c =>
              c.id !== id
                ? c
                : applyListPatchFromBody(c, body, fromResponse),
            ),
          };
        },
      );

      queryClient.setQueryData<PortfolioCvDetail | undefined>(
        [QUERY_KEYS.portfolioCv, 'detail', id],
        old => {
          if (!old || old.id !== id) return old;
          return applyDetailPatchFromBody(old, body, fromResponse);
        },
      );

      if (
        responseLooksEmpty &&
        body.is_public === undefined &&
        body.is_favorite === undefined &&
        body.title === undefined &&
        body.html_content === undefined
      ) {
        void queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.portfolioCv] });
        return;
      }

      void queryClient.invalidateQueries({
        queryKey: [QUERY_KEYS.portfolioCv],
        refetchType: 'none',
      });
    },
  });
};

export default usePatchPortfolioCvMutation;
