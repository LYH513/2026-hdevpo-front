import { LoadingIcon } from '@/assets';
import { Button, Flex, Heading, Input, Text } from '@/components';
import { MAX_RESPONSIVE_WIDTH } from '@/constants/system';
import { palette } from '@/styles/palette';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { Dialog, DialogContent, useMediaQuery, useTheme } from '@mui/material';
import { styled } from '@mui/material/styles';
import { isAxiosError } from 'axios';
import { useCallback, useMemo, useState, type FunctionComponent, type SVGProps } from 'react';
import { toast } from 'react-toastify';

import type { PortfolioCvDetail } from '../../apis/cv';
import {
  CV_COLOR_THEME_SWATCHES,
  CV_CUSTOMIZE_COLOR_THEME_LABELS,
  CV_CUSTOMIZE_COLOR_THEME_VALUES,
  CV_CUSTOMIZE_DENSITY_VALUES,
  CV_CUSTOMIZE_LAYOUT_VALUES,
  CV_CUSTOMIZE_MAX_ADDITIONAL_NOTES,
  CV_CUSTOMIZE_MAX_SHORT_FIELD,
  type CvCustomizeColorThemeValue,
  type CvCustomizeDensityValue,
  type CvCustomizeLayoutValue,
} from '../../constants/cvDesignCustomizeConstants';
import usePostPortfolioCvGenerateHtmlMutation from '../../hooks/usePostPortfolioCvGenerateHtmlMutation';

import { CvGeneratePageS as WizS } from '../cvGeneratePageStyles';

const ArrowForwardIconWrap: FunctionComponent<SVGProps<SVGSVGElement>> = () => (
  <ArrowForwardIcon sx={{ fontSize: 20 }} />
);

function clampField(s: string, max: number): string {
  const t = s.trim();
  if (t.length <= max) return t;
  return t.slice(0, max);
}

function toastGenerateHtmlError(error: unknown) {
  if (isAxiosError(error)) {
    const status = error.response?.status;
    if (status === 503) {
      toast.error('서비스 설정이 완료되지 않았습니다. 잠시 후 다시 시도해 주세요.');
      return;
    }
    if (status === 502) {
      toast.error('AI 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.');
      return;
    }
    if (status === 504) {
      toast.error('요청 시간이 초과되었습니다. 프롬프트는 저장되었으니 같은 버튼으로 다시 시도해 주세요.');
      return;
    }
  }
  toast.error('HTML 생성에 실패했습니다. 잠시 후 다시 시도해 주세요.');
}

function LayoutPreview({ layout }: { layout: CvCustomizeLayoutValue }) {
  const bar = (flex?: string, h = '0.35rem') => (
    <div
      style={{
        height: h,
        borderRadius: 3,
        backgroundColor: palette.grey300,
        flex: flex ?? '1 1 auto',
        minWidth: 0,
      }}
    />
  );
  const cell = (bg: string) => (
    <div
      style={{
        flex: '1 1 0',
        minHeight: '0.55rem',
        borderRadius: 3,
        backgroundColor: bg,
      }}
    />
  );

  if (layout === '단일 칼럼') {
    return (
      <Flex.Column gap="0.2rem" width="100%" height="100%" style={{ padding: '0.35rem', boxSizing: 'border-box' }}>
        {bar()}
        {bar('0.75 1 auto')}
        {bar()}
        {bar('0.5 1 auto')}
      </Flex.Column>
    );
  }
  if (layout === '랜딩 페이지') {
    return (
      <Flex.Column gap="0.25rem" width="100%" height="100%" style={{ padding: '0.35rem', boxSizing: 'border-box' }}>
        <div
          style={{
            height: '1.1rem',
            borderRadius: 4,
            backgroundColor: palette.blue300,
            border: `1px solid ${palette.blue400}`,
          }}
        />
        <Flex.Row gap="0.2rem" style={{ flex: '1 1 auto', minHeight: 0 }}>
          <Flex.Column gap="0.15rem" style={{ flex: '1 1 55%', minWidth: 0 }}>
            {bar()}
            {bar('0.6 1 auto')}
          </Flex.Column>
          <Flex.Column gap="0.15rem" style={{ flex: '1 1 45%', minWidth: 0 }}>
            {bar()}
            {bar()}
          </Flex.Column>
        </Flex.Row>
      </Flex.Column>
    );
  }
  if (layout === '사이드바') {
    return (
      <Flex.Row gap="0.2rem" width="100%" height="100%" style={{ padding: '0.35rem', boxSizing: 'border-box' }}>
        <Flex.Column
          gap="0.15rem"
          style={{
            flex: '0 0 30%',
            minWidth: 0,
            borderRadius: 4,
            backgroundColor: palette.grey200,
            padding: '0.25rem',
            boxSizing: 'border-box',
          }}
        >
          {bar()}
          {bar()}
          {bar('0.4 1 auto')}
        </Flex.Column>
        <Flex.Column gap="0.15rem" style={{ flex: '1 1 auto', minWidth: 0 }}>
          {bar()}
          {bar()}
          {bar('0.5 1 auto')}
        </Flex.Column>
      </Flex.Row>
    );
  }
  /* 카드 그리드 */
  return (
    <Flex.Column gap="0.2rem" width="100%" height="100%" style={{ padding: '0.35rem', boxSizing: 'border-box' }}>
      <Flex.Row gap="0.2rem" style={{ flex: '1 1 0', minHeight: 0 }}>
        {cell(palette.grey300)}
        {cell(palette.grey300)}
      </Flex.Row>
      <Flex.Row gap="0.2rem" style={{ flex: '1 1 0', minHeight: 0 }}>
        {cell(palette.grey200)}
        {cell(palette.blue300)}
      </Flex.Row>
    </Flex.Column>
  );
}

export interface CvGenerateStep3CustomizeProps {
  onPrevToPromptStep: () => void;
  cvId: number | null;
  onGenerateHtmlSuccess: (detail: PortfolioCvDetail) => void;
}

const CvGenerateStep3Customize = ({
  onPrevToPromptStep,
  cvId,
  onGenerateHtmlSuccess,
}: CvGenerateStep3CustomizeProps) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(MAX_RESPONSIVE_WIDTH);
  const generateHtmlMutation = usePostPortfolioCvGenerateHtmlMutation();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const [layout, setLayout] = useState<CvCustomizeLayoutValue>(CV_CUSTOMIZE_LAYOUT_VALUES[0]);
  const [colorTheme, setColorTheme] = useState<CvCustomizeColorThemeValue>('indigo');
  const [density, setDensity] = useState<CvCustomizeDensityValue>(CV_CUSTOMIZE_DENSITY_VALUES[0]);
  const [additionalNotes, setAdditionalNotes] = useState('');

  const notesLen = additionalNotes.length;
  const notesOver = notesLen > CV_CUSTOMIZE_MAX_ADDITIONAL_NOTES;

  const designPreferencesPayload = useMemo(
    () => ({
      layout: clampField(layout, CV_CUSTOMIZE_MAX_SHORT_FIELD),
      color_theme: clampField(colorTheme, CV_CUSTOMIZE_MAX_SHORT_FIELD),
      density: clampField(density, CV_CUSTOMIZE_MAX_SHORT_FIELD),
      additional_notes: clampField(additionalNotes, CV_CUSTOMIZE_MAX_ADDITIONAL_NOTES),
    }),
    [layout, colorTheme, density, additionalNotes],
  );

  const runGenerateHtml = useCallback(() => {
    if (cvId == null) {
      toast.warn('CV를 찾을 수 없습니다. 먼저 프롬프트를 생성해 주세요.');
      return;
    }
    if (notesOver) {
      toast.warn(`추가 프롬프트 입력은 ${CV_CUSTOMIZE_MAX_ADDITIONAL_NOTES}자 이하로 입력해 주세요.`);
      return;
    }
    generateHtmlMutation.mutate(
      { id: cvId, body: { design_preferences: designPreferencesPayload } },
      {
        onSuccess: onGenerateHtmlSuccess,
        onError: err => {
          toastGenerateHtmlError(err);
        },
      },
    );
  }, [cvId, designPreferencesPayload, notesOver, onGenerateHtmlSuccess, generateHtmlMutation]);

  const handleOpenConfirm = useCallback(() => {
    if (cvId == null) {
      toast.warn('CV를 찾을 수 없습니다. 먼저 프롬프트를 생성해 주세요.');
      return;
    }
    if (notesOver) {
      toast.warn(`추가 프롬프트 입력은 ${CV_CUSTOMIZE_MAX_ADDITIONAL_NOTES}자 이하로 입력해 주세요.`);
      return;
    }
    setConfirmOpen(true);
  }, [cvId, notesOver]);

  const pending = generateHtmlMutation.isPending;

  return (
    <Flex.Column gap="1.25rem" width="100%" style={{ marginTop: '1.5rem', minWidth: 0 }}>
      <Flex.Column gap="0.35rem" width="100%">
        <Heading as="h3" margin="0" color={theme.palette.text.primary}>
          AI 커스터마이징
        </Heading>
        <Text
          margin="0"
          style={{
            ...theme.typography.body2,
            color: theme.palette.grey[600],
            lineHeight: 1.6,
          }}
        >
          레이아웃·색상 테마·정보량을 골라 주시고, 필요하면 맨 아래에 추가 프롬프트를 입력해주세요.
          「AI 결과 생성하기」를 누르면 맞춤 프롬프트와 포트폴리오 HTML이 만들어져요. 완성된 HTML은
          다음 단계에서 바로 확인하고 수정할 수 있습니다.
        </Text>
      </Flex.Column>

      <S.PanelShell>
        <S.Panel>
        <S.SectionTitle>스타일 · 레이아웃</S.SectionTitle>
        <Flex.Row gap="0.65rem" wrap="wrap" width="100%" style={{ minWidth: 0 }}>
          {CV_CUSTOMIZE_LAYOUT_VALUES.map(value => {
            const selected = layout === value;
            return (
              <S.LayoutChoice
                key={value}
                type="button"
                $selected={selected}
                onClick={() => setLayout(value)}
                aria-pressed={selected}
                aria-label={`레이아웃 ${value}`}
              >
                <S.PreviewPane>
                  <LayoutPreview layout={value} />
                </S.PreviewPane>
                <S.LayoutLabel $selected={selected}>{value}</S.LayoutLabel>
              </S.LayoutChoice>
            );
          })}
        </Flex.Row>

        <S.SectionTitle style={{ marginTop: '1.25rem' }}>색상 테마</S.SectionTitle>
        <Flex.Row gap="0.55rem" wrap="wrap" width="100%" style={{ minWidth: 0 }}>
          {CV_CUSTOMIZE_COLOR_THEME_VALUES.map(key => {
            const sw = CV_COLOR_THEME_SWATCHES[key];
            const selected = colorTheme === key;
            return (
              <S.ColorChoice
                key={key}
                type="button"
                $selected={selected}
                onClick={() => setColorTheme(key)}
                aria-pressed={selected}
                aria-label={`색상 ${CV_CUSTOMIZE_COLOR_THEME_LABELS[key]}`}
              >
                <Flex.Row align="center" justify="center" gap="0.25rem" width="100%">
                  <S.SwatchDot $color={sw.primary} />
                  <S.SwatchDot $color={sw.secondary} />
                  <S.SwatchDot $color={sw.soft} />
                </Flex.Row>
                <S.ColorLabel $selected={selected}>{CV_CUSTOMIZE_COLOR_THEME_LABELS[key]}</S.ColorLabel>
              </S.ColorChoice>
            );
          })}
        </Flex.Row>

        <S.SectionTitle style={{ marginTop: '1.25rem' }}>정보량</S.SectionTitle>
        <Flex.Row gap="0.55rem" wrap="wrap" width="100%">
          {CV_CUSTOMIZE_DENSITY_VALUES.map(value => {
            const selected = density === value;
            return (
              <S.DensityChip
                key={value}
                type="button"
                $selected={selected}
                onClick={() => setDensity(value)}
                aria-pressed={selected}
              >
                {value}
              </S.DensityChip>
            );
          })}
        </Flex.Row>

        <S.SectionTitle style={{ marginTop: '1.25rem' }}>추가 프롬프트 입력</S.SectionTitle>
        <Text
          margin="0 0 0.35rem 0"
          style={{
            ...theme.typography.caption,
            color: theme.palette.text.secondary,
            lineHeight: 1.5,
          }}
        >
          프로젝트(레포)를 메인으로 보이게 할지, 마일리지·교외 활동을 앞쪽에서 부각할지 등 원하는
          강조점을 적어 주세요.
        </Text>
        <Input
          multiline
          minRows={isMobile ? 3 : 4}
          fullWidth
          value={additionalNotes}
          onChange={e => setAdditionalNotes(e.target.value)}
          placeholder="예: GitHub 프로젝트 섹션을 가장 크게·기술 스택과 함께 상세히 / 마일리지·대외활동은 상단 요약 카드로 눈에 띄게 / 수상·자격은 짧게 한 줄씩만"
          inputProps={{
            maxLength: CV_CUSTOMIZE_MAX_ADDITIONAL_NOTES,
            'aria-label': '추가 프롬프트 입력',
          }}
          sx={{
            '& .MuiOutlinedInput-root': {
              borderRadius: '0.5rem',
              backgroundColor: theme.palette.background.paper,
            },
          }}
        />
        <Flex.Row justify="flex-end" width="100%">
          <Text
            margin="0"
            style={{
              ...theme.typography.caption,
              color: notesOver ? palette.red500 : theme.palette.text.secondary,
              fontWeight: 600,
            }}
          >
            {notesLen} / {CV_CUSTOMIZE_MAX_ADDITIONAL_NOTES}
          </Text>
        </Flex.Row>
        </S.Panel>
        {pending ? (
          <S.PanelLoadingOverlay
            role="status"
            aria-live="polite"
            aria-busy="true"
            aria-label="HTML 생성 중"
          >
            <Flex.Column align="center" justify="center" gap="0.75rem" style={{ maxWidth: '18rem' }}>
              <LoadingIcon width={100} height={100} aria-hidden />
              <Text
                margin="0"
                style={{
                  ...theme.typography.body2,
                  color: theme.palette.grey[700],
                  fontWeight: 600,
                  textAlign: 'center',
                  lineHeight: 1.5,
                }}
              >
                HTML을 생성하는 중입니다…
              </Text>
            </Flex.Column>
          </S.PanelLoadingOverlay>
        ) : null}
      </S.PanelShell>

      <Flex.Row
        align="center"
        justify="space-between"
        gap="0.75rem"
        wrap="wrap"
        width="100%"
        style={{
          marginTop: '1.75rem',
          paddingTop: '1rem',
          borderTop: `1px solid ${palette.grey200}`,
        }}
      >
        <WizS.BackButton
          type="button"
          variant="outlined"
          onClick={onPrevToPromptStep}
          disabled={pending}
          aria-label="프롬프트 편집 단계로 돌아가기"
          startIcon={<ArrowBackIcon sx={{ fontSize: 20, color: 'inherit' }} />}
        >
          프롬프트로 돌아가기
        </WizS.BackButton>
        <Button
          label="AI 결과 생성하기"
          variant="contained"
          color="blue"
          size="large"
          icon={ArrowForwardIconWrap}
          iconPosition="end"
          disabled={pending || cvId == null || notesOver}
          onClick={handleOpenConfirm}
        />
      </Flex.Row>

      <Dialog
        open={confirmOpen}
        onClose={() => {
          if (pending) return;
          setConfirmOpen(false);
        }}
        aria-labelledby="cv-generate-html-confirm-title"
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
        sx={{ zIndex: t => t.zIndex.modal + 2 }}
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
            <InfoOutlinedIcon
              sx={{ fontSize: 22, color: palette.blue500, flexShrink: 0, marginTop: '0.125rem' }}
              aria-hidden
            />
            <Flex.Column gap="0.5rem" style={{ flex: '1 1 auto', minWidth: 0 }}>
              <Heading
                as="h2"
                margin="0"
                color={palette.nearBlack}
                id="cv-generate-html-confirm-title"
                style={{
                  fontSize: '1.125rem',
                  fontWeight: 700,
                  lineHeight: 1.5,
                }}
              >
                AI 커스터마이징을 진행할까요?
              </Heading>
              <Text
                margin="0"
                color={palette.grey600}
                style={{ fontSize: '0.875rem', lineHeight: 1.65, wordBreak: 'keep-all' }}
              >
                AI 커스터마이즈하면 직접 편집한 프롬프트 내용은 사라집니다. 새로운 프롬프트와
                HTML을 생성합니다.
              </Text>
            </Flex.Column>
          </Flex.Row>
          <Flex.Row align="center" justify="flex-end" gap="0.5rem" wrap="wrap" width="100%">
            <Button
              label="취소"
              variant="outlined"
              color="grey"
              size="medium"
              onClick={() => setConfirmOpen(false)}
              disabled={pending}
            />
            <Button
              label="생성하기"
              variant="contained"
              color="blue"
              size="medium"
              icon={ArrowForwardIconWrap}
              iconPosition="end"
              disabled={pending}
              onClick={() => {
                setConfirmOpen(false);
                runGenerateHtml();
              }}
            />
          </Flex.Row>
        </DialogContent>
      </Dialog>
    </Flex.Column>
  );
};

export default CvGenerateStep3Customize;

const S = {
  /** 디자인 패널 위 로딩 오버레이 — 패널 영역만 덮음 */
  PanelShell: styled('div')`
    display: flex;
    flex-direction: column;
    width: 100%;
    min-width: 0;
    box-sizing: border-box;
    position: relative;
  `,
  PanelLoadingOverlay: styled('div')`
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    position: absolute;
    inset: 0;
    z-index: 2;
    box-sizing: border-box;
    border-radius: 0.75rem;
    background-color: rgba(255, 255, 255, 0.88);
    backdrop-filter: blur(2px);
  `,
  Panel: styled('div')(({ theme }) => ({
    display: 'flex',
    flexDirection: 'column',
    gap: '0.65rem',
    width: '100%',
    minWidth: 0,
    boxSizing: 'border-box',
    padding: '1.1rem 1.15rem',
    borderRadius: '0.75rem',
    border: `1px solid ${palette.grey200}`,
    backgroundColor: palette.grey100,
    [theme.breakpoints.down('md')]: {
      padding: '0.9rem 0.75rem',
    },
  })),
  SectionTitle: styled('h4')(({ theme }) => ({
    margin: 0,
    fontSize: '1rem',
    fontWeight: 700,
    color: theme.palette.text.primary,
  })),
  LayoutChoice: styled('button', {
    shouldForwardProp: p => p !== '$selected',
  })<{ $selected: boolean }>`
    display: flex;
    flex-direction: column;
    align-items: stretch;
    flex: 1 1 7.5rem;
    min-width: min(100%, 7.5rem);
    max-width: 100%;
    padding: 0;
    margin: 0;
    cursor: pointer;
    border-radius: 0.65rem;
    border: 2px solid ${({ $selected }) => ($selected ? palette.blue500 : palette.grey200)};
    background-color: ${({ theme }) => theme.palette.background.paper};
    box-sizing: border-box;
    overflow: hidden;
    text-align: left;
    transition: border-color 0.15s ease, box-shadow 0.15s ease;
    &:focus-visible {
      outline: 2px solid ${palette.blue500};
      outline-offset: 2px;
    }
    &:hover {
      border-color: ${({ $selected }) => ($selected ? palette.blue500 : palette.grey300)};
      box-shadow: 0 1px 4px rgba(16, 24, 40, 0.06);
    }
  `,
  PreviewPane: styled('div')`
    display: flex;
    flex-direction: column;
    width: 100%;
    min-height: 5.25rem;
    box-sizing: border-box;
    background-color: ${palette.grey100};
    border-bottom: 1px solid ${palette.grey200};
  `,
  LayoutLabel: styled('span', {
    shouldForwardProp: p => p !== '$selected',
  })<{ $selected: boolean }>`
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0.45rem 0.35rem;
    font-size: 0.75rem;
    font-weight: 700;
    color: ${({ $selected }) => ($selected ? palette.white : palette.grey600)};
    background-color: ${({ $selected }) => ($selected ? palette.blue500 : 'transparent')};
    box-sizing: border-box;
  `,
  ColorChoice: styled('button', {
    shouldForwardProp: p => p !== '$selected',
  })<{ $selected: boolean }>`
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 0.35rem;
    flex: 1 1 5.5rem;
    min-width: min(100%, 5.5rem);
    max-width: 100%;
    padding: 0.45rem 0.4rem 0.4rem;
    margin: 0;
    cursor: pointer;
    border-radius: 0.55rem;
    border: 2px solid ${({ $selected }) => ($selected ? palette.blue500 : palette.grey200)};
    background-color: ${({ theme }) => theme.palette.background.paper};
    box-sizing: border-box;
    transition: border-color 0.15s ease;
    &:focus-visible {
      outline: 2px solid ${palette.blue500};
      outline-offset: 2px;
    }
    &:hover {
      border-color: ${({ $selected }) => ($selected ? palette.blue500 : palette.grey300)};
    }
  `,
  SwatchDot: styled('span', {
    shouldForwardProp: p => p !== '$color',
  })<{ $color: string }>`
    display: inline-block;
    width: 0.65rem;
    height: 0.65rem;
    border-radius: 50%;
    background-color: ${({ $color }) => $color};
    flex-shrink: 0;
    border: 1px solid rgba(0, 0, 0, 0.06);
    box-sizing: border-box;
  `,
  ColorLabel: styled('span', {
    shouldForwardProp: p => p !== '$selected',
  })<{ $selected: boolean }>`
    font-size: 0.6875rem;
    font-weight: 700;
    text-align: center;
    color: ${({ $selected }) => ($selected ? palette.blue600 : palette.grey600)};
  `,
  DensityChip: styled('button', {
    shouldForwardProp: p => p !== '$selected',
  })<{ $selected: boolean }>`
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0.5rem 0.85rem;
    margin: 0;
    cursor: pointer;
    border-radius: 999px;
    border: 2px solid ${({ $selected }) => ($selected ? palette.blue500 : palette.grey200)};
    background-color: ${({ $selected, theme }) =>
      $selected ? palette.blue300 : theme.palette.background.paper};
    color: ${({ $selected }) => ($selected ? palette.blue700 : palette.grey600)};
    font-size: 0.8125rem;
    font-weight: 700;
    box-sizing: border-box;
    transition: border-color 0.15s ease, background-color 0.15s ease;
    &:focus-visible {
      outline: 2px solid ${palette.blue500};
      outline-offset: 2px;
    }
  `,
};
