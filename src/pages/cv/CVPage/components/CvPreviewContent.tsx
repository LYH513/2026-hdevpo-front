import { LoadingIcon } from '@/assets';
import { Button, Flex, Input, Text } from '@/components';
import { hideScrollbar } from '@/styles/hideScrollbar';
import { palette } from '@/styles/palette';
import BusinessIcon from '@mui/icons-material/Business';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import CloseIcon from '@mui/icons-material/Close';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import OpenInFullIcon from '@mui/icons-material/OpenInFull';
import CodeIcon from '@mui/icons-material/Code';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditIcon from '@mui/icons-material/Edit';
import HtmlIcon from '@mui/icons-material/Html';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import { Dialog, DialogContent, IconButton } from '@mui/material';
import { styled } from '@mui/material/styles';
import { useCallback, useEffect, useMemo, useState, type FunctionComponent, type SVGProps } from 'react';
import { toast } from 'react-toastify';
import { openCvShareInNewTab } from '@/constants/routePath';
import { formatDateTime } from '@/pages/portfolio/utils/date';
import { copyTextToClipboard } from '@/utils/copyTextToClipboard';
import {
  CV_COLOR_THEME_SWATCHES,
  CV_CUSTOMIZE_COLOR_THEME_LABELS,
  CV_CUSTOMIZE_COLOR_THEME_VALUES,
  type CvCustomizeColorThemeValue,
} from '../../constants/cvDesignCustomizeConstants';
import { getPortfolioCvById, type PortfolioCvDetail, type PortfolioCvDesignPreferences } from '../../apis/cv';
import usePatchPortfolioCvMutation from '../../hooks/usePatchPortfolioCvMutation';
import { buildCvPreviewSrcDoc } from '../../utils/buildCvPreviewSrcDoc';
import { downloadCvHtmlAsA4Pdf } from '../../utils/downloadCvHtmlAsA4Pdf';
import { sanitizeCvHtml } from '../../utils/sanitizeCvHtml';
import { CV_PREVIEW_IFRAME_SANDBOX } from '../../constants/cvPreviewIframeSandbox';
import { CvHtmlPublicSettingsRow } from './cvHtmlPublicUi';

export type CvPreviewContentLayout = 'modal' | 'panel';

export interface CvPreviewContentProps {
  /** false이면 편집·미리보기 토글 등 일시 상태를 초기화합니다 */
  active: boolean;
  layout?: CvPreviewContentLayout;
  /** panel 레이아웃(데스크톱 관리 화면)에서는 기본 false */
  showCloseButton?: boolean;
  onClose: () => void;
  closeAriaLabel?: string;
  data: PortfolioCvDetail | undefined;
  isPending: boolean;
  isError: boolean;
  onRequestDelete?: () => void;
  isDeletePending?: boolean;
}

const CopyIconWrap: FunctionComponent<SVGProps<SVGSVGElement>> = () => (
  <ContentCopyIcon sx={{ fontSize: 18 }} />
);
const OpenInFullIconWrap: FunctionComponent<SVGProps<SVGSVGElement>> = () => (
  <OpenInFullIcon sx={{ fontSize: 18 }} />
);
const CodeIconWrap: FunctionComponent<SVGProps<SVGSVGElement>> = () => (
  <CodeIcon sx={{ fontSize: 16 }} />
);
const HtmlIconWrap: FunctionComponent<SVGProps<SVGSVGElement>> = () => (
  <HtmlIcon sx={{ fontSize: 16 }} />
);
const PictureAsPdfIconWrap: FunctionComponent<SVGProps<SVGSVGElement>> = () => (
  <PictureAsPdfIcon sx={{ fontSize: 16 }} />
);
const DeleteOutlineIconWrap: FunctionComponent<SVGProps<SVGSVGElement>> = () => (
  <DeleteOutlineIcon sx={{ fontSize: 18 }} />
);
const EditIconWrap: FunctionComponent<SVGProps<SVGSVGElement>> = () => (
  <EditIcon sx={{ fontSize: 18 }} />
);

function notesToPills(notes: string): string[] {
  if (!notes.trim()) return [];
  return notes
    .split(/[,，、]/)
    .map(s => s.trim())
    .filter(Boolean);
}

function isCvColorThemeKey(s: string): s is CvCustomizeColorThemeValue {
  return (CV_CUSTOMIZE_COLOR_THEME_VALUES as readonly string[]).includes(s);
}

/** HTML 생성 시 저장된 design_preferences — 비어 있으면 null */
function summarizeDesignPreferences(dp: PortfolioCvDesignPreferences | undefined) {
  if (!dp) return null;
  const layout = dp.layout?.trim() ?? '';
  const density = dp.density?.trim() ?? '';
  const rawTheme = (dp.color_theme ?? '').trim().toLowerCase();
  const notes = (dp.additional_notes ?? '').trim() ?? '';
  const themeKey = isCvColorThemeKey(rawTheme) ? rawTheme : null;
  const themeLabel =
    themeKey != null
      ? CV_CUSTOMIZE_COLOR_THEME_LABELS[themeKey]
      : (dp.color_theme ?? '').trim();
  if (!layout && !density && !themeLabel && !notes) return null;
  const sw = themeKey != null ? CV_COLOR_THEME_SWATCHES[themeKey] : CV_COLOR_THEME_SWATCHES.indigo;
  return { layout, density, themeLabel, notes, accent: sw.primary, soft: sw.soft };
}

/** 크게 보기 모달: 가로 70vw, 세로 80vh ~ 90vh */
const CV_EXPAND_MODAL_PAPER_SX = {
  borderRadius: '0.75rem',
  border: `1px solid ${palette.grey200}`,
  boxShadow: '0 4px 24px rgba(83, 127, 241, 0.12)',
  width: '70vw',
  maxWidth: '70vw',
  minHeight: '80vh',
  maxHeight: '90vh',
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
  margin: '1rem',
  boxSizing: 'border-box',
} as const;

const CvPreviewContent = ({
  active,
  layout = 'modal',
  showCloseButton = layout !== 'panel',
  onClose,
  closeAriaLabel = '닫기',
  data,
  isPending,
  isError,
  onRequestDelete,
  isDeletePending = false,
}: CvPreviewContentProps) => {
  const [showHtmlPreview, setShowHtmlPreview] = useState(true);
  const [expandPromptOpen, setExpandPromptOpen] = useState(false);
  const [expandHtmlOpen, setExpandHtmlOpen] = useState(false);
  const [pdfDownloading, setPdfDownloading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editHtml, setEditHtml] = useState('');
  const patchMutation = usePatchPortfolioCvMutation();

  useEffect(() => {
    if (!active) {
      setShowHtmlPreview(false);
      setPdfDownloading(false);
      setIsEditing(false);
      setExpandPromptOpen(false);
      setExpandHtmlOpen(false);
    }
  }, [active]);

  useEffect(() => {
    setShowHtmlPreview(true);
    setPdfDownloading(false);
    setIsEditing(false);
    setExpandPromptOpen(false);
    setExpandHtmlOpen(false);
  }, [data?.id]);

  useEffect(() => {
    if (!data) return;
    setEditTitle(data.title);
    setEditHtml(data.html_content ?? '');
  }, [data?.id, data?.title, data?.html_content]);

  const handleCopyPrompt = async () => {
    if (!data?.prompt?.trim()) {
      toast.info('복사할 프롬프트가 없습니다.', { position: 'top-center' });
      return;
    }
    const ok = await copyTextToClipboard(data.prompt);
    if (ok) {
      toast.success('프롬프트가 복사되었습니다.', { position: 'top-center' });
    } else {
      toast.error(
        '복사에 실패했습니다. HTTPS 접속인지 확인하거나 텍스트를 직접 선택해 복사해 주세요.',
        { position: 'top-center' },
      );
    }
  };

  const pills = data ? notesToPills(data.additional_notes ?? '') : [];
  const designPrefsSummary = useMemo(
    () => (data ? summarizeDesignPreferences(data.design_preferences) : null),
    [data],
  );
  const htmlRaw = isEditing ? editHtml : (data?.html_content ?? '');

  const handleCopyHtml = async () => {
    const html = htmlRaw.trim();
    if (!html) {
      toast.info('복사할 HTML이 없습니다.', { position: 'top-center' });
      return;
    }
    const ok = await copyTextToClipboard(html);
    if (ok) {
      toast.success('HTML이 클립보드에 복사되었습니다.', { position: 'top-center' });
    } else {
      toast.error(
        '복사에 실패했습니다. HTTPS 접속인지 확인하거나 텍스트를 직접 선택해 복사해 주세요.',
        { position: 'top-center' },
      );
    }
  };

  const htmlPreviewSrcDoc = useMemo(() => {
    const sanitized = sanitizeCvHtml(htmlRaw);
    return buildCvPreviewSrcDoc(sanitized);
  }, [htmlRaw]);
  const patchPending = patchMutation.isPending;
  const actionDisabled = patchPending || isDeletePending || pdfDownloading;
  const publicToggleDisabled = patchPending || isDeletePending || isEditing;

  const handleOpenPublicShare = useCallback(() => {
    if (!data) return;
    const token = String(data.public_token ?? '').trim();
    if (!token) {
      toast.error('공개 링크를 열 수 없습니다.', { position: 'top-center' });
      return;
    }
    if (!openCvShareInNewTab(token)) {
      toast.warn('새 창이 열리지 않았습니다. 팝업 차단을 해제하거나 주소를 직접 복사해 주세요.', {
        position: 'top-center',
      });
    }
  }, [data]);

  const handleTogglePublic = useCallback(
    (checked: boolean) => {
      if (!data) return;
      if (checked && !String(data.public_token ?? '').trim()) {
        toast.error('공개 링크를 준비할 수 없습니다. 잠시 후 다시 시도해 주세요.', {
          position: 'top-center',
        });
        return;
      }
      patchMutation.mutate(
        { id: data.id, body: { is_public: checked } },
        {
          onSuccess: () => {
            if (checked) {
              toast.success('포트폴리오가 공개되었습니다.', {
                position: 'top-center',
              });
            } else {
              toast.success('비공개로 전환했습니다.', { position: 'top-center' });
            }
          },
          onError: () => {
            toast.error('공개 설정을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.', {
              position: 'top-center',
            });
          },
        },
      );
    },
    [data, patchMutation],
  );

  const startEdit = useCallback(() => {
    if (!data) return;
    setEditTitle(data.title);
    setEditHtml(data.html_content ?? '');
    setShowHtmlPreview(false);
    setIsEditing(true);
  }, [data]);

  const cancelEdit = useCallback(() => {
    if (!data) return;
    setEditTitle(data.title);
    setEditHtml(data.html_content ?? '');
    setShowHtmlPreview(true);
    setIsEditing(false);
  }, [data]);

  const handleDownloadPdf = useCallback(async () => {
    if (!data) return;
    setPdfDownloading(true);
    try {
      const detail = await getPortfolioCvById(data.id);
      const html = detail.html_content?.trim() ?? '';
      if (!html) {
        toast.info('다운로드할 HTML 내용이 없습니다.', { position: 'top-center' });
        return;
      }
      await downloadCvHtmlAsA4Pdf({
        htmlContent: html,
        fileNameBase: detail.title || `portfolio-${detail.id}`,
      });
      toast.success('PDF를 저장했습니다.', { position: 'top-center' });
    } catch {
      toast.error('PDF를 만들지 못했습니다. 잠시 후 다시 시도해 주세요.', {
        position: 'top-center',
      });
    } finally {
      setPdfDownloading(false);
    }
  }, [data]);

  const handleConfirmEdit = useCallback(() => {
    if (!data) return;
    const title = editTitle.trim();
    if (!title) {
      toast.warn('제목을 입력해 주세요.', { position: 'top-center' });
      return;
    }
    const html_content = sanitizeCvHtml(editHtml);
    patchMutation.mutate(
      { id: data.id, body: { title, html_content } },
      {
        onSuccess: () => {
          toast.success('저장되었습니다.', { position: 'top-center' });
          setShowHtmlPreview(true);
          setIsEditing(false);
        },
        onError: () => {
          toast.error('저장에 실패했습니다. 잠시 후 다시 시도해 주세요.', {
            position: 'top-center',
          });
        },
      },
    );
  }, [data, editHtml, editTitle, patchMutation]);

  const subtitlePad = layout === 'panel' ? '1.25rem' : '1.75rem';

  return (
    <>
    <Flex.Column width="100%" style={{ flex: 1, minHeight: 0, minWidth: 0 }}>
      <S.HeaderBar direction="column" gap="0.5rem" $layout={layout}>
        <Flex.Row align="flex-start" justify="space-between" gap="0.75rem" wrap="wrap">
          {isEditing && data ? (
            <Flex.Column gap="0.35rem" style={{ flex: '1 1 12rem', minWidth: 0 }}>
              <Flex.Row align="center" gap="0.5rem" style={{ minWidth: 0 }}>
                <BusinessIcon sx={{ fontSize: 22, color: palette.blue500, flexShrink: 0 }} />
                <Input
                  value={editTitle}
                  onChange={e => setEditTitle(e.target.value)}
                  size="small"
                  fullWidth
                  inputProps={{
                    maxLength: 200,
                    'aria-label': '포트폴리오 제목',
                  }}
                  sx={{
                    minWidth: 0,
                    '& .MuiOutlinedInput-root': {
                      borderRadius: '0.5rem',
                      backgroundColor: palette.white,
                      fontSize: '1rem',
                      fontWeight: 700,
                      lineHeight: 1.35,
                    },
                    '& .MuiOutlinedInput-notchedOutline': {
                      borderColor: palette.grey200,
                    },
                    '& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline': {
                      borderColor: palette.grey300,
                    },
                    '& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': {
                      borderColor: palette.blue500,
                    },
                  }}
                />
              </Flex.Row>
              <Text
                margin="0"
                color={palette.grey600}
                style={{ fontSize: '0.875rem', paddingLeft: subtitlePad }}
              >
                — {data.target_position}
              </Text>
            </Flex.Column>
          ) : (
            <Flex.Row align="center" gap="0.5rem" style={{ flex: '1 1 auto', minWidth: 0 }}>
              <BusinessIcon sx={{ fontSize: 22, color: palette.blue500, flexShrink: 0 }} />
              <Text
                as="h2"
                style={{
                  margin: 0,
                  color: palette.nearBlack,
                  fontSize: '1.125rem',
                  fontWeight: 700,
                  lineHeight: 1.35,
                  wordBreak: 'break-word',
                }}
              >
                {data ? `${data.title} — ${data.target_position}` : '포트폴리오 미리보기'}
              </Text>
            </Flex.Row>
          )}
          <Flex.Row
            align="center"
            gap="0.5rem"
            wrap="wrap"
            style={{ flexShrink: 0, justifyContent: 'flex-end' }}
          >
            {data && !isPending ? (
              isEditing ? (
                <>
                  <Button
                    label="취소"
                    variant="outlined"
                    color="grey"
                    size="medium"
                    onClick={cancelEdit}
                    disabled={patchPending}
                  />
                  <Button
                    label="확인"
                    variant="outlined"
                    color="blue"
                    size="medium"
                    onClick={handleConfirmEdit}
                    disabled={patchPending}
                  />
                  {onRequestDelete ? (
                    <Button
                      label="삭제"
                      variant="outlined"
                      color="red"
                      size="medium"
                      icon={DeleteOutlineIconWrap}
                      iconPosition="start"
                      onClick={onRequestDelete}
                      disabled={actionDisabled}
                    />
                  ) : null}
                </>
              ) : (
                <Button
                  label="수정"
                  variant="outlined"
                  color="blue"
                  size="medium"
                  icon={EditIconWrap}
                  iconPosition="start"
                  onClick={startEdit}
                  disabled={actionDisabled}
                />
              )
            ) : null}
            {showCloseButton ? (
              <IconButton
                type="button"
                onClick={onClose}
                aria-label={closeAriaLabel}
                size="small"
                sx={{
                  color: palette.grey600,
                  flexShrink: 0,
                  backgroundColor: palette.white,
                  border: `1px solid ${palette.grey200}`,
                  '&:hover': { backgroundColor: palette.grey100 },
                }}
              >
                <CloseIcon />
              </IconButton>
            ) : null}
          </Flex.Row>
        </Flex.Row>

        {data ? (
          <Flex.Row align="center" gap="0.35rem" wrap="wrap">
            <CalendarTodayIcon sx={{ fontSize: 18, color: palette.grey500 }} />
            <Text margin="0" color={palette.grey600} style={{ fontSize: '0.875rem' }}>
              {formatDateTime(data.updated_at)}
            </Text>
            <Text margin="0" color={palette.grey400} style={{ fontSize: '0.75rem' }}>
              (생성 {formatDateTime(data.created_at)})
            </Text>
          </Flex.Row>
        ) : null}
      </S.HeaderBar>

      <S.ScrollBody
        direction="column"
        gap="1.25rem"
        $layout={layout}
        $loading={isPending}
      >
        {isPending ? (
          <S.LoadingArea
            align="center"
            justify="center"
            gap="0.75rem"
            width="100%"
            role="status"
            aria-live="polite"
            $layout={layout}
          >
            <LoadingIcon width={88} height={88} aria-hidden />
            <Text margin="0" color={palette.grey600} style={{ fontSize: '0.875rem' }}>
              포트폴리오 정보를 불러오는 중입니다…
            </Text>
          </S.LoadingArea>
        ) : null}
        {isError ? (
          <Text margin="0" color={palette.pink500} style={{ fontSize: '0.875rem' }}>
            불러오지 못했습니다.
          </Text>
        ) : null}
        {!isPending && data ? (
          <>
            <S.Section direction="column" gap="0.65rem">
              {!isEditing ? (
                <CvHtmlPublicSettingsRow
                  title="HTML 공개 설정"
                  guide="공개 시 링크만으로 로그인 없이 미리보기가 가능합니다."
                  isPublic={Boolean(data.is_public)}
                  onPublicChange={handleTogglePublic}
                  disabled={publicToggleDisabled}
                  size="small"
                  appearance="filled"
                  htmlPreviewSrcDoc={htmlPreviewSrcDoc}
                  linkButton={{
                    label: '링크 바로가기',
                    onClick: handleOpenPublicShare,
                    disabled: publicToggleDisabled,
                  }}
                />
              ) : (
                <>
                  <S.SectionTitle>HTML 공개 설정</S.SectionTitle>
                  <Text margin="0" color={palette.grey500} style={{ fontSize: '0.8125rem' }}>
                    HTML 본문을 수정하는 동안에는 공개 설정을 바꿀 수 없습니다.
                  </Text>
                </>
              )}
            </S.Section>

            <S.Section direction="column" gap="0.5rem">
              <S.SectionTitle>공고 정보</S.SectionTitle>
              <S.BodyBox>{data.job_posting || '—'}</S.BodyBox>
            </S.Section>

            <S.Section direction="column" gap="0.5rem">
              <S.SectionTitle>추가 요청사항</S.SectionTitle>
              {pills.length > 0 ? (
                <Flex.Row gap="0.5rem" wrap="wrap">
                  {pills.map(tag => (
                    <S.Pill key={tag}>{tag}</S.Pill>
                  ))}
                </Flex.Row>
              ) : (
                <Text margin="0" color={palette.grey500} style={{ fontSize: '0.8125rem' }}>
                  —
                </Text>
              )}
              {data.additional_notes && pills.length === 0 ? (
                <S.BodyBox>{data.additional_notes}</S.BodyBox>
              ) : null}
            </S.Section>

            <S.Section direction="column" gap="0.5rem">
              <Flex.Row
                align="center"
                justify="space-between"
                gap="0.75rem"
                wrap="nowrap"
                width="100%"
                style={{ minWidth: 0 }}
              >
                <S.SectionTitle>프롬프트</S.SectionTitle>
                {!isEditing ? (
                  <S.InlineActionsScroll>
                    <Flex.Row
                      align="center"
                      gap="0.5rem"
                      wrap="nowrap"
                      style={{ flexShrink: 0, width: 'max-content' }}
                    >
                      <Button
                        label="크게 보기"
                        variant="outlined"
                        color="blue"
                        size="small"
                        icon={OpenInFullIconWrap}
                        iconPosition="start"
                        onClick={() => setExpandPromptOpen(true)}
                        disabled={!data.prompt?.trim()}
                      />
                      <Button
                        label="복사하기"
                        variant="outlined"
                        color="blue"
                        size="small"
                        icon={CopyIconWrap}
                        iconPosition="start"
                        onClick={handleCopyPrompt}
                        disabled={!data.prompt?.trim()}
                      />
                    </Flex.Row>
                  </S.InlineActionsScroll>
                ) : null}
              </Flex.Row>
              {designPrefsSummary ? (
                <Flex.Column gap="0.35rem" width="100%" style={{ minWidth: 0 }}>
                  <Text
                    margin="0"
                    color={palette.grey600}
                    style={{
                      fontSize: '0.6875rem',
                      fontWeight: 600,
                      letterSpacing: '0.02em',
                    }}
                  >
                    AI 맞춤 디자인 (생성 시 설정)
                  </Text>
                  <S.DesignPrefsStrip $soft={designPrefsSummary.soft}>
                    <Flex.Row gap="0.35rem" wrap="wrap" align="center" width="100%" style={{ minWidth: 0 }}>
                      {designPrefsSummary.layout ? (
                        <S.DesignPrefTag
                          $accent={designPrefsSummary.accent}
                          $soft={designPrefsSummary.soft}
                          title="레이아웃"
                        >
                          레이아웃 · {designPrefsSummary.layout}
                        </S.DesignPrefTag>
                      ) : null}
                      {designPrefsSummary.themeLabel ? (
                        <S.DesignPrefTag
                          $accent={designPrefsSummary.accent}
                          $soft={designPrefsSummary.soft}
                          title="색상 테마"
                        >
                          색상 · {designPrefsSummary.themeLabel}
                        </S.DesignPrefTag>
                      ) : null}
                      {designPrefsSummary.density ? (
                        <S.DesignPrefTag
                          $accent={designPrefsSummary.accent}
                          $soft={designPrefsSummary.soft}
                          title="정보량"
                        >
                          정보량 · {designPrefsSummary.density}
                        </S.DesignPrefTag>
                      ) : null}
                    </Flex.Row>
                    {designPrefsSummary.notes ? (
                      <S.DesignPrefNotes>{designPrefsSummary.notes}</S.DesignPrefNotes>
                    ) : null}
                  </S.DesignPrefsStrip>
                </Flex.Column>
              ) : null}
              <S.PreWrapScrollable $layout={layout}>{data.prompt || '—'}</S.PreWrapScrollable>
            </S.Section>

            <S.Section direction="column" gap="0.65rem">
              <Flex.Row
                align="center"
                justify="space-between"
                gap="0.75rem"
                wrap="nowrap"
                width="100%"
                style={{ minWidth: 0 }}
              >
                <S.SectionTitle>AI 생성 결과 (HTML)</S.SectionTitle>
                {!isEditing ? (
                  <S.InlineActionsScroll>
                    <Flex.Row
                      align="center"
                      gap="0.5rem"
                      wrap="nowrap"
                      style={{ flexShrink: 0, width: 'max-content' }}
                    >
                      <Button
                        label="크게 보기"
                        variant="outlined"
                        color="blue"
                        size="small"
                        icon={OpenInFullIconWrap}
                        iconPosition="start"
                        onClick={() => setExpandHtmlOpen(true)}
                        disabled={!htmlRaw.trim() || pdfDownloading}
                      />
                      <Button
                        label="PDF 다운로드"
                        variant="outlined"
                        color="blue"
                        size="small"
                        icon={PictureAsPdfIconWrap}
                        iconPosition="start"
                        onClick={handleDownloadPdf}
                        disabled={
                          !htmlRaw.trim() || pdfDownloading || !data
                        }
                      />
                      <Button
                        label={showHtmlPreview ? '소스 보기' : 'HTML 미리보기'}
                        variant="outlined"
                        color="blue"
                        size="small"
                        icon={showHtmlPreview ? CodeIconWrap : HtmlIconWrap}
                        iconPosition="start"
                        onClick={() => setShowHtmlPreview(v => !v)}
                        disabled={!htmlRaw.trim() || pdfDownloading}
                      />
                      <Button
                        label="복사하기"
                        variant="outlined"
                        color="blue"
                        size="small"
                        icon={CopyIconWrap}
                        iconPosition="start"
                        onClick={handleCopyHtml}
                        disabled={!htmlRaw.trim() || pdfDownloading}
                      />
                    </Flex.Row>
                  </S.InlineActionsScroll>
                ) : null}
              </Flex.Row>
              <Flex.Column gap="0.5rem" width="100%" style={{ minWidth: 0 }}>
                {isEditing ? (
                  <Input
                    multiline
                    value={editHtml}
                    onChange={e => setEditHtml(e.target.value)}
                    rows={14}
                    size="small"
                    fullWidth
                    inputProps={{
                      'aria-label': 'HTML 소스',
                      style: { fontFamily: 'ui-monospace, monospace' },
                    }}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        borderRadius: '0.5rem',
                        backgroundColor: palette.white,
                      },
                      '& .MuiOutlinedInput-notchedOutline': {
                        borderColor: palette.grey200,
                      },
                      '& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline': {
                        borderColor: palette.grey300,
                      },
                      '& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': {
                        borderColor: palette.blue500,
                      },
                      '& textarea': {
                        ...hideScrollbar,
                        fontFamily: 'ui-monospace, monospace',
                        fontSize: '0.8125rem',
                        lineHeight: 1.5,
                        resize: 'vertical',
                      },
                    }}
                  />
                ) : showHtmlPreview ? (
                  <S.HtmlPreviewShell $layout={layout}>
                    <iframe
                      title="HTML 미리보기"
                      srcDoc={htmlPreviewSrcDoc}
                      sandbox={CV_PREVIEW_IFRAME_SANDBOX}
                      referrerPolicy="no-referrer"
                    />
                  </S.HtmlPreviewShell>
                ) : (
                  <S.PreWrapScrollable $layout={layout}>
                    {htmlRaw.trim() ? htmlRaw : '—'}
                  </S.PreWrapScrollable>
                )}
              </Flex.Column>
            </S.Section>
          </>
        ) : null}
      </S.ScrollBody>
    </Flex.Column>

    <Dialog
      open={expandPromptOpen}
      onClose={() => setExpandPromptOpen(false)}
      maxWidth={false}
      fullWidth
      aria-labelledby="cv-expand-prompt-title"
      PaperProps={{
        sx: CV_EXPAND_MODAL_PAPER_SX,
      }}
    >
      <DialogContent
        sx={{
          p: '1rem 1.25rem 1.25rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem',
          overflow: 'hidden',
          flex: '1 1 auto',
          minHeight: 0,
        }}
      >
        <Flex.Row align="center" justify="space-between" gap="0.75rem" wrap="wrap" width="100%">
          <Text
            id="cv-expand-prompt-title"
            as="h3"
            margin="0"
            bold
            color={palette.nearBlack}
            style={{ fontSize: '1rem', lineHeight: 1.4 }}
          >
            프롬프트
          </Text>
          <IconButton
            type="button"
            onClick={() => setExpandPromptOpen(false)}
            aria-label="닫기"
            size="small"
            sx={{
              color: palette.grey600,
              flexShrink: 0,
              backgroundColor: palette.white,
              border: `1px solid ${palette.grey200}`,
              '&:hover': { backgroundColor: palette.grey100 },
            }}
          >
            <CloseIcon />
          </IconButton>
        </Flex.Row>
        <S.ModalPreScroll>{data?.prompt?.trim() ? data.prompt : '—'}</S.ModalPreScroll>
      </DialogContent>
    </Dialog>

    <Dialog
      open={expandHtmlOpen}
      onClose={() => setExpandHtmlOpen(false)}
      maxWidth={false}
      fullWidth
      aria-labelledby="cv-expand-html-title"
      PaperProps={{
        sx: CV_EXPAND_MODAL_PAPER_SX,
      }}
    >
      <DialogContent
        sx={{
          p: '1rem 1.25rem 1.25rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem',
          overflow: 'hidden',
          flex: '1 1 auto',
          minHeight: 0,
        }}
      >
        <Flex.Row align="center" justify="space-between" gap="0.75rem" wrap="wrap" width="100%">
          <Text
            id="cv-expand-html-title"
            as="h3"
            margin="0"
            bold
            color={palette.nearBlack}
            style={{ fontSize: '1rem', lineHeight: 1.4 }}
          >
            {showHtmlPreview ? 'AI 생성 결과 (HTML 미리보기)' : 'AI 생성 결과 (소스)'}
          </Text>
          <IconButton
            type="button"
            onClick={() => setExpandHtmlOpen(false)}
            aria-label="닫기"
            size="small"
            sx={{
              color: palette.grey600,
              flexShrink: 0,
              backgroundColor: palette.white,
              border: `1px solid ${palette.grey200}`,
              '&:hover': { backgroundColor: palette.grey100 },
            }}
          >
            <CloseIcon />
          </IconButton>
        </Flex.Row>
        {showHtmlPreview ? (
          <S.ModalIframeShell>
            <iframe
              title="HTML 크게 보기"
              srcDoc={htmlPreviewSrcDoc}
              sandbox={CV_PREVIEW_IFRAME_SANDBOX}
              referrerPolicy="no-referrer"
            />
          </S.ModalIframeShell>
        ) : (
          <S.ModalPreScroll>
            {htmlRaw.trim() ? htmlRaw : '—'}
          </S.ModalPreScroll>
        )}
      </DialogContent>
    </Dialog>
    </>
  );
};

export default CvPreviewContent;

const S = {
  HeaderBar: styled(Flex.Column, {
    shouldForwardProp: p => p !== '$layout',
  })<{ $layout: CvPreviewContentLayout }>`
    flex-shrink: 0;
    width: 100%;
    box-sizing: border-box;
    background-color: ${palette.blue300};
    border-bottom: 1px solid ${palette.grey200};
    padding: ${({ $layout }) =>
      $layout === 'panel' ? '0.875rem 1rem 0.75rem' : '1rem 2.75rem'};
  `,
  ScrollBody: styled(Flex.Column, {
    shouldForwardProp: p => p !== '$loading' && p !== '$layout',
  })<{ $layout: CvPreviewContentLayout; $loading?: boolean }>`
    flex: 1 1 auto;
    min-height: 0;
    overflow-y: ${({ $loading }) => ($loading ? 'hidden' : 'auto')};
    background-color: ${palette.white};
    padding: ${({ $layout, $loading }) => {
      if ($loading) return '0';
      return $layout === 'panel' ? '1rem 1.25rem 1.25rem' : '1.25rem 2.75rem 1.5rem';
    }};
    scrollbar-width: none;
    -ms-overflow-style: none;
    &::-webkit-scrollbar {
      display: none;
    }
  `,
  LoadingArea: styled(Flex.Column, {
    shouldForwardProp: p => p !== '$layout',
  })<{ $layout: CvPreviewContentLayout }>`
    flex: 1 1 auto;
    min-height: ${({ $layout }) =>
      $layout === 'panel' ? 'min(40vh, 280px)' : 'min(52vh, 380px)'};
    width: 100%;
    box-sizing: border-box;
    padding: 1.5rem 1.25rem;
  `,
  Section: styled(Flex.Column)`
    width: 100%;
    min-width: 0;
    padding-bottom: 1rem;
    border-bottom: 1px solid ${palette.grey200};
    &:last-of-type {
      border-bottom: none;
      padding-bottom: 0;
    }
  `,
  SectionTitle: styled('span')`
    display: inline-block;
    margin: 0;
    font-size: 0.8125rem;
    font-weight: 700;
    color: ${palette.grey600};
    flex-shrink: 0;
  `,
  InlineActionsScroll: styled('div')`
    display: flex;
    flex: 1 1 auto;
    min-width: 0;
    max-width: 100%;
    overflow-x: auto;
    overflow-y: hidden;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
    -ms-overflow-style: none;
    &::-webkit-scrollbar {
      display: none;
    }
  `,
  BodyBox: styled('div')`
    margin: 0;
    padding: 0.75rem 1rem;
    font-size: 0.875rem;
    line-height: 1.55;
    color: ${palette.nearBlack};
    background-color: ${palette.grey100};
    border-radius: 0.5rem;
    border: 1px solid ${palette.grey200};
    white-space: pre-wrap;
    word-break: break-word;
  `,
  PreWrapScrollable: styled('pre', {
    shouldForwardProp: p => p !== '$layout',
  })<{ $layout: CvPreviewContentLayout }>`
    margin: 0;
    padding: 0.75rem 1rem;
    max-height: ${({ $layout }) =>
      $layout === 'panel' ? 'min(36vh, 320px)' : 'min(42vh, 400px)'};
    overflow: auto;
    font-size: 0.8125rem;
    line-height: 1.5;
    white-space: pre-wrap;
    word-break: break-word;
    color: ${palette.nearBlack};
    background-color: ${palette.grey100};
    border-radius: 0.5rem;
    border: 1px solid ${palette.grey200};
    font-family: ui-monospace, monospace;
    scrollbar-width: none;
    -ms-overflow-style: none;
    &::-webkit-scrollbar {
      display: none;
    }
  `,
  ModalPreScroll: styled('pre')`
    margin: 0;
    flex: 1 1 auto;
    min-height: 0;
    overflow: auto;
    padding: 0.85rem 1rem;
    font-size: 0.8125rem;
    line-height: 1.55;
    white-space: pre-wrap;
    word-break: break-word;
    color: ${palette.nearBlack};
    background-color: ${palette.grey100};
    border-radius: 0.5rem;
    border: 1px solid ${palette.grey200};
    font-family: ui-monospace, monospace;
    box-sizing: border-box;
    scrollbar-width: none;
    -ms-overflow-style: none;
    &::-webkit-scrollbar {
      display: none;
    }
  `,
  ModalIframeShell: styled('div')`
    flex: 1 1 auto;
    min-height: 0;
    border-radius: 0.5rem;
    border: 1px solid ${palette.grey200};
    overflow: hidden;
    background-color: ${palette.white};
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
    & > iframe {
      display: block;
      flex: 1 1 auto;
      width: 100%;
      min-height: 0;
      border: none;
    }
  `,
  HtmlPreviewShell: styled('div', {
    shouldForwardProp: p => p !== '$layout',
  })<{ $layout: CvPreviewContentLayout }>`
    border-radius: 0.5rem;
    border: 1px solid ${palette.grey200};
    overflow: hidden;
    background-color: ${palette.white};
    min-height: 3rem;
    & > iframe {
      display: block;
      width: 100%;
      min-height: ${({ $layout }) =>
        $layout === 'panel' ? 'min(32vh, 280px)' : 'min(42vh, 400px)'};
      height: ${({ $layout }) =>
        $layout === 'panel' ? 'min(42vh, 360px)' : 'min(50vh, 480px)'};
      border: none;
    }
  `,
  Pill: styled('span')`
    display: inline-flex;
    align-items: center;
    padding: 0.25rem 0.65rem;
    font-size: 0.75rem;
    font-weight: 500;
    color: ${palette.nearBlack};
    background-color: ${palette.blue300};
    border: 1px solid ${palette.grey200};
    border-radius: 2rem;
  `,
  DesignPrefsStrip: styled('div', {
    shouldForwardProp: p => p !== '$soft',
  })<{ $soft: string }>`
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    width: 100%;
    min-width: 0;
    box-sizing: border-box;
    padding: 0.65rem 0.8rem 0.7rem;
    border-radius: 0.5rem;
    border: 1px solid ${palette.grey200};
    background: ${({ $soft }) =>
      `linear-gradient(120deg, ${$soft}4d 0%, ${palette.white} 55%, ${palette.grey100} 100%)`};
  `,
  DesignPrefTag: styled('span', {
    shouldForwardProp: p => p !== '$accent' && p !== '$soft',
  })<{ $accent: string; $soft: string }>`
    display: inline-flex;
    align-items: center;
    max-width: 100%;
    box-sizing: border-box;
    padding: 0.22rem 0.55rem;
    font-size: 0.6875rem;
    font-weight: 700;
    line-height: 1.35;
    letter-spacing: -0.01em;
    color: ${({ $accent }) => $accent};
    background-color: ${({ $soft }) => `${$soft}40`};
    border: 1px solid ${({ $accent }) => `${$accent}55`};
    border-radius: 999px;
    word-break: break-word;
  `,
  DesignPrefNotes: styled('div')`
    margin: 0;
    padding: 0.5rem 0.6rem;
    font-size: 0.8125rem;
    line-height: 1.55;
    color: ${palette.nearBlack};
    background-color: ${palette.white};
    border-radius: 0.4rem;
    border: 1px solid ${palette.grey200};
    white-space: pre-wrap;
    word-break: break-word;
  `,
};
