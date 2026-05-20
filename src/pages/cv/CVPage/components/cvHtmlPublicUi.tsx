import { Button, Text } from '@/components';
import { palette } from '@/styles/palette';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { Switch } from '@mui/material';
import { styled } from '@mui/material/styles';
import type { SxProps, Theme } from '@mui/material/styles';
import { useLayoutEffect, useRef, useState, type FunctionComponent, type SVGProps } from 'react';

import type { Size } from '@/types/style';
import { CV_PREVIEW_IFRAME_SANDBOX } from '../../constants/cvPreviewIframeSandbox';

/** CV 생성 스텝2 취업 스위치와 동일 — @styles/palette */
export const htmlPublicSwitchSx: SxProps<Theme> = {
  ml: 0.25,
  mr: 0,
  flexShrink: 0,
  '& .MuiSwitch-thumb': {
    boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
  },
  '& .MuiSwitch-switchBase.Mui-checked': {
    color: palette.white,
    '& + .MuiSwitch-track': {
      backgroundColor: palette.blue500,
      opacity: 1,
    },
  },
  '& .MuiSwitch-track': {
    backgroundColor: palette.grey300,
    opacity: 1,
  },
};

const OpenInNewSmall: FunctionComponent<SVGProps<SVGSVGElement>> = () => (
  <OpenInNewIcon sx={{ fontSize: 16 }} />
);
const OpenInNewMedium: FunctionComponent<SVGProps<SVGSVGElement>> = () => (
  <OpenInNewIcon sx={{ fontSize: 18 }} />
);

export type CvHtmlPublicLinkButtonProps = {
  onClick: () => void;
  disabled?: boolean;
  /** 기본 `포토폴리오 보기` */
  label?: string;
};

export type CvHtmlPublicAppearance = 'filled' | 'plain';

/** 썸네일 박스 한 변 (px) */
const THUMB_PX = 88;
/** iframe 렌더 기준 크기 — A4 비율에 가깝게 두고 scale로 축소 */
const IFRAME_W = 720;
const IFRAME_H = 1020;
const THUMB_SCALE = Math.min(THUMB_PX / IFRAME_W, THUMB_PX / IFRAME_H);

/**
 * HTML 공개 — 상태 문구 + 라벨 + Switch 토글, 공개 시 같은 줄(줄 바꿈 시 아래)에 링크 버튼.
 * 포트폴리오 카드 / 미리보기 모달 공통.
 * @param appearance `filled`(기본) — 파란 톤 / `plain` — 흰 배경·목록 카드 안에서 사용
 */
export function CvHtmlPublicSwitchControl({
  isPublic,
  onPublicChange,
  disabled,
  size = 'small',
  linkButton,
  appearance = 'filled',
}: {
  isPublic: boolean;
  onPublicChange: (next: boolean) => void;
  disabled?: boolean;
  size?: Size;
  /** 공개 시에만 링크 버튼 표시 */
  linkButton?: CvHtmlPublicLinkButtonProps;
  appearance?: CvHtmlPublicAppearance;
}) {
  const LinkIcon = size === 'medium' ? OpenInNewMedium : OpenInNewSmall;
  const labelFs = size === 'medium' ? '0.8125rem' : '0.75rem';
  const isMedium = size === 'medium';
  const plain = appearance === 'plain';

  return (
    <S.Bar $medium={isMedium} $plain={plain}>
      <S.LeftCluster>
        <S.Status $on={isPublic} $medium={isMedium}>
          {isPublic ? '공개 중' : '비공개'}
        </S.Status>
        <Text
          margin="0"
          color={palette.nearBlack}
          style={{ fontSize: labelFs, fontWeight: 600, lineHeight: 1.35 }}
        >
          HTML 공개
        </Text>
        <Switch
          checked={Boolean(isPublic)}
          onChange={(_, checked) => onPublicChange(checked)}
          disabled={disabled}
          size="small"
          sx={htmlPublicSwitchSx}
          inputProps={{ 'aria-label': 'HTML 공개' }}
        />
      </S.LeftCluster>
      {linkButton ? (
        <S.RightSlot>
          {isPublic ? (
            <Button
              label={linkButton.label ?? '링크 열기'}
              variant="outlined"
              color="blue"
              size={size}
              icon={LinkIcon}
              iconPosition="start"
              onClick={linkButton.onClick}
              disabled={linkButton.disabled}
            />
          ) : null}
        </S.RightSlot>
      ) : null}
    </S.Bar>
  );
}

/** 왼쪽(제목·스위치·가이드) 넓게 + 오른쪽 HTML 미리보기(왼쪽 묶음과 동일 높이) */
export function CvHtmlPublicSettingsRow({
  title,
  guide,
  htmlPreviewSrcDoc,
  ...switchProps
}: {
  title?: string;
  guide?: string;
  htmlPreviewSrcDoc?: string | null;
  isPublic: boolean;
  onPublicChange: (next: boolean) => void;
  disabled?: boolean;
  size?: Size;
  linkButton?: CvHtmlPublicLinkButtonProps;
  appearance?: CvHtmlPublicAppearance;
}) {
  return (
    <S.SettingsRow>
      <S.LeftColumn>
        {title ? <S.SettingsTitle>{title}</S.SettingsTitle> : null}
        <CvHtmlPublicSwitchControl {...switchProps} />
        {guide ? (
          <S.SettingsGuide as="p" margin="0" color={palette.grey600}>
            {guide}
          </S.SettingsGuide>
        ) : null}
      </S.LeftColumn>
      <S.RightColumn>
        <CvHtmlPreviewThumb htmlPreviewSrcDoc={htmlPreviewSrcDoc} matchRowHeight />
      </S.RightColumn>
    </S.SettingsRow>
  );
}

/** 전체 레이아웃이 한눈에 보이도록 축소한 읽기 전용 HTML 미리보기 */
export function CvHtmlPreviewThumb({
  htmlPreviewSrcDoc,
  matchRowHeight = false,
}: {
  htmlPreviewSrcDoc?: string | null;
  /** true — 부모(왼쪽 묶음) 높이에 맞춤, 정사각형 */
  matchRowHeight?: boolean;
}) {
  const hasHtml = Boolean(htmlPreviewSrcDoc?.trim());
  const thumbRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(THUMB_SCALE);

  useLayoutEffect(() => {
    if (!matchRowHeight) {
      setScale(THUMB_SCALE);
      return;
    }
    const el = thumbRef.current;
    if (!el) return;

    const updateScale = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (w <= 0 || h <= 0) return;
      setScale(Math.min(w / IFRAME_W, h / IFRAME_H));
    };

    updateScale();
    const observer = new ResizeObserver(updateScale);
    observer.observe(el);
    return () => observer.disconnect();
  }, [matchRowHeight, htmlPreviewSrcDoc]);

  return (
    <S.PreviewThumb ref={thumbRef} $matchRowHeight={matchRowHeight} aria-label="HTML 미리보기">
      {hasHtml ? (
        <S.PreviewScaler $scale={scale}>
          <iframe
            title="HTML 미리보기"
            srcDoc={htmlPreviewSrcDoc ?? ''}
            sandbox={CV_PREVIEW_IFRAME_SANDBOX}
            referrerPolicy="no-referrer"
            tabIndex={-1}
            width={IFRAME_W}
            height={IFRAME_H}
          />
        </S.PreviewScaler>
      ) : (
        <S.PreviewEmpty>HTML 없음</S.PreviewEmpty>
      )}
    </S.PreviewThumb>
  );
}

const S = {
  SettingsRow: styled('div')`
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: start;
    gap: 0.75rem;
    width: 100%;
    min-width: 0;
    box-sizing: border-box;
    @media (max-width: 480px) {
      grid-template-columns: minmax(0, 1fr);
    }
  `,
  LeftColumn: styled('div')`
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    min-width: 0;
    max-width: 100%;
  `,
  SettingsGuide: styled(Text)`
    font-size: 0.75rem;
    line-height: 1.65;
    overflow-wrap: anywhere;
    word-break: keep-all;
    max-width: 100%;
  `,
  RightColumn: styled('div')`
    display: flex;
    flex: 0 0 auto;
    flex-direction: column;
    align-self: start;
    min-height: 0;
    min-width: 0;
  `,
  SettingsTitle: styled('span')`
    display: block;
    margin: 0;
    font-size: 0.8125rem;
    font-weight: 700;
    color: ${palette.grey600};
  `,
  Bar: styled('div', {
    shouldForwardProp: p => p !== '$medium' && p !== '$plain',
  })<{ $medium: boolean; $plain: boolean }>`
    display: flex;
    flex-direction: row;
    flex-wrap: nowrap;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem 0.75rem;
    width: 100%;
    max-width: 100%;
    min-width: 0;
    box-sizing: border-box;
    padding: 0.55rem 0.75rem;
    border-radius: 0.75rem;
    border: 1px solid ${palette.grey200};
    background-color: ${({ $plain }) => ($plain ? palette.white : palette.blue300)};
    box-shadow: ${({ $plain }) =>
      $plain ? 'none' : '0 1px 2px rgba(83, 127, 241, 0.08)'};
    flex: 0 0 auto;
    align-self: flex-start;
    min-height: ${({ $medium }) =>
      $medium ? 'calc(0.55rem * 2 + 36px)' : 'calc(0.55rem * 2 + 30px)'};
  `,
  LeftCluster: styled('div')`
    display: flex;
    flex-direction: row;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem 0.65rem;
    flex: 1 1 auto;
    min-width: 0;
  `,
  RightSlot: styled('div')`
    display: flex;
    flex-direction: row;
    align-items: center;
    flex-shrink: 0;
  `,
  Status: styled('span', {
    shouldForwardProp: p => p !== '$on' && p !== '$medium',
  })<{ $on: boolean; $medium?: boolean }>`
    display: inline-flex;
    align-items: center;
    font-weight: 700;
    letter-spacing: 0.02em;
    white-space: nowrap;
    font-size: ${({ $medium }) => ($medium ? '0.75rem' : '0.6875rem')};
    color: ${({ $on }) => ($on ? palette.blue600 : palette.grey500)};
  `,
  PreviewThumb: styled('div', {
    shouldForwardProp: p => p !== '$matchRowHeight',
  })<{ $matchRowHeight: boolean }>`
    position: relative;
    display: flex;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    box-sizing: border-box;
    border-radius: 0.5rem;
    overflow: hidden;
    border: 1px solid ${palette.grey200};
    background-color: ${palette.white};
    box-shadow: 0 1px 3px rgba(16, 24, 40, 0.08);
    ${({ $matchRowHeight }) =>
      $matchRowHeight
        ? `
    /* stretch + 정사각형 썸네일이 행 높이만큼 가로로 커지며 본문을 압축하는 것을 막음 */
    align-self: flex-start;
    width: min(100%, 10rem);
    max-width: min(10rem, 36vw);
    height: auto;
    aspect-ratio: 1;
    min-width: ${THUMB_PX}px;
    min-height: ${THUMB_PX}px;
    max-height: min(10rem, 50vh);
    `
        : `
    width: ${THUMB_PX}px;
    height: ${THUMB_PX}px;
    min-width: ${THUMB_PX}px;
    min-height: ${THUMB_PX}px;
    `}
    @media (max-width: 480px) {
      width: ${({ $matchRowHeight }) => ($matchRowHeight ? 'auto' : '100%')};
      max-width: ${THUMB_PX}px;
      min-width: 0;
    }
  `,
  PreviewScaler: styled('div', {
    shouldForwardProp: p => p !== '$scale',
  })<{ $scale: number }>`
    position: absolute;
    top: 50%;
    left: 50%;
    width: ${IFRAME_W}px;
    height: ${IFRAME_H}px;
    transform: translate(-50%, -50%) scale(${({ $scale }) => $scale});
    transform-origin: center center;
    pointer-events: none;
    & > iframe {
      display: block;
      border: none;
      pointer-events: none;
    }
  `,
  PreviewEmpty: styled('span')`
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    margin: 0;
    padding: 0.25rem;
    box-sizing: border-box;
    font-size: 0.625rem;
    font-weight: 600;
    line-height: 1.35;
    text-align: center;
    color: ${palette.grey500};
  `,
};
