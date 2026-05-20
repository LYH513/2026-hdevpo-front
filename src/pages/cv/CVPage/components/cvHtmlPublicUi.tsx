import { Button, Text } from '@/components';
import { palette } from '@/styles/palette';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { Switch } from '@mui/material';
import { styled } from '@mui/material/styles';
import type { SxProps, Theme } from '@mui/material/styles';
import type { FunctionComponent, SVGProps } from 'react';

import type { Size } from '@/types/style';

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
  /** 전달 시 비공개일 때도 자리만 확보해 높이·줄바꿈이 토글前后에 맞춰짐 */
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
          ) : (
            <S.LinkPlaceholder $medium={isMedium} aria-hidden />
          )}
        </S.RightSlot>
      ) : null}
    </S.Bar>
  );
}

const S = {
  Bar: styled('div', {
    shouldForwardProp: p => p !== '$medium' && p !== '$plain',
  })<{ $medium: boolean; $plain: boolean }>`
    display: flex;
    flex-direction: row;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem 0.75rem;
    width: 100%;
    box-sizing: border-box;
    padding: 0.55rem 0.75rem;
    border-radius: 0.75rem;
    border: 1px solid ${palette.grey200};
    background-color: ${({ $plain }) => ($plain ? palette.white : palette.blue300)};
    box-shadow: ${({ $plain }) =>
      $plain ? 'none' : '0 1px 2px rgba(83, 127, 241, 0.08)'};
    /* 링크 버튼 유무와 관계없이 높이 통일 (Button small 30px / medium 36px 기준) */
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
  LinkPlaceholder: styled('div', {
    shouldForwardProp: p => p !== '$medium',
  })<{ $medium: boolean }>`
    flex-shrink: 0;
    box-sizing: border-box;
    /* 「링크 바로가기」 길이 기준으로 실제 버튼과 비슷한 폭 확보 */
    min-width: ${({ $medium }) => ($medium ? '10.25rem' : '9.25rem')};
    height: ${({ $medium }) => ($medium ? '36px' : '30px')};
    visibility: hidden;
    pointer-events: none;
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
};
