import { Button, Dropdown, Flex, Input, Text, Title } from '@/components';
import { palette } from '@/styles/palette';
import CloseIcon from '@mui/icons-material/Close';
import DateRangeOutlinedIcon from '@mui/icons-material/DateRangeOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditIcon from '@mui/icons-material/Edit';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useMemo,
  useState,
} from 'react';
import { Dialog, DialogContent, styled, useTheme } from '@mui/material';

import { INPUT_MAX_LENGTH } from '../../constants/inputLimits';
import { groupActivitiesByCategory } from '../../utils/activityGrouping';
import { formatActivityPeriodRange } from '../../utils/date';
import {
  usePortfolioContext,
} from '../context/PortfolioContext';
import type { ActivityItem } from '../../types/portfolioItems';

type ActivityEditDraft = Partial<ActivityItem> & { tagCompose?: string };

const ACTIVITY_CATEGORY_PRESETS = ['동아리', '자격증', '수상', '봉사', '공모전', '해커톤' , '어학연수', '인턴/실무', '오픈소스', '대외활동', '기타'] as const;

function dedupeActivityTags(tags: string[] | undefined): string[] {
  if (!tags?.length) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of tags) {
    const s = t.trim();
    if (s && !seen.has(s)) {
      seen.add(s);
      out.push(s);
    }
  }
  return out;
}

/** 저장 직전: 칩 목록 + 입력 중인 텍스트까지 합쳐 태그 배열로 만듦 */
function hasOptionalActivityFields(d: Partial<ActivityItem>): boolean {
  return Boolean(
    (d.description ?? '').trim() ||
    (d.achievements_detail ?? '').trim() ||
    (d.url ?? '').trim(),
  );
}

function ActivityDetailRow({ label, value }: { label: string; value: string }) {
  return (
    <S.DetailRow>
      <S.DetailLabel>{label}</S.DetailLabel>
      <S.DetailValue>{value}</S.DetailValue>
    </S.DetailRow>
  );
}

function flushActivityTagsFromDraft(d: ActivityEditDraft): string[] {
  const base = dedupeActivityTags(d.tags);
  const piece = (d.tagCompose ?? '').trim();
  if (!piece) return base;
  const capped = piece.slice(0, INPUT_MAX_LENGTH.TECH_STACK_TAG);
  if (base.includes(capped)) return base;
  return [...base, capped];
}

interface ActivitiesSectionContentProps {
  readOnly?: boolean;
}

export type ActivitiesSectionContentHandle = {
  openAddActivity: () => void;
};

const ActivitiesSectionContent = forwardRef<
  ActivitiesSectionContentHandle,
  ActivitiesSectionContentProps
>(function ActivitiesSectionContent({ readOnly = false }, ref) {
  const theme = useTheme();
  const {
    activities,
    setActivities,
    deleteActivity,
    postNewActivity,
    saveExistingActivity,
    activitiesNextId,
    setActivitiesNextId,
  } = usePortfolioContext();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState<ActivityEditDraft>({});
  const [activityDeleteConfirmId, setActivityDeleteConfirmId] = useState<
    number | null
  >(null);
  const [activityDeletePending, setActivityDeletePending] = useState(false);
  const [showMoreFields, setShowMoreFields] = useState(false);

  const savedActivities = useMemo(
    () => activities.filter(a => a.id >= 0),
    [activities],
  );
  const draftActivities = useMemo(
    () => activities.filter(a => a.id < 0),
    [activities],
  );
  const grouped = useMemo(
    () => groupActivitiesByCategory(savedActivities),
    [savedActivities],
  );

  const handleAdd = useCallback(() => {
    const existingDraft = activities.find(a => a.id < 0);
    if (existingDraft) {
      setEditingId(existingDraft.id);
      setEditDraft({
        ...existingDraft,
        tags: dedupeActivityTags(existingDraft.tags),
        tagCompose: '',
      });
      setShowMoreFields(hasOptionalActivityFields(existingDraft));
      return;
    }
    const newItem: ActivityItem = {
      id: activitiesNextId,
      title: '새 활동',
      description: '',
      host: '',
      role: '',
      achievements: '',
      achievements_detail: '',
      start_date: new Date().toISOString().slice(0, 10),
      end_date: new Date().toISOString().slice(0, 10),
      category: '기타',
      url: '',
      tags: [],
    };
    setActivities(prev => [newItem, ...prev]);
    setActivitiesNextId(prev => prev - 1);
    setEditingId(newItem.id);
    setEditDraft({ ...newItem, tags: [], tagCompose: '' });
    setShowMoreFields(false);
  }, [activities, activitiesNextId, setActivities, setActivitiesNextId]);

  const handleStartEdit = useCallback(
    (item: ActivityItem) => {
      setActivities(prev => prev.filter(a => a.id >= 0));
      setEditingId(item.id);
      setEditDraft({
        ...item,
        tags: dedupeActivityTags(item.tags),
        tagCompose: '',
      });
      setShowMoreFields(hasOptionalActivityFields(item));
    },
    [setActivities],
  );

  const handleSaveEdit = useCallback(async () => {
    if (editingId == null || !editDraft.title?.trim()) return;
    const categoryNorm = (editDraft.category ?? '').trim() || '기타';
    if (editingId < 0) {
      const item = activities.find(a => a.id === editingId);
      if (!item) return;
      const tags = flushActivityTagsFromDraft(editDraft);
      const toSave: ActivityItem = {
        ...item,
        title: editDraft.title ?? item.title,
        description: editDraft.description ?? item.description,
        host: (editDraft.host ?? item.host ?? '').trim(),
        role: (editDraft.role ?? item.role ?? '').trim(),
        achievements: (editDraft.achievements ?? item.achievements ?? '').trim(),
        achievements_detail: (editDraft.achievements_detail ?? item.achievements_detail ?? '').trim(),
        start_date: editDraft.start_date ?? item.start_date,
        end_date: editDraft.end_date ?? item.end_date,
        category: categoryNorm,
        url: (editDraft.url ?? item.url ?? '').trim(),
        tags,
      };
      try {
        await postNewActivity(toSave);
        setEditingId(null);
        setEditDraft({});
      } catch {
        /* 토스트는 context에서 처리, 폼 유지 */
      }
      return;
    }
    const item = activities.find(a => a.id === editingId);
    if (!item) return;
    const tags = flushActivityTagsFromDraft(editDraft);
    const toSave: ActivityItem = {
      ...item,
      title: editDraft.title ?? item.title,
      description: editDraft.description ?? item.description,
      host: (editDraft.host ?? item.host ?? '').trim(),
      role: (editDraft.role ?? item.role ?? '').trim(),
      achievements: (editDraft.achievements ?? item.achievements ?? '').trim(),
      achievements_detail: (editDraft.achievements_detail ?? item.achievements_detail ?? '').trim(),
      start_date: editDraft.start_date ?? item.start_date,
      end_date: editDraft.end_date ?? item.end_date,
      category: categoryNorm,
      url: (editDraft.url ?? item.url ?? '').trim(),
      tags,
    };
    try {
      await saveExistingActivity(toSave);
      setEditingId(null);
      setEditDraft({});
    } catch {
      /* 토스트는 context에서 처리, 폼 유지 */
    }
  }, [editingId, editDraft, activities, postNewActivity, saveExistingActivity]);

  const handleCancelEdit = useCallback(() => {
    if (editingId != null && editingId < 0) {
      setActivities(prev => prev.filter(a => a.id !== editingId));
    }
    setEditingId(null);
    setEditDraft({});
    setShowMoreFields(false);
  }, [editingId, setActivities]);

  const handleDelete = useCallback(
    async (id: number) => {
      await deleteActivity(id);
      if (editingId === id) {
        setEditingId(null);
        setEditDraft({});
      }
    },
    [editingId, deleteActivity],
  );

  const pendingDeleteActivity = useMemo(
    () =>
      activityDeleteConfirmId == null
        ? null
        : activities.find(a => a.id === activityDeleteConfirmId) ?? null,
    [activities, activityDeleteConfirmId],
  );

  const confirmActivityDelete = useCallback(async () => {
    if (activityDeleteConfirmId == null) return;
    setActivityDeletePending(true);
    try {
      await handleDelete(activityDeleteConfirmId);
      setActivityDeleteConfirmId(null);
    } finally {
      setActivityDeletePending(false);
    }
  }, [activityDeleteConfirmId, handleDelete]);

  useImperativeHandle(
    ref,
    () => ({
      openAddActivity: () => {
        if (!readOnly) handleAdd();
      },
    }),
    [readOnly, handleAdd],
  );

  const renderActivityView = (item: ActivityItem) => {
    const period = formatActivityPeriodRange(item.start_date, item.end_date);
    const tags = dedupeActivityTags(item.tags);
    const hasDetailPanel = Boolean(
      item.host?.trim() || item.role?.trim() || item.achievements?.trim(),
    );
    const showEmptyHint =
      !item.description?.trim() &&
      !hasDetailPanel &&
      !item.url?.trim();

    return (
      <>
        <S.CardHeader>
          <Flex.Column gap="0.4rem" style={{ flex: 1, minWidth: 0 }}>
            <S.TitlePeriodRow align="center" gap="0.5rem" wrap="wrap">
              <S.ActivityTitle>{item.title}</S.ActivityTitle>
              <S.PeriodRow>
                <DateRangeOutlinedIcon sx={{ fontSize: 14, flexShrink: 0 }} aria-hidden />
                <span>{period}</span>
              </S.PeriodRow>
            </S.TitlePeriodRow>
            {tags.length > 0 ? (
              <Flex.Row gap="0.375rem" wrap="wrap" style={{ width: '100%' }}>
                {tags.map(tag => (
                  <S.TagChip key={`${item.id}-${tag}`}>{tag}</S.TagChip>
                ))}
              </Flex.Row>
            ) : null}
          </Flex.Column>
          {!readOnly ? (
            <Flex.Row gap="0.25rem" align="center" style={{ flexShrink: 0 }}>
              <S.EditButton
                type="button"
                onClick={() => handleStartEdit(item)}
                aria-label="수정"
              >
                <EditIcon sx={{ fontSize: 16 }} />
              </S.EditButton>
              <S.DeleteButton
                type="button"
                onClick={() => setActivityDeleteConfirmId(item.id)}
                aria-label="삭제"
              >
                <DeleteOutlineIcon sx={{ fontSize: 18 }} />
              </S.DeleteButton>
            </Flex.Row>
          ) : null}
        </S.CardHeader>

        {hasDetailPanel ? (
          <S.DetailPanel>
            {item.host?.trim() ? (
              <ActivityDetailRow label="주최" value={item.host.trim()} />
            ) : null}
            {item.role?.trim() ? (
              <ActivityDetailRow label="역할" value={item.role.trim()} />
            ) : null}
            {item.achievements?.trim() ? (
              <ActivityDetailRow label="성과" value={item.achievements.trim()} />
            ) : null}
          </S.DetailPanel>
        ) : null}

        {item.description?.trim() ? (
          <S.BodyText>{item.description.trim()}</S.BodyText>
        ) : showEmptyHint ? (
          <S.EmptyHint>
            추가 설명을 입력하면 더 나은 프롬프트 결과를 얻을 수 있습니다.
          </S.EmptyHint>
        ) : null}

        {item.url?.trim() ? (
          <S.UrlRow
            href={item.url.trim()}
            target="_blank"
            rel="noopener noreferrer"
          >
            <OpenInNewIcon sx={{ fontSize: 16, flexShrink: 0 }} aria-hidden />
            <span>{item.url.trim()}</span>
          </S.UrlRow>
        ) : null}
      </>
    );
  };

  const renderActivityEditorForm = () => (
    <Flex.Column gap="0.75rem" style={{ width: '100%', minWidth: 0 }}>
        <Flex.Column
          gap="0.75rem"
          style={{
            minWidth: 0,
            width: '100%',
          }}
        >
          <Flex.Row
            align="flex-end"
            gap="0.75rem"
            wrap="wrap"
            style={{ width: '100%' }}
          >
            <Flex.Column
              gap="0.25rem"
              style={{
                flex: '0 1 7.5rem',
                minWidth: 'min(100%, 6rem)',
                maxWidth: '11rem',
              }}
            >
              <S.FieldLabel>카테고리</S.FieldLabel>
              <Dropdown
                items={[...ACTIVITY_CATEGORY_PRESETS]}
                selectedItem={editDraft.category ?? ''}
                setSelectedItem={v =>
                  setEditDraft(prev => ({
                    ...prev,
                    category: v,
                  }))
                }
                freeSolo
                freeSoloInputProps={{
                  maxLength: INPUT_MAX_LENGTH.ACTIVITY_CATEGORY,
                  'aria-label': '카테고리',
                }}
                width="100%"
                size="small"
              />
            </Flex.Column>
            <Flex.Column
              gap="0.25rem"
              style={{
                flex: '1 1 13rem',
                minWidth: 'min(100%, 11rem)',
              }}
            >
              <S.FieldLabel>기간</S.FieldLabel>
              <Flex.Row
                align="center"
                gap="0.375rem"
                wrap="wrap"
                style={{ width: '100%' }}
              >
                <Input
                  type="date"
                  value={editDraft.start_date ?? ''}
                  onChange={e => {
                    const start = e.target.value;
                    setEditDraft(prev => {
                      const end = prev.end_date ?? '';
                      return {
                        ...prev,
                        start_date: start,
                        end_date: end && start > end ? start : end,
                      };
                    });
                  }}
                  inputProps={{ 'aria-label': '시작 기간' }}
                  size="small"
                  style={{
                    flex: '1 1 6.75rem',
                    minWidth: '6.5rem',
                    maxWidth: '100%',
                  }}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      backgroundColor: theme.palette.variant.default,
                    },
                  }}
                />
                <Text
                  as="span"
                  style={{
                    margin: 0,
                    flexShrink: 0,
                    color: theme.palette.grey[500],
                    fontSize: '0.875rem',
                  }}
                >
                  ~
                </Text>
                <Input
                  type="date"
                  value={editDraft.end_date ?? ''}
                  onChange={e => {
                    const end = e.target.value;
                    setEditDraft(prev => {
                      const start = prev.start_date ?? '';
                      return {
                        ...prev,
                        end_date: end,
                        // 종료일만 지운 경우 시작일은 유지
                        start_date: end === '' ? start : start && end < start ? end : start,
                      };
                    });
                  }}
                  inputProps={{ 'aria-label': '종료 기간' }}
                  size="small"
                  style={{
                    flex: '1 1 6.75rem',
                    minWidth: '6.5rem',
                    maxWidth: '100%',
                  }}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      backgroundColor: theme.palette.variant.default,
                    },
                  }}
                />
              </Flex.Row>
            </Flex.Column>
          </Flex.Row>
          <Flex.Row
            align="flex-end"
            gap="0.75rem"
            wrap="wrap"
            style={{ width: '100%' }}
          >
            <Flex.Column
              gap="0.25rem"
              style={{
                flex: '4 1 0',
                minWidth: 'min(100%, 10rem)',
              }}
            >
              <S.FieldLabel>주최</S.FieldLabel>
              <Input
                value={editDraft.host ?? ''}
                onChange={e =>
                  setEditDraft(prev => ({
                    ...prev,
                    host: e.target.value,
                  }))
                }
                placeholder="주최 기관·단체명"
                inputProps={{
                  maxLength: INPUT_MAX_LENGTH.ACTIVITY_HOST,
                  'aria-label': '주최',
                }}
                size="small"
                style={{ width: '100%' }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    backgroundColor: theme.palette.variant.default,
                  },
                }}
              />
            </Flex.Column>
            <Flex.Column
              gap="0.25rem"
              style={{
                flex: '6 1 0',
                minWidth: 'min(100%, 12rem)',
              }}
            >
              <S.FieldLabel>제목</S.FieldLabel>
              <Input
                value={editDraft.title ?? ''}
                onChange={e =>
                  setEditDraft(prev => ({
                    ...prev,
                    title: e.target.value,
                  }))
                }
                placeholder="활동 제목"
                inputProps={{
                  maxLength: INPUT_MAX_LENGTH.ACTIVITY_TITLE,
                  'aria-label': '제목',
                }}
                size="small"
                style={{ width: '100%' }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    backgroundColor: theme.palette.variant.default,
                  },
                }}
              />
            </Flex.Column>
          </Flex.Row>
          <Flex.Column
            gap="0.25rem"
            style={{
              width: '100%',
              minWidth: 0,
            }}
          >
            <S.FieldLabel>태그 (입력 후 Enter)</S.FieldLabel>
            <Flex.Column gap="0.375rem" style={{ width: '100%', minWidth: 0 }}>
              <Flex.Row
                wrap="wrap"
                align="center"
                gap="0.375rem"
                style={{ width: '100%', minWidth: 0 }}
              >
                {dedupeActivityTags(editDraft.tags).map((tag, i) => (
                  <S.TagRemoveChip
                    key={`${tag}-${i}`}
                    type="button"
                    onClick={() =>
                      setEditDraft(prev => ({
                        ...prev,
                        tags: dedupeActivityTags(prev.tags).filter(t => t !== tag),
                      }))
                    }
                    aria-label={`${tag} 태그 제거`}
                  >
                    <span>{tag}</span>
                    <CloseIcon sx={{ fontSize: 14, flexShrink: 0 }} />
                  </S.TagRemoveChip>
                ))}
              </Flex.Row>
              <S.TagEditorShell>
                <S.TagComposeInput
                  value={editDraft.tagCompose ?? ''}
                  onChange={e =>
                    setEditDraft(prev => ({
                      ...prev,
                      tagCompose: e.target.value.slice(
                        0,
                        INPUT_MAX_LENGTH.TECH_STACK_TAG,
                      ),
                    }))
                  }
                  placeholder="예: 해커톤 — 입력 후 Enter"
                  aria-label="태그 입력"
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      if (e.nativeEvent.isComposing) return;
                      e.preventDefault();
                      const input = e.target as HTMLInputElement;
                      /* IME 확정 직후 React state와 어긋남 방지: 다음 프레임에서 input 값 사용 */
                      window.requestAnimationFrame(() => {
                        const piece = input.value
                          .trim()
                          .slice(0, INPUT_MAX_LENGTH.TECH_STACK_TAG);
                        setEditDraft(prev => {
                          if (!piece) {
                            return { ...prev, tagCompose: '' };
                          }
                          const cur = dedupeActivityTags(prev.tags);
                          if (cur.includes(piece)) {
                            return { ...prev, tagCompose: '' };
                          }
                          return {
                            ...prev,
                            tags: [...cur, piece],
                            tagCompose: '',
                          };
                        });
                      });
                      return;
                    }
                    if (e.key === 'Backspace') {
                      if (e.nativeEvent.isComposing) return;
                      const val = (e.target as HTMLInputElement).value;
                      if (val === '') {
                        setEditDraft(prev => {
                          const cur = dedupeActivityTags(prev.tags);
                          if (!cur.length) return prev;
                          return { ...prev, tags: cur.slice(0, -1) };
                        });
                        e.preventDefault();
                      }
                    }
                  }}
                />
              </S.TagEditorShell>
            </Flex.Column>
          </Flex.Column>
          <Flex.Row
            align="flex-start"
            gap="0.75rem"
            wrap="wrap"
            style={{ width: '100%' }}
          >
            <Flex.Column
              gap="0.25rem"
              style={{
                flex: '5 1 0',
                minWidth: 'min(100%, 12rem)',
              }}
            >
              <S.FieldLabel>역할</S.FieldLabel>
              <Input
                multiline
                value={editDraft.role ?? ''}
                onChange={e =>
                  setEditDraft(prev => ({
                    ...prev,
                    role: e.target.value,
                  }))
                }
                placeholder="담당 역할·기여 내용"
                rows={2}
                inputProps={{
                  maxLength: INPUT_MAX_LENGTH.ACTIVITY_ROLE,
                  'aria-label': '역할',
                }}
                size="small"
                fullWidth
                sx={{
                  '& .MuiOutlinedInput-root': {
                    backgroundColor: theme.palette.variant.default,
                  },
                  '& textarea': {
                    resize: 'vertical',
                  },
                }}
              />
              <S.CharCount
                warn={
                  (editDraft.role?.length ?? 0) >= INPUT_MAX_LENGTH.ACTIVITY_ROLE - 40
                }
              >
                {editDraft.role?.length ?? 0} / {INPUT_MAX_LENGTH.ACTIVITY_ROLE}
              </S.CharCount>
            </Flex.Column>
            <Flex.Column
              gap="0.25rem"
              style={{
                flex: '5 1 0',
                minWidth: 'min(100%, 12rem)',
              }}
            >
              <S.FieldLabel>성과 및 결과</S.FieldLabel>
              <Input
                multiline
                value={editDraft.achievements ?? ''}
                onChange={e =>
                  setEditDraft(prev => ({
                    ...prev,
                    achievements: e.target.value,
                  }))
                }
                placeholder="수상, 성과, 결과 요약"
                rows={2}
                inputProps={{
                  maxLength: INPUT_MAX_LENGTH.ACTIVITY_ACHIEVEMENTS,
                  'aria-label': '성과 및 결과',
                }}
                size="small"
                fullWidth
                sx={{
                  '& .MuiOutlinedInput-root': {
                    backgroundColor: theme.palette.variant.default,
                  },
                  '& textarea': {
                    resize: 'vertical',
                  },
                }}
              />
              <S.CharCount
                warn={
                  (editDraft.achievements?.length ?? 0) >=
                  INPUT_MAX_LENGTH.ACTIVITY_ACHIEVEMENTS - 80
                }
              >
                {editDraft.achievements?.length ?? 0} /{' '}
                {INPUT_MAX_LENGTH.ACTIVITY_ACHIEVEMENTS}
              </S.CharCount>
            </Flex.Column>
          </Flex.Row>
          <S.MoreToggleRow>
            <S.MoreToggleButton
              type="button"
              onClick={() => setShowMoreFields(prev => !prev)}
              aria-expanded={showMoreFields}
            >
              <ExpandMoreIcon
                sx={{
                  fontSize: 20,
                  transform: showMoreFields ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 0.2s ease',
                }}
              />
              {showMoreFields ? '추가 항목 접기' : '추가 항목 더보기'}
            </S.MoreToggleButton>
          </S.MoreToggleRow>
          {showMoreFields ? (
            <Flex.Column gap="0.75rem" style={{ width: '100%' }}>
              <Flex.Column gap="0.25rem" style={{ width: '100%' }}>
                <S.FieldLabel>활동 상세 설명</S.FieldLabel>
                  <Input
                    multiline
                    value={editDraft.description ?? ''}
                    onChange={e =>
                      setEditDraft(prev => ({
                        ...prev,
                        description: e.target.value,
                      }))
                    }
                    placeholder="활동의 상세 내용을 입력해 주세요."
                    rows={2}
                    inputProps={{
                      maxLength: INPUT_MAX_LENGTH.ACTIVITY_DESCRIPTION,
                      'aria-label': '활동 상세 설명',
                    }}
                    size="small"
                    fullWidth
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        backgroundColor: theme.palette.variant.default,
                      },
                      '& textarea': {
                        resize: 'vertical',
                      },
                    }}
                  />
                  <S.CharCount
                    warn={
                      (editDraft.description?.length ?? 0) >=
                      INPUT_MAX_LENGTH.ACTIVITY_DESCRIPTION - 20
                    }
                  >
                    {editDraft.description?.length ?? 0} /{' '}
                    {INPUT_MAX_LENGTH.ACTIVITY_DESCRIPTION}
                  </S.CharCount>
              </Flex.Column>
              <Flex.Column gap="0.25rem" style={{ width: '100%' }}>
                <S.FieldLabel>관련 URL</S.FieldLabel>
                <Input
                  value={editDraft.url ?? ''}
                  onChange={e =>
                    setEditDraft(prev => ({
                      ...prev,
                      url: e.target.value,
                    }))
                  }
                  placeholder="https://…"
                  inputProps={{
                    maxLength: INPUT_MAX_LENGTH.ACTIVITY_URL,
                    'aria-label': '활동 관련 URL',
                  }}
                  size="small"
                  style={{ width: '100%' }}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      backgroundColor: theme.palette.variant.default,
                    },
                  }}
                />
              </Flex.Column>
              <Flex.Column gap="0.25rem" style={{ width: '100%' }}>
                <S.FieldLabel>성과 설명</S.FieldLabel>
                <Input
                  multiline
                  value={editDraft.achievements_detail ?? ''}
                  onChange={e =>
                    setEditDraft(prev => ({
                      ...prev,
                      achievements_detail: e.target.value,
                    }))
                  }
                  placeholder="성과에 대한 상세 설명"
                  rows={3}
                  inputProps={{
                    maxLength: INPUT_MAX_LENGTH.ACTIVITY_ACHIEVEMENTS_DETAIL,
                    'aria-label': '성과 설명',
                  }}
                  size="small"
                  fullWidth
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      backgroundColor: theme.palette.variant.default,
                    },
                    '& textarea': {
                      resize: 'vertical',
                    },
                  }}
                />
                <S.CharCount
                  warn={
                    (editDraft.achievements_detail?.length ?? 0) >=
                    INPUT_MAX_LENGTH.ACTIVITY_ACHIEVEMENTS_DETAIL - 100
                  }
                >
                  {editDraft.achievements_detail?.length ?? 0} /{' '}
                  {INPUT_MAX_LENGTH.ACTIVITY_ACHIEVEMENTS_DETAIL}
                </S.CharCount>
              </Flex.Column>
            </Flex.Column>
          ) : null}
        </Flex.Column>
        <Flex.Row
          justify="flex-end"
          align="center"
          gap="0.5rem"
          wrap="wrap"
          style={{ width: '100%' }}
        >
          <S.SmallButton
            type="button"
            variant="outline"
            onClick={handleCancelEdit}
          >
            취소
          </S.SmallButton>
          <S.SmallButton
            type="button"
            onClick={handleSaveEdit}
            disabled={!editDraft.title?.trim()}
          >
            저장
          </S.SmallButton>
        </Flex.Row>
      </Flex.Column>
  );

  return (
    <Flex.Column gap="0.5rem" style={{ width: '100%' }}>
      {!readOnly && draftActivities.length > 0 ? (
        <S.List>
          {draftActivities.map(draft => (
            <S.Row key={draft.id}>
              {editingId === draft.id ? renderActivityEditorForm() : null}
            </S.Row>
          ))}
        </S.List>
      ) : null}
      <Flex.Column gap="0" style={{ width: '100%' }}>
        {grouped.map(([categoryLabel, items]) => (
          <Flex.Column
            key={categoryLabel}
            padding="1rem 0"
            gap="0"
            style={{ width: '100%' }}
          >
            <Title label={categoryLabel} />
            <S.List>
              {items.map(item => (
                <S.Row key={item.id}>
                  {!readOnly && editingId === item.id ? (
                    renderActivityEditorForm()
                  ) : (
                    renderActivityView(item)
                  )}
                </S.Row>
              ))}
            </S.List>
          </Flex.Column>
        ))}
      </Flex.Column>

      {!readOnly && (
        <Dialog
          open={activityDeleteConfirmId != null}
          aria-labelledby="activity-delete-confirm-title"
          onClose={() => {
            if (activityDeletePending) return;
            setActivityDeleteConfirmId(null);
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
            <Flex.Row
              align="flex-start"
              gap="0.5rem"
              width="100%"
              style={{ minWidth: 0 }}
            >
              <DeleteOutlineIcon
                sx={{
                  fontSize: 22,
                  color: palette.red500,
                  flexShrink: 0,
                  marginTop: '0.125rem',
                }}
                aria-hidden
              />
              <Flex.Column gap="0.5rem" style={{ flex: '1 1 auto', minWidth: 0 }}>
                <Text
                  id="activity-delete-confirm-title"
                  as="span"
                  style={{
                    display: 'block',
                    fontSize: '1.125rem',
                    fontWeight: 700,
                    lineHeight: 1.5,
                    color: palette.nearBlack,
                    margin: 0,
                  }}
                >
                  활동을 삭제할까요?
                </Text>
                <Text
                  as="span"
                  margin="0"
                  color={palette.grey600}
                  style={{
                    fontSize: '0.875rem',
                    lineHeight: 1.65,
                    wordBreak: 'keep-all',
                  }}
                >
                  「{pendingDeleteActivity?.title?.trim() || '이 활동'}」 항목을
                  삭제합니다. 저장된 활동은 복구할 수 없습니다.
                </Text>
              </Flex.Column>
            </Flex.Row>
            <Flex.Row align="center" justify="flex-end" gap="0.5rem" wrap="wrap" width="100%">
              <Button
                label="취소"
                variant="outlined"
                color="grey"
                size="medium"
                onClick={() => setActivityDeleteConfirmId(null)}
                disabled={activityDeletePending}
              />
              <Button
                label="삭제하기"
                variant="outlined"
                color="red"
                size="medium"
                onClick={() => void confirmActivityDelete()}
                disabled={activityDeletePending}
              />
            </Flex.Row>
          </DialogContent>
        </Dialog>
      )}
    </Flex.Column>
  );
});

export default ActivitiesSectionContent;

const S = {
  List: styled(Flex.Column)`
    gap: 0.5rem;
    width: 100%;
  `,
  Row: styled(Flex.Column)`
    padding: 0.75rem 1rem;
    gap: 0.5rem;
    border-radius: 0.5rem;
    background-color: ${({ theme }) => theme.palette.background.paper};
    border: 1px solid ${({ theme }) => theme.palette.grey[200]};
    box-shadow: 0 1px 2px rgba(16, 24, 40, 0.06);
    transition: box-shadow 0.15s ease, border-color 0.15s ease;
    &:hover {
      border-color: ${({ theme }) => theme.palette.grey[300]};
      box-shadow: 0 2px 6px rgba(16, 24, 40, 0.08);
    }
  `,
  TitlePeriodRow: styled(Flex.Row)`
    width: 100%;
    min-width: 0;
  `,
  CardHeader: styled(Flex.Row)`
    display: flex;
    flex-direction: row;
    align-items: flex-start;
    justify-content: space-between;
    gap: 0.75rem;
    width: 100%;
    min-width: 0;
  `,
  ActivityTitle: styled('span')`
    margin: 0;
    font-size: 0.875rem;
    font-weight: 600;
    line-height: 1.4;
    color: ${palette.nearBlack};
    word-break: break-word;
  `,
  PeriodRow: styled(Flex.Row)`
    display: flex;
    flex-direction: row;
    align-items: center;
    flex-shrink: 0;
    gap: 0.3rem;
    margin: 0;
    font-size: 0.8125rem;
    font-weight: 400;
    line-height: 1.35;
    color: ${palette.grey500};
    & > svg {
      color: ${palette.grey500};
    }
  `,
  TagChip: styled('span')`
    display: inline-flex;
    align-items: center;
    padding: 0.2rem 0.5rem;
    border-radius: 999px;
    background-color: ${palette.white};
    color: ${palette.blue500};
    border: 1px solid ${palette.blue400};
    font-size: 0.6875rem;
    font-weight: 600;
    line-height: 1.3;
  `,
  DetailPanel: styled(Flex.Column)`
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    width: 100%;
    padding: 0.65rem 0.75rem;
    border-radius: 0.5rem;
    background-color: ${palette.blue300};
    box-sizing: border-box;
  `,
  DetailRow: styled(Flex.Row)`
    display: flex;
    flex-direction: row;
    align-items: flex-start;
    gap: 0.65rem;
    width: 100%;
    min-width: 0;
  `,
  DetailLabel: styled('span')`
    flex: 0 0 2.25rem;
    font-size: 0.6875rem;
    font-weight: 700;
    line-height: 1.45;
    color: ${palette.blue600};
    letter-spacing: 0.02em;
  `,
  DetailValue: styled('span')`
    flex: 1 1 auto;
    min-width: 0;
    font-size: 0.8125rem;
    font-weight: 500;
    line-height: 1.5;
    color: ${palette.nearBlack};
    word-break: break-word;
  `,
  BodyText: styled('p')`
    margin: 0;
    font-size: 0.8125rem;
    font-weight: 400;
    line-height: 1.55;
    color: ${palette.grey600};
    word-break: break-word;
  `,
  EmptyHint: styled('p')`
    margin: 0;
    font-size: 0.75rem;
    font-weight: 400;
    line-height: 1.5;
    color: ${palette.grey400};
    font-style: italic;
  `,
  UrlRow: styled('a')`
    display: inline-flex;
    flex-direction: row;
    align-items: center;
    gap: 0.35rem;
    max-width: 100%;
    padding: 0.4rem 0.55rem;
    border-radius: 0.375rem;
    background-color: ${palette.grey100};
    border: 1px solid ${palette.grey200};
    box-sizing: border-box;
    font-size: 0.75rem;
    font-weight: 600;
    line-height: 1.35;
    color: ${palette.blue500};
    text-decoration: none;
    word-break: break-all;
    transition: background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease;
    & > svg {
      color: ${palette.blue500};
    }
    &:hover {
      background-color: ${palette.blue300};
      border-color: ${palette.blue400};
      color: ${palette.blue600};
    }
  `,
  FieldLabel: styled('span')`
    font-size: 0.75rem;
    font-weight: 500;
    color: ${({ theme }) => theme.palette.text.secondary};
    line-height: 1.2;
  `,
  CategoryTag: styled('span')`
    display: inline-flex;
    align-items: center;
    padding: 0.3rem 0.625rem;
    border-radius: 999px;
    background-color: ${palette.white};
    color: ${palette.blue500};
    border: 1.5px solid ${palette.blue400};
    font-size: 0.75rem;
    font-weight: 500;
    box-shadow: 0 1px 2px rgba(83, 127, 241, 0.08);
  `,
  TagEditorShell: styled('div')`
    display: flex;
    flex-direction: row;
    align-items: center;
    width: 100%;
    min-height: 2.35rem;
    padding: 0.1rem 0.35rem;
    border-radius: 0.375rem;
    border: 1.5px solid ${palette.blue400};
    box-sizing: border-box;
    &:focus-within {
      border-color: ${palette.blue500};
      box-shadow: 0 0 0 2px ${palette.blue300};
    }
  `,
  TagComposeInput: styled('input')`
    width: 100%;
    min-width: 0;
    border: none;
    outline: none;
    font-size: 0.875rem;
    line-height: 1.5;
    padding: 0.3rem 0.3rem;
    background: transparent;
    box-sizing: border-box;
    font-family: inherit;
  `,
  TagRemoveChip: styled('button')`
    display: inline-flex;
    align-items: center;
    gap: 0.125rem;
    padding: 0.15rem 0.3rem 0.15rem 0.45rem;
    border-radius: 999px;
    border: 1.5px solid ${palette.blue400};
    background-color: ${palette.white};
    color: ${palette.blue500};
    font-size: 0.75rem;
    font-weight: 500;
    line-height: 1.3;
    cursor: pointer;
    box-shadow: 0 1px 2px rgba(83, 127, 241, 0.08);
    box-sizing: border-box;
    &:hover {
      border-color: ${palette.blue500};
      background-color: ${palette.blue300};
    }
  `,
  CharCount: styled('span')<{ warn?: boolean }>`
    font-size: 0.75rem;
    color: ${({ warn }) => (warn ? palette.pink500 : palette.grey400)};
    text-align: right;
  `,
  MoreToggleRow: styled(Flex.Row)`
    width: 100%;
    justify-content: flex-start;
  `,
  MoreToggleButton: styled('button')`
    display: inline-flex;
    flex-direction: row;
    align-items: center;
    gap: 0.25rem;
    padding: 0.25rem 0.5rem;
    margin: 0;
    border: none;
    border-radius: 0.375rem;
    background: transparent;
    color: ${palette.blue500};
    font-size: 0.8125rem;
    font-weight: 600;
    cursor: pointer;
    box-sizing: border-box;
    &:hover {
      background-color: ${palette.blue300};
    }
  `,
  EditButton: styled('button')`
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0.25rem;
    border: none;
    background: none;
    cursor: pointer;
    color: ${palette.grey500};
    border-radius: 0.25rem;
    &:hover {
      color: ${palette.blue500};
      background-color: ${palette.blue300};
    }
  `,
  DeleteButton: styled('button')`
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0.25rem;
    border: none;
    background: none;
    cursor: pointer;
    color: ${palette.grey500};
    border-radius: 0.25rem;
    &:hover {
      color: ${palette.pink500};
      background-color: rgba(227, 135, 158, 0.15);
    }
  `,
  SmallButton: styled('button')<{ variant?: 'outline' }>`
    padding: 0.25rem 0.5rem;
    border-radius: 0.375rem;
    font-size: 0.8125rem;
    font-weight: 500;
    cursor: pointer;
    border: 1px solid
      ${({ variant }) =>
        variant === 'outline' ? palette.grey300 : 'transparent'};
    background-color: ${({ variant }) =>
      variant === 'outline' ? 'transparent' : palette.blue500};
    color: ${({ variant }) =>
      variant === 'outline' ? palette.grey600 : palette.white};
    &:hover:not(:disabled) {
      opacity: 0.9;
    }
    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  `,
};
