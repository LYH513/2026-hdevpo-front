import { Button, Flex, Heading, Text } from '@/components';
import { hideScrollbar } from '@/styles/hideScrollbar';
import { palette } from '@/styles/palette';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CloseIcon from '@mui/icons-material/Close';
import OpenInFullIcon from '@mui/icons-material/OpenInFull';
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined';
import { formatDateOnly } from '@/pages/portfolio/utils/date';
import BusinessIcon from '@mui/icons-material/Business';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import ContentPasteIcon from '@mui/icons-material/ContentPaste';
import WorkOutlineIcon from '@mui/icons-material/WorkOutline';
import { Dialog, DialogContent, IconButton, TextField, useTheme } from '@mui/material';
import { styled } from '@mui/material/styles';
import { useCallback, useMemo, useState, type FunctionComponent, type SVGProps } from 'react';

import { CV_PREVIEW_IFRAME_SANDBOX } from '../../constants/cvPreviewIframeSandbox';
import { buildCvPreviewSrcDoc } from '../../utils/buildCvPreviewSrcDoc';
import { extractCompanyLineFromJobPosting } from '../../utils/extractCompanyLineFromJobPosting';
import { sanitizeCvHtml } from '../../utils/sanitizeCvHtml';
import { CvGeneratePageS as WizS } from '../cvGeneratePageStyles';
import { HTML_PANE_HEIGHT } from '../../constants/cvGeneratePaneConstants';

/** CV 상세 미리보기「크게 보기」와 동일한 모달 크기 */
const HTML_EXPAND_MODAL_PAPER_SX = {
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

const OpenInFullIconWrap: FunctionComponent<SVGProps<SVGSVGElement>> = () => (
  <OpenInFullIcon sx={{ fontSize: 18 }} />
);

export interface CvGenerateStep4Props {
  htmlInput: string;
  onHtmlChange: (next: string) => void;
  draftTitle: string;
  jobPosting: string;
  targetPosition: string;
  onPrev: () => void;
  onSave: () => void;
  saveDisabled?: boolean;
}

const CvGenerateStep4 = ({
  htmlInput,
  onHtmlChange,
  draftTitle,
  jobPosting,
  targetPosition,
  onPrev,
  onSave,
  saveDisabled = false,
}: CvGenerateStep4Props) => {
  const theme = useTheme();
  const [htmlExpandOpen, setHtmlExpandOpen] = useState(false);
  const closeHtmlExpand = useCallback(() => setHtmlExpandOpen(false), []);

  const sanitizedHtml = useMemo(() => sanitizeCvHtml(htmlInput), [htmlInput]);
  const previewSrcDoc = useMemo(
    () => buildCvPreviewSrcDoc(sanitizedHtml),
    [sanitizedHtml],
  );
  const parsedCompany = useMemo(
    () => extractCompanyLineFromJobPosting(jobPosting),
    [jobPosting],
  );
  const dateLine = formatDateOnly(new Date().toISOString());
  const jobLine = targetPosition.trim() || '—';
  const companyDisplay =
    parsedCompany !== '—' ? parsedCompany : draftTitle.trim() || '—';

  return (
    <Flex.Column gap="1.25rem" width="100%" style={{ marginTop: '1.5rem' }}>
      <Flex.Column gap="0.35rem" width="100%">
        <Heading as="h3" margin="0" color={theme.palette.text.primary}>
          AI 결과를 붙여넣고 저장하세요
        </Heading>
        <Text
          margin="0"
          style={{
            ...theme.typography.body2,
            color: theme.palette.grey[600],
            lineHeight: 1.5,
          }}
        >
          AI가 생성한 html 결과를 붙여넣으면 히스토리로 관리됩니다. 스크립트는 제거됩니다.
        </Text>
      </Flex.Column>

      <S.SummaryStrip>
        <S.SummaryCell>
          <S.SummaryLabelRow>
            <BusinessIcon sx={{ fontSize: 18, color: palette.grey500 }} aria-hidden />
            <S.SummaryLabelText>기업</S.SummaryLabelText>
          </S.SummaryLabelRow>
          <S.SummaryValue>{companyDisplay}</S.SummaryValue>
        </S.SummaryCell>
        <S.SummaryCell>
          <S.SummaryLabelRow>
            <WorkOutlineIcon sx={{ fontSize: 18, color: palette.grey500 }} aria-hidden />
            <S.SummaryLabelText>직무</S.SummaryLabelText>
          </S.SummaryLabelRow>
          <S.SummaryValue>{jobLine}</S.SummaryValue>
        </S.SummaryCell>
        <S.SummaryCell>
          <S.SummaryLabelRow>
            <CalendarTodayIcon sx={{ fontSize: 18, color: palette.grey500 }} aria-hidden />
            <S.SummaryLabelText>날짜</S.SummaryLabelText>
          </S.SummaryLabelRow>
          <S.SummaryValue>{dateLine || '—'}</S.SummaryValue>
        </S.SummaryCell>
      </S.SummaryStrip>

      <Flex.Column gap="0.5rem" width="100%">
        <S.PasteLabelRow align="center" gap="0.5rem" wrap="wrap">
          <ContentPasteIcon sx={{ fontSize: 22, color: palette.blue500 }} aria-hidden />
          <Text
            margin="0"
            style={{
              ...theme.typography.subtitle2,
              fontWeight: 700,
              color: theme.palette.text.primary,
            }}
          >
            AI 생성 결과 붙여넣기
          </Text>
        </S.PasteLabelRow>
      </Flex.Column>

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
            HTML 입력
          </Text>
          <S.HtmlEditorPane>
            <S.HtmlTextField
              fullWidth
              multiline
              value={htmlInput}
              onChange={e => onHtmlChange(e.target.value)}
              placeholder="ChatGPT / Claude 등에서 생성된 CV, 자기소개서, 커버레터 내용을 여기에 붙여넣으세요…"
              inputProps={{
                maxLength: 500_000,
                'aria-label': 'AI 생성 HTML 붙여넣기',
              }}
            />
          </S.HtmlEditorPane>
        </Flex.Column>
        <Flex.Column gap="0.5rem" style={{ flex: '1 1 0', minWidth: 0, width: '100%' }}>
          <Flex.Row
            align="center"
            justify="space-between"
            gap="0.75rem"
            wrap="wrap"
            width="100%"
            style={{ minWidth: 0 }}
          >
            <Text
              margin="0"
              style={{
                ...theme.typography.caption,
                fontWeight: 700,
                color: theme.palette.text.secondary,
              }}
            >
              미리보기 (정제 후)
            </Text>
            <Flex.Row align="center" gap="0.5rem" wrap="wrap" style={{ flexShrink: 0 }}>
              <Button
                label="크게 보기"
                variant="outlined"
                color="blue"
                size="small"
                icon={OpenInFullIconWrap}
                iconPosition="start"
                onClick={() => setHtmlExpandOpen(true)}
                disabled={!sanitizedHtml.trim()}
                aria-label="HTML 미리보기 크게 보기"
              />
            </Flex.Row>
          </Flex.Row>
          <S.PreviewPane>
            {sanitizedHtml.trim() ? (
              <S.PreviewIframe
                title="CV HTML 미리보기"
                srcDoc={previewSrcDoc}
                sandbox={CV_PREVIEW_IFRAME_SANDBOX}
                referrerPolicy="no-referrer"
              />
            ) : (
              <Text
                margin="0"
                style={{
                  ...theme.typography.body2,
                  color: theme.palette.grey[500],
                  padding: '0.85rem 1rem',
                }}
              >
                입력한 HTML이 정제되어 여기에 표시됩니다.
              </Text>
            )}
          </S.PreviewPane>
        </Flex.Column>
      </S.EditorPreviewRow>

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
          aria-label="프롬프트 단계로 돌아가기"
          startIcon={<ArrowBackIcon sx={{ fontSize: 20, color: 'inherit' }} />}
        >
          이전 단계
        </WizS.BackButton>
        <Button
          label="히스토리 저장"
          variant="contained"
          color="blue"
          size="large"
          icon={() => <SaveOutlinedIcon sx={{ fontSize: 20 }} />}
          iconPosition="start"
          disabled={saveDisabled}
          onClick={onSave}
        />
      </Flex.Row>

      <Dialog
        open={htmlExpandOpen}
        onClose={closeHtmlExpand}
        maxWidth={false}
        fullWidth
        aria-labelledby="cv-generate-step4-html-expand-title"
        PaperProps={{
          sx: HTML_EXPAND_MODAL_PAPER_SX,
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
              id="cv-generate-step4-html-expand-title"
              as="h3"
              margin="0"
              bold
              color={palette.nearBlack}
              style={{ fontSize: '1rem', lineHeight: 1.4 }}
            >
              미리보기 (정제 후)
            </Text>
            <IconButton
              type="button"
              onClick={closeHtmlExpand}
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
          <S.ModalIframeShell>
            <iframe
              title="HTML 크게 보기"
              srcDoc={previewSrcDoc}
              sandbox={CV_PREVIEW_IFRAME_SANDBOX}
              referrerPolicy="no-referrer"
            />
          </S.ModalIframeShell>
        </DialogContent>
      </Dialog>
    </Flex.Column>
  );
};

export default CvGenerateStep4;

const S = {
  SummaryStrip: styled('div')`
    display: flex;
    flex-direction: row;
    flex-wrap: wrap;
    align-items: stretch;
    width: 100%;
    min-width: 0;
    padding: 0.65rem 0.5rem;
    border-radius: 0.75rem;
    background-color: ${palette.grey100};
    border: 1px solid ${palette.grey200};
    box-sizing: border-box;
  `,
  SummaryCell: styled('div')`
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    flex: 1 1 7.5rem;
    min-width: 0;
    padding: 0.5rem 0.85rem;
    box-sizing: border-box;
    @media (min-width: 600px) {
      & + & {
        border-left: 1px solid ${palette.grey200};
      }
    }
    @media (max-width: 599px) {
      flex: 1 1 100%;
      border-bottom: 1px solid ${palette.grey200};
      &:last-of-type {
        border-bottom: none;
      }
    }
  `,
  SummaryLabelRow: styled(Flex.Row)`
    align-items: center;
    gap: 0.35rem;
  `,
  SummaryLabelText: styled('span')(({ theme }) => ({
    ...theme.typography.caption,
    fontWeight: 600,
    color: theme.palette.grey[600],
  })),
  SummaryValue: styled('span')(({ theme }) => ({
    ...theme.typography.body2,
    fontWeight: 700,
    color: theme.palette.text.primary,
    wordBreak: 'break-word',
  })),
  PasteLabelRow: styled(Flex.Row)``,
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
  HtmlEditorPane: styled('div')`
    display: flex;
    flex-direction: column;
    width: 100%;
    min-width: 0;
    height: ${HTML_PANE_HEIGHT};
    box-sizing: border-box;
  `,
  HtmlTextField: styled(TextField)(({ theme }) => ({
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
      borderColor: palette.blue300,
    },
    '& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline': {
      borderColor: palette.blue400,
    },
    '& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': {
      borderColor: palette.blue500,
    },
    '& .MuiOutlinedInput-input': {
      ...hideScrollbar,
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
    height: HTML_PANE_HEIGHT,
    overflow: 'hidden',
    padding: 0,
    borderRadius: '0.5rem',
    border: `1px solid ${palette.grey200}`,
    backgroundColor: palette.white,
    boxSizing: 'border-box',
    width: '100%',
    minWidth: 0,
    ...theme.typography.body2,
    color: theme.palette.text.primary,
  })),
  /** srcDoc + sandbox: 외부 CSS(link) 적용·앱과 스타일 격리. 스크립트는 sandbox로 차단 */
  PreviewIframe: styled('iframe')`
    display: block;
    flex: 1 1 auto;
    width: 100%;
    min-height: 0;
    height: 100%;
    border: none;
    background-color: ${palette.white};
    box-sizing: border-box;
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
};
