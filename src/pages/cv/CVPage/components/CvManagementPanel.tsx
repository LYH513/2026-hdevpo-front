import { Button, Flex, Heading, Text, ToggleButton } from '@/components';
import { QUERY_KEYS } from '@/constants/queryKeys';
import { MAX_RESPONSIVE_WIDTH } from '@/constants/system';
import { boxShadow } from '@/styles/common';
import { palette } from '@/styles/palette';
import AddIcon from '@mui/icons-material/Add';
import VerticalSplitOutlinedIcon from '@mui/icons-material/VerticalSplitOutlined';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import StarIcon from '@mui/icons-material/Star';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import WorkOutlineIcon from '@mui/icons-material/WorkOutline';
import { Dialog, DialogContent, LinearProgress, useMediaQuery } from '@mui/material';
import { styled } from '@mui/material/styles';
import { useQuery } from '@tanstack/react-query';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FunctionComponent,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type SVGProps,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';

import { openCvShareInNewTab, ROUTE_PATH } from '@/constants/routePath';

import { formatDateTime } from '@/pages/portfolio/utils/date';
import {
  getPortfolioCvById,
  getPortfolioCvList,
  type PortfolioCvListItem,
  type PortfolioCvListSort,
} from '../../apis/cv';
import useDeletePortfolioCvMutation from '../../hooks/useDeletePortfolioCvMutation';
import usePatchPortfolioCvMutation from '../../hooks/usePatchPortfolioCvMutation';
import CvPreviewContent from './CvPreviewContent';

import { CV_QUERY_CONFIG } from '../../constants/cvQueryConfig';

const AddIconWrap: FunctionComponent<SVGProps<SVGSVGElement>> = () => (
  <AddIcon sx={{ fontSize: 20 }} />
);
const DeleteOutlineIconWrap: FunctionComponent<SVGProps<SVGSVGElement>> = () => (
  <DeleteOutlineIcon sx={{ fontSize: 18 }} />
);
const OpenInNewIconWrap: FunctionComponent<SVGProps<SVGSVGElement>> = () => (
  <OpenInNewIcon sx={{ fontSize: 18 }} />
);

function truncateText(s: string, max: number): string {
  const t = s.replace(/\s+/g, ' ').trim();
  if (!t) return '';
  return t.length <= max ? t : `${t.slice(0, max)}…`;
}

function keywordCount(notes: string): number {
  if (!notes.trim()) return 0;
  return notes
    .split(/[,，、]/)
    .map(x => x.trim())
    .filter(Boolean).length;
}

/** 목록 카드용 — API `mode` → 라벨·스타일 변형 */
function getCvModeChip(mode: string): { label: string; variant: 'cv' | 'archive' } | null {
  if (mode === 'cv') return { label: '취업준비용', variant: 'cv' };
  if (mode === 'archive') return { label: '역량평가용', variant: 'archive' };
  return null;
}

/** 목록이 차지하는 비율(0~1), 기본 5:5 */
const CV_LIST_SPLIT_FRACTION_STORAGE_KEY = 'cv-management-list-split-fraction';
/** 예전 px 저장 — 최초 1회만 비율로 이관 */
const CV_LIST_WIDTH_LEGACY_STORAGE_KEY = 'cv-management-list-width';
const RESIZE_HANDLE_PX = 8;
const DEFAULT_LIST_SPLIT_FRACTION = 0.5;
const MIN_LIST_WIDTH = 260;
const MIN_PREVIEW_WIDTH = 320;

function readStoredListSplitFraction(): number {
  try {
    const raw = localStorage.getItem(CV_LIST_SPLIT_FRACTION_STORAGE_KEY);
    const n = Number(raw);
    if (Number.isFinite(n) && n > 0.05 && n < 0.95) return n;
  } catch {
    /* ignore */
  }
  return DEFAULT_LIST_SPLIT_FRACTION;
}

function listWidthBoundsPx(totalWidth: number): { minW: number; maxW: number; usable: number } {
  const usable = totalWidth - RESIZE_HANDLE_PX;
  const maxW = Math.max(0, usable - MIN_PREVIEW_WIDTH);
  const minW = Math.min(MIN_LIST_WIDTH, maxW);
  return { minW, maxW, usable };
}

function clampListWidthPx(next: number, totalWidth: number): number {
  const { minW, maxW } = listWidthBoundsPx(totalWidth);
  return Math.round(Math.min(maxW, Math.max(minW, next)));
}

const CvManagementPanel = () => {
  const navigate = useNavigate();
  const isMobile = useMediaQuery(MAX_RESPONSIVE_WIDTH);
  const splitRef = useRef<HTMLDivElement>(null);
  const splitLegacyMigratedRef = useRef(false);
  const resizeDraftWidthRef = useRef<number | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [listSplitFraction, setListSplitFraction] = useState(readStoredListSplitFraction);
  const [resizeDraftListWidth, setResizeDraftListWidth] = useState<number | null>(null);
  const [isResizing, setIsResizing] = useState(false);
  const [previewId, setPreviewId] = useState<number | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [listSort, setListSort] = useState<PortfolioCvListSort>('newest');
  const deleteMutation = useDeletePortfolioCvMutation();
  const patchMutation = usePatchPortfolioCvMutation();

  const listQuery = useQuery({
    queryKey: [QUERY_KEYS.portfolioCv, 'list', listSort] as const,
    queryFn: () => getPortfolioCvList({ sort: listSort }),
    ...CV_QUERY_CONFIG,
  });

  const cvs = listQuery.data?.cvs ?? [];
  const cvTotal = listQuery.data?.total ?? cvs.length;
  const favoriteFilterActive = listSort === 'favorites';
  const displayCvs = useMemo(
    () => (favoriteFilterActive ? cvs.filter(c => c.is_favorite) : cvs),
    [cvs, favoriteFilterActive],
  );

  /** 목록 로드 시 상단(첫) 항목 자동 선택 · 삭제 후에도 유효한 선택 유지 */
  useEffect(() => {
    if (listQuery.isPending || listQuery.isError) return;
    if (displayCvs.length === 0) {
      setPreviewId(null);
      return;
    }
    setPreviewId(prev => {
      if (prev != null && displayCvs.some(c => c.id === prev)) return prev;
      return displayCvs[0].id;
    });
  }, [displayCvs, listQuery.isPending, listQuery.isError]);

  const detailQuery = useQuery({
    queryKey: [QUERY_KEYS.portfolioCv, 'detail', previewId] as const,
    queryFn: () => getPortfolioCvById(previewId!),
    enabled: previewId != null,
    ...CV_QUERY_CONFIG,
  });

  const openPreview = useCallback((id: number) => {
    setPreviewId(id);
  }, []);

  const closePreview = useCallback(() => {
    setPreviewId(null);
  }, []);

  const handleDeleteCv = useCallback(
    (id: number) => {
      deleteMutation.mutate(id, {
        onSuccess: () => {
          toast.success('포트폴리오가 삭제되었습니다.', { position: 'top-center' });
          setPreviewId(current => (current === id ? null : current));
        },
        onError: () => {
          toast.error('삭제에 실패했습니다. 잠시 후 다시 시도해 주세요.', {
            position: 'top-center',
          });
        },
      });
    },
    [deleteMutation],
  );

  const deletePending = deleteMutation.isPending;

  const confirmDeleteCv = useCallback(() => {
    if (deleteConfirmId == null) return;
    const id = deleteConfirmId;
    setDeleteConfirmId(null);
    handleDeleteCv(id);
  }, [deleteConfirmId, handleDeleteCv]);

  const handleToggleFavorite = useCallback(
    (item: PortfolioCvListItem) => {
      patchMutation.mutate(
        { id: item.id, body: { is_favorite: !item.is_favorite } },
        {
          onError: () => {
            toast.error('즐겨찾기 변경에 실패했습니다.', { position: 'top-center' });
          },
        },
      );
    },
    [patchMutation],
  );

  const favoriteTogglePending = patchMutation.isPending;

  const hasPreviewSelection = previewId != null;
  /** 모바일: 카드 선택 시에만 패널. 데스크톱: 항상 오른쪽 슬롯(미선택 시 빈 상태). */
  const showPreviewColumn = !isMobile || hasPreviewSelection;
  const showListColumn = !isMobile || !hasPreviewSelection;
  const showResizeHandle = !isMobile && showListColumn && showPreviewColumn;

  const listWidthPx = useMemo(() => {
    if (isMobile) return null;
    if (containerWidth <= 0) return null;
    const { usable } = listWidthBoundsPx(containerWidth);
    if (usable <= 0) return null;
    if (resizeDraftListWidth != null) {
      return clampListWidthPx(resizeDraftListWidth, containerWidth);
    }
    return clampListWidthPx(Math.round(usable * listSplitFraction), containerWidth);
  }, [isMobile, containerWidth, resizeDraftListWidth, listSplitFraction]);

  const handleResizePointerDown = useCallback(
    (e: ReactPointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      const el = splitRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const w = clampListWidthPx(e.clientX - rect.left, rect.width);
      resizeDraftWidthRef.current = w;
      setResizeDraftListWidth(w);
      setIsResizing(true);
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    [],
  );

  useEffect(() => {
    if (!isResizing) return;

    const onMove = (e: PointerEvent) => {
      const el = splitRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const w = clampListWidthPx(e.clientX - rect.left, rect.width);
      resizeDraftWidthRef.current = w;
      setResizeDraftListWidth(w);
    };

    const onUp = () => {
      setIsResizing(false);
      const el = splitRef.current;
      const draft = resizeDraftWidthRef.current;
      resizeDraftWidthRef.current = null;
      setResizeDraftListWidth(null);
      if (el && draft != null) {
        const total = el.getBoundingClientRect().width;
        const { usable } = listWidthBoundsPx(total);
        if (usable > 0) {
          const w = clampListWidthPx(draft, total);
          const nextFrac = w / usable;
          setListSplitFraction(nextFrac);
          try {
            localStorage.setItem(CV_LIST_SPLIT_FRACTION_STORAGE_KEY, String(nextFrac));
          } catch {
            /* ignore */
          }
        }
      }
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [isResizing]);

  useEffect(() => {
    if (isMobile || !splitRef.current) return;
    const el = splitRef.current;
    const ro = new ResizeObserver(() => {
      const total = el.getBoundingClientRect().width;
      if (total <= 0) return;
      setContainerWidth(total);

      if (!splitLegacyMigratedRef.current) {
        splitLegacyMigratedRef.current = true;
        try {
          const hasFrac = localStorage.getItem(CV_LIST_SPLIT_FRACTION_STORAGE_KEY);
          const legacy = localStorage.getItem(CV_LIST_WIDTH_LEGACY_STORAGE_KEY);
          if (legacy != null) {
            if (!hasFrac) {
              const px = Number(legacy);
              if (Number.isFinite(px) && px > 0) {
                const { usable } = listWidthBoundsPx(total);
                if (usable > 0) {
                  const w = clampListWidthPx(px, total);
                  const f = w / usable;
                  setListSplitFraction(f);
                  localStorage.setItem(CV_LIST_SPLIT_FRACTION_STORAGE_KEY, String(f));
                }
              }
            }
            localStorage.removeItem(CV_LIST_WIDTH_LEGACY_STORAGE_KEY);
          }
        } catch {
          /* ignore */
        }
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [isMobile]);

  useEffect(() => {
    if (isMobile || containerWidth <= 0 || isResizing) return;
    const { usable, minW, maxW } = listWidthBoundsPx(containerWidth);
    if (usable <= 0) return;
    const curW = usable * listSplitFraction;
    const clampedW = Math.min(maxW, Math.max(minW, curW));
    const nextF = clampedW / usable;
    if (Math.abs(nextF - listSplitFraction) > 0.0005) {
      setListSplitFraction(nextF);
      try {
        localStorage.setItem(CV_LIST_SPLIT_FRACTION_STORAGE_KEY, String(nextF));
      } catch {
        /* ignore */
      }
    }
  }, [containerWidth, isMobile, isResizing, listSplitFraction]);

  return (
    <S.Root
      direction="column"
      gap="1.5rem"
      width="100%"
      style={{ flex: 1, minHeight: 0, minWidth: 0, boxSizing: 'border-box' }}
    >
      <Flex.Row align="center" gap="1rem" wrap="wrap" width="100%" style={{ minWidth: 0 }}>
        <S.GuideText>
          저장한 HTML과 공개 링크는 여기서 확인하고, 새 포트폴리오는 생성기에서 만든 뒤 이 목록에
          쌓입니다.
        </S.GuideText>
        <Button
          label="포트폴리오 생성"
          variant="contained"
          color="blue"
          size="large"
          icon={AddIconWrap}
          iconPosition="start"
          onClick={() => navigate(ROUTE_PATH.cvGenerate)}
          style={{ flexShrink: 0 }}
        />
      </Flex.Row>

      {listQuery.isPending ? (
        <S.ProgressWrap>
          <LinearProgress />
        </S.ProgressWrap>
      ) : null}

      <S.SplitShell ref={splitRef}>
        <S.SplitRow
          $isResizing={isResizing}
          align="stretch"
          gap={isMobile ? '1.25rem' : '0'}
          width="100%"
          wrap="nowrap"
          style={{ flex: 1, minHeight: 0, minWidth: 0 }}
        >
        {showListColumn ? (
          <S.ListColumn
            direction="column"
            gap="0"
            width="100%"
            style={{
              flex: isMobile
                ? '1 1 100%'
                : listWidthPx != null
                  ? `0 0 ${listWidthPx}px`
                  : '1 1 0',
              width: isMobile ? '100%' : listWidthPx != null ? listWidthPx : undefined,
              maxWidth: isMobile ? '100%' : listWidthPx != null ? listWidthPx : undefined,
              minWidth: isMobile ? 0 : MIN_LIST_WIDTH,
              minHeight: 0,
              overflow: 'hidden',
            }}
          >
            <S.ListToolbar>
              <S.ListCount>전체 {cvTotal}건</S.ListCount>
              <ToggleButton
                label="즐겨찾기"
                selected={favoriteFilterActive}
                disabled={listQuery.isPending}
                onClick={() =>
                  setListSort(prev => (prev === 'favorites' ? 'newest' : 'favorites'))
                }
              />
            </S.ListToolbar>

            <S.ListScrollBody>
              {listQuery.isError ? (
                <Text margin="0" color={palette.pink500} style={{ fontSize: '0.875rem' }}>
                  목록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.
                </Text>
              ) : null}

              {!listQuery.isPending && cvTotal === 0 ? (
                <S.EmptyState>
                  <S.EmptyTitle>아직 저장된 포트폴리오가 없습니다</S.EmptyTitle>
                  <S.EmptyHint>
                    「포트폴리오 생성」으로 생성기에 들어가 프롬프트와 HTML을 저장하면 이곳에
                    표시됩니다.
                  </S.EmptyHint>
                </S.EmptyState>
              ) : null}

              {!listQuery.isPending &&
              cvTotal > 0 &&
              favoriteFilterActive &&
              displayCvs.length === 0 ? (
                <S.EmptyState>
                  <S.EmptyTitle>즐겨찾기한 포트폴리오가 없습니다</S.EmptyTitle>
                  <S.EmptyHint>카드의 별 아이콘을 눌러 즐겨찾기에 추가할 수 있습니다.</S.EmptyHint>
                </S.EmptyState>
              ) : null}

              {displayCvs.map(item => (
                <CvHistoryCard
                  key={item.id}
                  item={item}
                  isSelected={previewId === item.id}
                  favoriteToggleDisabled={favoriteTogglePending}
                  onSelect={() => openPreview(item.id)}
                  onToggleFavorite={() => handleToggleFavorite(item)}
                  onOpenShareLink={() => {
                    const token = String(item.public_token ?? '').trim();
                    if (!token) return;
                    if (!openCvShareInNewTab(token)) {
                      toast.warn('새 창이 열리지 않았습니다. 팝업 차단을 해제해 주세요.', {
                        position: 'top-center',
                      });
                    }
                  }}
                />
              ))}
            </S.ListScrollBody>
          </S.ListColumn>
        ) : null}

        {showResizeHandle ? (
          <S.ResizeHandle
            type="button"
            aria-label="목록·미리보기 영역 너비 조절"
            aria-orientation="vertical"
            $active={isResizing}
            onPointerDown={handleResizePointerDown}
          />
        ) : null}

        {showPreviewColumn ? (
          <S.PreviewColumn
            $isMobile={isMobile}
            direction="column"
            width="100%"
            style={isMobile ? undefined : { flex: '1 1 0', minWidth: MIN_PREVIEW_WIDTH }}
          >
            {hasPreviewSelection ? (
              <CvPreviewContent
                active={hasPreviewSelection}
                layout="panel"
                showCloseButton={isMobile}
                onClose={closePreview}
                closeAriaLabel="목록으로 돌아가기"
                data={detailQuery.data}
                isPending={detailQuery.isPending}
                isError={detailQuery.isError}
                onRequestDelete={
                  previewId != null ? () => setDeleteConfirmId(previewId) : undefined
                }
                isDeletePending={deletePending}
              />
            ) : (
              <S.PreviewEmpty
                align="center"
                justify="center"
                gap="0.75rem"
                width="100%"
                style={{ flex: 1, minHeight: 'min(12rem, 40vh)', padding: '1.5rem 1rem' }}
              >
                <VerticalSplitOutlinedIcon
                  sx={{ fontSize: 46, color: palette.grey400, flexShrink: 0 }}
                  aria-hidden
                />
                <S.EmptyTitle style={{ textAlign: 'center', wordBreak: 'keep-all' }}>
                  왼쪽 목록에서 카드를 선택하면 상세 내용이 여기에 표시됩니다.
                </S.EmptyTitle>
                <S.EmptyHint style={{ textAlign: 'center', wordBreak: 'keep-all' }}>
                  왼쪽 카드를 눌러 선택해 주세요.
                </S.EmptyHint>
              </S.PreviewEmpty>
            )}
          </S.PreviewColumn>
        ) : null}
      </S.SplitRow>
      </S.SplitShell>

      <Dialog
        open={deleteConfirmId != null}
        aria-labelledby="cv-delete-confirm-title"
        onClose={() => {
          if (deletePending) return;
          setDeleteConfirmId(null);
        }}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: '0.75rem',
            border: `1px solid ${palette.grey200}`,
            boxShadow: '0 4px 24px rgba(83, 127, 241, 0.15)',
            width: '100%',
            maxWidth: '26rem',
            overflow: 'hidden',
          },
        }}
        sx={{ zIndex: theme => theme.zIndex.modal + 2 }}
      >
        <DialogContent
          sx={{
            p: '1.25rem 1.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
          }}
        >
          <Flex.Row align="flex-start" gap="0.5rem" width="100%" style={{ minWidth: 0 }}>
            <DeleteOutlineIcon
              sx={{ fontSize: 22, color: palette.red500, flexShrink: 0, marginTop: '0.125rem' }}
              aria-hidden
            />
            <Flex.Column gap="0.5rem" style={{ flex: '1 1 auto', minWidth: 0 }}>
              <Heading
                as="h2"
                margin="0"
                color={palette.nearBlack}
                id="cv-delete-confirm-title"
                style={{
                  fontSize: '1.125rem',
                  fontWeight: 700,
                  lineHeight: 1.5,
                }}
              >
                포트폴리오를 삭제할까요?
              </Heading>
              <Text
                margin="0"
                color={palette.grey600}
                style={{ fontSize: '0.875rem', lineHeight: 1.65, wordBreak: 'keep-all' }}
              >
                저장된 HTML·프롬프트·공개 링크 설정이 함께 사라지며, 되돌릴 수 없습니다.
              </Text>
            </Flex.Column>
          </Flex.Row>
          <S.DeleteDialogActions>
            <Flex.Row align="center" justify="flex-end" gap="0.5rem" wrap="wrap" width="100%">
              <Button
                label="취소"
                variant="outlined"
                color="grey"
                size="medium"
                onClick={() => setDeleteConfirmId(null)}
                disabled={deletePending}
              />
              <Button
                label="삭제하기"
                variant="outlined"
                color="red"
                size="medium"
                icon={DeleteOutlineIconWrap}
                iconPosition="start"
                onClick={confirmDeleteCv}
                disabled={deletePending}
              />
            </Flex.Row>
          </S.DeleteDialogActions>
        </DialogContent>
      </Dialog>
    </S.Root>
  );
};

function CvHistoryCard({
  item,
  isSelected,
  favoriteToggleDisabled,
  onSelect,
  onToggleFavorite,
  onOpenShareLink,
}: {
  item: PortfolioCvListItem;
  isSelected: boolean;
  favoriteToggleDisabled: boolean;
  onSelect: () => void;
  onToggleFavorite: () => void;
  onOpenShareLink: () => void;
}) {
  const isMobile = useMediaQuery(MAX_RESPONSIVE_WIDTH);
  const btnSize = isMobile ? 'small' : 'medium';

  const kCount = keywordCount(item.additional_notes ?? '');
  const subLine =
    kCount > 0
      ? `반영 키워드 ${kCount}개`
      : item.additional_notes?.trim()
        ? '추가 요청 있음'
        : '추가 요청 없음';
  const snippetSource =
    [item.job_posting, item.target_position, item.additional_notes]
      .filter(Boolean)
      .join(' · ') || '미리보기 내용이 없습니다.';
  const snippet = truncateText(snippetSource, 140);
  const isHtmlPublic = Boolean(item.is_public);
  const hasShareToken = Boolean(String(item.public_token ?? '').trim());
  const cardTitle = item.title?.trim() ? item.title.trim() : '제목 없음';
  const modeChip = getCvModeChip(item.mode);

  const handleCardKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelect();
    }
  };

  return (
    <S.HistoryCard
      $selected={isSelected}
      onClick={onSelect}
      onKeyDown={handleCardKeyDown}
      role="button"
      tabIndex={0}
      aria-current={isSelected ? 'true' : undefined}
      aria-label={`${cardTitle} 포트폴리오 상세`}
    >
      <Flex.Row
        align="flex-start"
        justify="space-between"
        gap="0.75rem"
        wrap="wrap"
        width="100%"
        style={{ minWidth: 0 }}
      >
        <Flex.Column gap="0.5rem" style={{ flex: '1 1 14rem', minWidth: 0 }}>
          <Flex.Row align="center" gap="0.35rem" style={{ minWidth: 0 }}>
            <S.FavoriteButton
              type="button"
              $active={item.is_favorite}
              disabled={favoriteToggleDisabled}
              aria-label={item.is_favorite ? '즐겨찾기 해제' : '즐겨찾기 추가'}
              aria-pressed={item.is_favorite}
              onClick={e => {
                e.stopPropagation();
                onToggleFavorite();
              }}
            >
              {item.is_favorite ? (
                <StarIcon sx={{ fontSize: 20 }} aria-hidden />
              ) : (
                <StarBorderIcon sx={{ fontSize: 20 }} aria-hidden />
              )}
            </S.FavoriteButton>
            <S.CardTitle>{cardTitle}</S.CardTitle>
          </Flex.Row>
          <Flex.Row align="center" gap="0.5rem" wrap="wrap">
            <S.MetaChip>
              <WorkOutlineIcon sx={{ fontSize: 15, color: palette.grey500 }} aria-hidden />
              <span>{item.target_position?.trim() || '직무 미입력'}</span>
            </S.MetaChip>
            <S.MetaChip>
              <CalendarTodayIcon sx={{ fontSize: 15, color: palette.grey500 }} aria-hidden />
              <span>{formatDateTime(item.updated_at)}</span>
            </S.MetaChip>
            <S.HtmlPublicStatusTag $public={isHtmlPublic}>
              {isHtmlPublic ? 'HTML 공개 중' : 'HTML 비공개'}
            </S.HtmlPublicStatusTag>
            {modeChip ? (
              <S.CvModeTag $variant={modeChip.variant}>{modeChip.label}</S.CvModeTag>
            ) : null}
          </Flex.Row>
        </Flex.Column>
        <Flex.Row
          align="center"
          gap="0.5rem"
          wrap="wrap"
          style={{
            flexShrink: 0,
            width: isMobile ? '100%' : 'auto',
            justifyContent: isMobile ? 'flex-end' : 'flex-start',
          }}
        >
          {isHtmlPublic ? (
            <Button
              label="포토폴리오 보기"
              variant="outlined"
              color="blue"
              size={btnSize}
              icon={OpenInNewIconWrap}
              iconPosition="start"
              onClick={e => {
                e.stopPropagation();
                onOpenShareLink();
              }}
              disabled={!hasShareToken}
            />
          ) : null}
        </Flex.Row>
      </Flex.Row>

      <Flex.Column gap="0.35rem" width="100%" style={{ minWidth: 0 }}>
        <Text margin="0" color={palette.grey500} style={{ fontSize: '0.75rem', fontWeight: 600 }}>
          {subLine}
        </Text>
        <S.Snippet>{snippet}</S.Snippet>
      </Flex.Column>
    </S.HistoryCard>
  );
}

export default CvManagementPanel;

const S = {
  Root: styled(Flex.Column)`
    width: 100%;
    min-width: 0;
  `,
  GuideText: styled(Text)`
    margin: 0;
    padding: 0.75rem 1rem;
    font-size: 0.9375rem;
    line-height: 1.6;
    letter-spacing: 0.01em;
    color: ${palette.grey600};
    background-color: ${palette.blue300};
    border-left: 3px solid ${palette.blue500};
    border-radius: 0 0.5rem 0.5rem 0;
    flex: 1 1 16rem;
    min-width: 0;
  `,
  SplitShell: styled('div')`
    display: flex;
    flex: 1 1 auto;
    min-width: 0;
    min-height: 0;
    width: 100%;
  `,
  SplitRow: styled(Flex.Row, {
    shouldForwardProp: p => p !== '$isResizing',
  })<{ $isResizing?: boolean }>`
    min-width: 0;
    min-height: 0;
    flex: 1 1 auto;
    ${({ $isResizing }) =>
      $isResizing ? 'cursor: col-resize; user-select: none;' : ''}
  `,
  ResizeHandle: styled('button', {
    shouldForwardProp: p => p !== '$active',
  })<{ $active?: boolean }>`
    display: flex;
    flex: 0 0 ${RESIZE_HANDLE_PX}px;
    align-items: center;
    justify-content: center;
    width: ${RESIZE_HANDLE_PX}px;
    min-width: ${RESIZE_HANDLE_PX}px;
    margin: 0;
    padding: 0;
    border: none;
    background-color: ${({ $active }) => ($active ? palette.blue300 : 'transparent')};
    cursor: col-resize;
    box-sizing: border-box;
    touch-action: none;
    transition: background-color 0.15s ease;
    &:hover {
      background-color: ${palette.blue300};
    }
    &:focus-visible {
      outline: 2px solid ${palette.blue500};
      outline-offset: -1px;
    }
    &::after {
      content: '';
      display: block;
      width: 2px;
      height: 2.75rem;
      border-radius: 999px;
      background-color: ${({ $active }) => ($active ? palette.blue500 : palette.grey300)};
      transition: background-color 0.15s ease;
    }
  `,
  ListColumn: styled(Flex.Column)`
    min-width: 0;
  `,
  PreviewColumn: styled(Flex.Column, {
    shouldForwardProp: p => p !== '$isMobile',
  })<{ $isMobile: boolean }>`
    flex: ${({ $isMobile }) => ($isMobile ? '1 1 auto' : '1 1 0')};
    min-width: 0;
    min-height: 0;
    max-height: 100%;
    box-sizing: border-box;
    ${boxShadow};
    border-radius: 0.75rem;
    border: 1px solid ${palette.grey200};
    background-color: ${({ theme }) => theme.palette.background.paper};
    overflow: hidden;
  `,
  PreviewEmpty: styled(Flex.Column)`
    width: 100%;
    box-sizing: border-box;
    background-color: ${({ theme }) => theme.palette.grey[50]};
  `,
  ProgressWrap: styled('div')`
    width: 100%;
    box-sizing: border-box;
  `,
  ListScrollBody: styled('div')`
    display: flex;
    flex-direction: column;
    gap: 1rem;
    flex: 1 1 auto;
    min-height: 0;
    min-width: 0;
    width: 100%;
    padding-top: 1rem;
    overflow-y: auto;
    box-sizing: border-box;
    scrollbar-width: none;
    -ms-overflow-style: none;
    &::-webkit-scrollbar {
      display: none;
    }
  `,
  ListToolbar: styled('div')`
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 0.5rem;
    flex-shrink: 0;
    width: 100%;
    min-width: 0;
    min-height: 2.25rem;
    padding-bottom: 0.5rem;
    box-sizing: border-box;
    border-bottom: 1px solid ${palette.grey200};
    background-color: ${({ theme }) => theme.palette.background.default};
  `,
  ListCount: styled('span')`
    display: flex;
    align-items: center;
    margin: 0;
    font-size: 0.8125rem;
    font-weight: 600;
    line-height: 1;
    color: ${palette.grey600};
  `,
  CardTitle: styled('span')`
    display: block;
    flex: 1 1 auto;
    min-width: 0;
    margin: 0;
    font-size: 1rem;
    font-weight: 700;
    line-height: 1.4;
    color: ${palette.nearBlack};
    word-break: break-word;
  `,
  EmptyState: styled('div')`
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 2.25rem 1.25rem;
    border-radius: 0.75rem;
    background-color: ${({ theme }) => theme.palette.grey[50]};
    border: 1px dashed ${palette.grey200};
    width: 100%;
    box-sizing: border-box;
    text-align: center;
  `,
  EmptyTitle: styled('p')`
    margin: 0;
    font-size: 1rem;
    font-weight: 600;
    color: ${palette.grey600};
  `,
  EmptyHint: styled('p')`
    margin: 0;
    font-size: 0.875rem;
    line-height: 1.6;
    color: ${palette.grey500};
    max-width: 22rem;
  `,
  FavoriteButton: styled('button', {
    shouldForwardProp: p => p !== '$active',
  })<{ $active: boolean }>`
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    width: 2rem;
    height: 2rem;
    margin: 0;
    padding: 0;
    border: none;
    border-radius: 0.375rem;
    background-color: transparent;
    color: ${({ $active }) => ($active ? palette.blue500 : palette.grey400)};
    cursor: pointer;
    transition: color 0.15s ease, background-color 0.15s ease;
    &:hover:not(:disabled) {
      background-color: ${palette.blue300};
      color: ${palette.blue600};
    }
    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  `,
  HistoryCard: styled('article', {
    shouldForwardProp: p => p !== '$selected',
  })<{ $selected?: boolean }>`
    display: flex;
    flex-direction: column;
    gap: 0.875rem;
    width: 100%;
    box-sizing: border-box;
    padding: 1.25rem;
    border-radius: 0.75rem;
    background-color: ${({ theme, $selected }) =>
      $selected ? palette.blue300 : theme.palette.background.paper};
    border: 1px solid
      ${({ theme, $selected }) =>
        $selected ? palette.blue400 : theme.palette.grey[200]};
    box-shadow: ${({ $selected }) =>
      $selected
        ? '0 2px 8px rgba(83, 127, 241, 0.12)'
        : '0 1px 2px rgba(16, 24, 40, 0.06)'};
    transition:
      background-color 0.15s ease,
      border-color 0.15s ease,
      box-shadow 0.15s ease;
    cursor: pointer;
    text-align: left;
    &:hover {
      background-color: ${({ theme, $selected }) =>
        $selected ? palette.blue300 : theme.palette.background.paper};
      border-color: ${({ theme, $selected }) =>
        $selected ? palette.blue500 : theme.palette.grey[300]};
      box-shadow: ${({ $selected }) =>
        $selected
          ? '0 2px 10px rgba(83, 127, 241, 0.16)'
          : '0 2px 6px rgba(16, 24, 40, 0.08)'};
    }
    &:focus-visible {
      outline: 2px solid ${palette.blue500};
      outline-offset: 2px;
    }
  `,
  MetaChip: styled('span')`
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    font-size: 0.75rem;
    font-weight: 600;
    color: ${palette.grey600};
  `,
  HtmlPublicStatusTag: styled('span', {
    shouldForwardProp: p => p !== '$public',
  })<{ $public: boolean }>`
    display: inline-flex;
    align-items: center;
    padding: 0.2rem 0.55rem;
    border-radius: 999px;
    font-size: 0.6875rem;
    font-weight: 700;
    letter-spacing: 0.02em;
    white-space: nowrap;
    box-sizing: border-box;
    background-color: ${({ theme }) => theme.palette.background.paper};
    border: 1px solid
      ${({ $public }) => ($public ? palette.blue400 : palette.grey300)};
    color: ${({ $public }) => ($public ? palette.blue600 : palette.grey600)};
    box-shadow: ${({ $public }) =>
      $public ? '0 1px 2px rgba(83, 127, 241, 0.1)' : '0 1px 2px rgba(16, 24, 40, 0.05)'};
  `,
  CvModeTag: styled('span', {
    shouldForwardProp: p => p !== '$variant',
  })<{ $variant: 'cv' | 'archive' }>`
    display: inline-flex;
    align-items: center;
    padding: 0.2rem 0.55rem;
    border-radius: 999px;
    font-size: 0.6875rem;
    font-weight: 700;
    letter-spacing: 0.02em;
    white-space: nowrap;
    box-sizing: border-box;
    border: 1px solid
      ${({ $variant }) =>
        $variant === 'cv' ? palette.chipForest700 : '#E6B422'};
    color: ${({ $variant }) =>
      $variant === 'cv' ? palette.chipForest700 : '#C49308'};
    background-color: ${({ $variant }) =>
      $variant === 'cv' ? '#FFFDF5' : '#FFFDF5'};
    box-shadow: ${({ $variant }) =>
      $variant === 'cv'
        ? '0 1px 2px rgba(46, 125, 50, 0.12)'
        : '0 1px 2px rgba(212, 160, 18, 0.12)'};
  `,
  HtmlPublicLabelTag: styled('span')`
    display: inline-flex;
    align-items: center;
    padding: 0.2rem 0.55rem;
    border-radius: 999px;
    font-size: 0.6875rem;
    font-weight: 600;
    line-height: 1.35;
    white-space: nowrap;
    box-sizing: border-box;
    color: ${palette.nearBlack};
    background-color: ${({ theme }) => theme.palette.background.paper};
    border: 1px solid ${palette.grey200};
    box-shadow: 0 1px 2px rgba(16, 24, 40, 0.06);
  `,
  Snippet: styled('div')`
    margin: 0;
    padding: 0.65rem 0.85rem;
    font-size: 0.8125rem;
    line-height: 1.55;
    color: ${palette.grey600};
    background-color: ${({ theme }) => theme.palette.grey[50]};
    border-radius: 0.5rem;
    word-break: break-word;
  `,
  DeleteDialogActions: styled('div')`
    box-sizing: border-box;
    margin: 0 -1.5rem -1.25rem;
    padding: 0.85rem 1.5rem 1rem;
    border-top: 1px solid ${palette.grey200};
    background-color: ${palette.grey100};
  `,
};
