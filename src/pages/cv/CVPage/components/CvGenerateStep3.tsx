import { Button, Flex, Heading, Text } from '@/components';
import { MAX_RESPONSIVE_WIDTH } from '@/constants/system';
import { palette } from '@/styles/palette';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { Button as MuiButton, TextField, useMediaQuery, useTheme } from '@mui/material';
import { styled } from '@mui/material/styles';
import { useCallback, type FunctionComponent, type SVGProps } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { toast } from 'react-toastify';

import { copyTextToClipboard } from '@/utils/copyTextToClipboard';

import { CvGeneratePageS as WizS } from '../cvGeneratePageStyles';
import { AI_SERVICES, PROMPT_PANE_HEIGHT } from '../../constants/cvGeneratePaneConstants';

const CopyIconWrap: FunctionComponent<SVGProps<SVGSVGElement>> = () => (
  <ContentCopyIcon sx={{ fontSize: 20 }} />
);

const ArrowForwardIconWrap: FunctionComponent<SVGProps<SVGSVGElement>> = () => (
  <ArrowForwardIcon sx={{ fontSize: 20 }} />
);

const AutoAwesomeIconWrap: FunctionComponent<SVGProps<SVGSVGElement>> = () => (
  <AutoAwesomeIcon sx={{ fontSize: 20 }} />
);

export interface CvGenerateStep3Props {
  value: string;
  onChange: (next: string) => void;
  onPrev: () => void;
  onNextToStep4: () => void;
  onGoToCustomize: () => void;
}

const CvGenerateStep3 = ({
  value,
  onChange,
  onPrev,
  onNextToStep4,
  onGoToCustomize,
}: CvGenerateStep3Props) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(MAX_RESPONSIVE_WIDTH);

  const handleCopy = useCallback(async () => {
    const t = value.trim();
    if (!t) {
      toast.info('복사할 프롬프트가 없습니다.', { position: 'top-center' });
      return;
    }
    const ok = await copyTextToClipboard(value);
    if (ok) {
      toast.success('프롬프트가 복사되었습니다.', { position: 'top-center' });
    } else {
      toast.error(
        '복사에 실패했습니다. HTTPS 접속인지 확인하거나, 편집 영역에서 직접 선택해 복사해 주세요.',
        { position: 'top-center' },
      );
    }
  }, [value]);

  const openExternal = useCallback((href: string) => {
    window.open(href, '_blank', 'noopener,noreferrer');
  }, []);

  const titleBlock = (
    <Flex.Column
      gap="0.35rem"
      width={isMobile ? '100%' : undefined}
      style={
        isMobile
          ? { minWidth: 0, boxSizing: 'border-box' }
          : { flex: '1 1 0%', minWidth: 0, boxSizing: 'border-box' }
      }
    >
      <Heading
        as="h3"
        margin="0"
        color={theme.palette.text.primary}
        style={{ wordBreak: 'keep-all', overflowWrap: 'break-word' }}
      >
        프롬프트가 생성되었습니다
      </Heading>
      <Text
        margin="0"
        style={{
          ...theme.typography.body2,
          color: theme.palette.grey[600],
          lineHeight: 1.5,
          wordBreak: 'keep-all',
          overflowWrap: 'break-word',
        }}
      >
        아래에서 내용을 수정할 수 있습니다. <br />
        마크다운 미리보기와 함께 확인한 뒤 복사해 ChatGPT, Claude 등 AI에 붙여넣으세요.
      </Text>
    </Flex.Column>
  );

  const customizeButton = (
    <Button
      label="AI 커스터마이징하기"
      variant="contained"
      color="blue"
      size={isMobile ? 'medium' : 'large'}
      icon={AutoAwesomeIconWrap}
      iconPosition="start"
      onClick={onGoToCustomize}
      aria-label="AI 커스터마이징 단계로 이동"
    />
  );

  return (
    <Flex.Column gap="1.25rem" width="100%" style={{ marginTop: '1.5rem' }}>
      {isMobile ? (
        <Flex.Column gap="0.75rem" width="100%" style={{ minWidth: 0 }}>
          {titleBlock}
          <Flex.Row align="center" justify="flex-end" width="100%" wrap="nowrap">
            {customizeButton}
          </Flex.Row>
        </Flex.Column>
      ) : (
        <Flex.Row
          align="flex-start"
          justify="space-between"
          gap="1rem"
          wrap="nowrap"
          width="100%"
          style={{ minWidth: 0 }}
        >
          {titleBlock}
          <Flex.Row
            align="center"
            wrap="nowrap"
            style={{ flex: '0 0 auto', flexShrink: 0, boxSizing: 'border-box' }}
          >
            {customizeButton}
          </Flex.Row>
        </Flex.Row>
      )}

      <S.EditorPreviewRow>
        <Flex.Column gap="0.5rem" style={{ flex: '1 1 0', minWidth: 0, width: '100%' }}>
          <Text
            margin="0"
            style={{
              ...theme.typography.caption,
              fontWeight: 700,
              color: theme.palette.text.secondary,
            }}
          >
            편집 (마크다운)
          </Text>
          <S.EditorPane>
            <S.PromptTextField
              fullWidth
              multiline
              value={value}
              onChange={e => onChange(e.target.value)}
              placeholder="프롬프트가 여기에 표시됩니다."
              inputProps={{
                maxLength: 50000,
                'aria-label': '생성된 프롬프트 편집',
              }}
            />
          </S.EditorPane>
        </Flex.Column>
        <Flex.Column gap="0.5rem" style={{ flex: '1 1 0', minWidth: 0, width: '100%' }}>
          <Text
            margin="0"
            style={{
              ...theme.typography.caption,
              fontWeight: 700,
              color: theme.palette.text.secondary,
            }}
          >
            미리보기
          </Text>
          <S.PreviewPane>
            {value.trim() ? (
              <S.MarkdownBody>
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{value}</ReactMarkdown>
              </S.MarkdownBody>
            ) : (
              <Text
                margin="0"
                style={{
                  ...theme.typography.body2,
                  color: theme.palette.grey[500],
                }}
              >
                편집 영역에 내용을 입력하면 미리보기가 표시됩니다.
              </Text>
            )}
          </S.PreviewPane>
        </Flex.Column>
      </S.EditorPreviewRow>

      <Button
        label="프롬프트 한 번에 복사"
        variant="contained"
        color="blue"
        size="full"
        icon={CopyIconWrap}
        iconPosition="start"
        onClick={() => void handleCopy()}
      />

      <S.ExternalZone direction="column" gap="0.75rem" width="100%">
        <Flex.Row align="center" gap="0.5rem" wrap="wrap">
          <S.ExternalBadge>서비스 외부 구간</S.ExternalBadge>
        </Flex.Row>
        <Text
          margin="0"
          style={{
            ...theme.typography.body2,
            color: theme.palette.text.secondary,
            lineHeight: 1.5,
          }}
        >
          복사한 프롬프트를 아래 AI 서비스에 붙여넣어 포트폴리오를 html로 생성하세요.
        </Text>
        <Flex.Row
          align="stretch"
          justify="center"
          gap="0.65rem"
          wrap="wrap"
          width="100%"
        >
          {AI_SERVICES.map(s => (
            <S.AiLinkButton
              key={s.href}
              type="button"
              variant="outlined"
              onClick={() => openExternal(s.href)}
              startIcon={<OpenInNewIcon sx={{ fontSize: 18 }} />}
            >
              {s.label}
            </S.AiLinkButton>
          ))}
        </Flex.Row>
      </S.ExternalZone>

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
          onClick={onPrev}
          aria-label="항목 선택 단계로 돌아가기"
          startIcon={<ArrowBackIcon sx={{ fontSize: 20, color: 'inherit' }} />}
        >
          이전 단계
        </WizS.BackButton>
        <Button
          label="AI 결과 붙여넣기"
          variant="contained"
          color="blue"
          size="large"
          icon={ArrowForwardIconWrap}
          iconPosition="end"
          onClick={onNextToStep4}
        />
      </Flex.Row>
    </Flex.Column>
  );
};

export default CvGenerateStep3;

const S = {
  EditorPreviewRow: styled('div')`
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 1rem;
    width: 100%;
    min-width: 0;
    box-sizing: border-box;
    @media (min-width: 901px) {
      flex-direction: row;
    }
  `,
  EditorPane: styled('div')`
    display: flex;
    flex-direction: column;
    width: 100%;
    min-width: 0;
    height: ${PROMPT_PANE_HEIGHT};
    box-sizing: border-box;
  `,
  PromptTextField: styled(TextField)(({ theme }) => ({
    flex: 1,
    minHeight: 0,
    width: '100%',
    '& .MuiOutlinedInput-root': {
      height: '100%',
      alignItems: 'flex-start',
      overflow: 'hidden',
      padding: '0.65rem 0.75rem',
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
      fontSize: '0.8125rem',
      lineHeight: 1.55,
      backgroundColor: theme.palette.background.paper,
      borderRadius: '0.5rem',
    },
    '& .MuiOutlinedInput-notchedOutline': {
      borderColor: palette.grey200,
    },
    '& .MuiOutlinedInput-input': {
      overflowY: 'auto !important',
      resize: 'none',
      minHeight: '0 !important',
      height: '100% !important',
      maxHeight: '100% !important',
      boxSizing: 'border-box',
    },
  })),
  PreviewPane: styled('div')(({ theme }) => ({
    display: 'flex',
    flexDirection: 'column',
    height: PROMPT_PANE_HEIGHT,
    overflow: 'auto',
    padding: '0.85rem 1rem',
    borderRadius: '0.5rem',
    border: `1px solid ${palette.grey200}`,
    backgroundColor: palette.grey100,
    boxSizing: 'border-box',
    width: '100%',
    minWidth: 0,
    ...theme.typography.body2,
    color: theme.palette.text.primary,
  })),
  MarkdownBody: styled('div')(({ theme }) => ({
    width: '100%',
    minWidth: 0,
    wordBreak: 'break-word',
    '& h1': {
      margin: '0 0 0.5rem',
      fontSize: '1.25rem',
      fontWeight: 700,
      color: palette.nearBlack,
    },
    '& h2': {
      margin: '1rem 0 0.4rem',
      fontSize: '1.0625rem',
      fontWeight: 700,
      color: palette.nearBlack,
    },
    '& h3': {
      margin: '0.85rem 0 0.35rem',
      fontSize: '1rem',
      fontWeight: 700,
      color: palette.nearBlack,
    },
    '& p': {
      margin: '0 0 0.5rem',
      lineHeight: 1.55,
      color: theme.palette.text.primary,
    },
    '& ul, & ol': {
      margin: '0 0 0.5rem',
      paddingLeft: '1.25rem',
    },
    '& li': {
      marginBottom: '0.25rem',
      lineHeight: 1.5,
    },
    '& code': {
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
      fontSize: '0.8125rem',
      padding: '0.125rem 0.35rem',
      borderRadius: '0.25rem',
      backgroundColor: palette.white,
      border: `1px solid ${palette.grey200}`,
    },
    '& pre': {
      margin: '0 0 0.65rem',
      padding: '0.65rem 0.75rem',
      borderRadius: '0.5rem',
      overflow: 'auto',
      backgroundColor: palette.white,
      border: `1px solid ${palette.grey200}`,
      '& code': {
        border: 'none',
        padding: 0,
        backgroundColor: 'transparent',
      },
    },
    '& a': {
      color: palette.blue600,
      textDecoration: 'underline',
    },
    '& table': {
      borderCollapse: 'collapse',
      width: '100%',
      marginBottom: '0.65rem',
      fontSize: '0.8125rem',
    },
    '& th, & td': {
      border: `1px solid ${palette.grey200}`,
      padding: '0.35rem 0.5rem',
      textAlign: 'left',
    },
    '& th': {
      backgroundColor: palette.blue300,
      fontWeight: 600,
    },
    '& blockquote': {
      margin: '0 0 0.65rem',
      paddingLeft: '0.75rem',
      borderLeft: `3px solid ${palette.blue400}`,
      color: theme.palette.text.secondary,
    },
  })),
  ExternalZone: styled(Flex.Column)`
    padding: 1rem 1.1rem;
    border-radius: 0.75rem;
    border: 2px dashed ${palette.grey300};
    background-color: ${palette.grey100};
    box-sizing: border-box;
  `,
  ExternalBadge: styled('span')(({ theme }) => ({
    display: 'inline-flex',
    alignItems: 'center',
    padding: '0.2rem 0.55rem',
    borderRadius: '0.375rem',
    ...theme.typography.caption,
    fontWeight: 700,
    color: theme.palette.text.secondary,
    backgroundColor: palette.white,
    border: `1px solid ${palette.grey200}`,
  })),
  AiLinkButton: styled(MuiButton)(({ theme }) => ({
    flex: '1 1 7rem',
    minWidth: 'min(100%, 7.5rem)',
    maxWidth: '100%',
    textTransform: 'none',
    fontWeight: 600,
    borderColor: palette.grey300,
    color: theme.palette.text.primary,
    borderRadius: '0.75rem',
    '&:hover': {
      borderColor: palette.blue400,
      color: palette.blue600,
      backgroundColor: palette.blue300,
    },
  })),
};
