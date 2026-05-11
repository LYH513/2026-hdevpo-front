import { BASE_URL } from '@/apis/config';
import { ENDPOINT } from '@/apis/endPoint';
import { LoadingIcon } from '@/assets';
import { Flex, Heading, Text } from '@/components';
import { ROUTE_PATH } from '@/constants/routePath';
import { MAX_RESPONSIVE_WIDTH } from '@/constants/system';
import { useTrackPageView } from '@/service/amplitude/useTrackPageView';
import useCvWizardStore, { getValidatedWizardStep } from '@/stores/useCvWizardStore';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CheckIcon from '@mui/icons-material/Check';
import { useMediaQuery, useTheme } from '@mui/material';
import { Fragment, useCallback, useEffect, useMemo } from 'react';

import { cumulativeSemesterFromGrade } from '../utils/cumulativeSemester';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';

import { usePortfolioContext } from '@/pages/portfolio/PortfolioPage/context/PortfolioContext';

import type { PortfolioCvDetail } from '../apis/cv';
import usePatchPortfolioCvMutation from '../hooks/usePatchPortfolioCvMutation';
import usePostPortfolioCvBuildPromptMutation from '../hooks/usePostPortfolioCvBuildPromptMutation';
import { repoSelectionId } from '../utils/cvWizardSelection';
import { sanitizeCvHtml } from '../utils/sanitizeCvHtml';

import { CvGeneratePageS as S } from './cvGeneratePageStyles';
import CvGenerateStep1 from './components/CvGenerateStep1';
import CvGenerateStep2 from './components/CvGenerateStep2';
import CvGenerateStep3 from './components/CvGenerateStep3';
import CvGenerateStep3Customize from './components/CvGenerateStep3Customize';
import CvGenerateStep4 from './components/CvGenerateStep4';

type WizardStep = 1 | 2 | 3 | 3.5 | 4;

type StepDef = { readonly n: 1 | 2 | 3 | 4; readonly label: string };

type StepVisualState = 'completed' | 'active' | 'upcoming';

/** 3.5는 스테퍼에서 3과 동일한 진행도로 표시 */
function stepperDisplayStep(wizardStep: WizardStep): 1 | 2 | 3 | 4 {
  return wizardStep === 3.5 ? 3 : wizardStep;
}

function stepVisual(stepN: number, wizardStep: WizardStep): StepVisualState {
  const s = stepperDisplayStep(wizardStep);
  if (s === 1) return stepN === 1 ? 'active' : 'upcoming';
  if (s === 2) {
    if (stepN === 1) return 'completed';
    if (stepN === 2) return 'active';
    return 'upcoming';
  }
  if (s === 3) {
    if (stepN <= 2) return 'completed';
    if (stepN === 3) return 'active';
    return 'upcoming';
  }
  if (stepN <= 3) return 'completed';
  return stepN === 4 ? 'active' : 'upcoming';
}

const getProfileImageUrl = (filename: string | null | undefined): string | null =>
  filename?.trim()
    ? `${BASE_URL}${ENDPOINT.PORTFOLIO_USER_INFO_IMAGE}/${encodeURIComponent(filename.trim())}`
    : null;

const CvGeneratePage = () => {
  useTrackPageView({ eventName: '[View] CV 생성기' });
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(MAX_RESPONSIVE_WIDTH);
  const { userInfo, repos, mileageItems, activities } = usePortfolioContext();
  const buildPromptMutation = usePostPortfolioCvBuildPromptMutation();
  const patchCvMutation = usePatchPortfolioCvMutation();

  const {
    wizardStep,
    setWizardStep,
    selectedMileageIds,
    setSelectedMileageIds,
    selectedActivityIds,
    setSelectedActivityIds,
    selectedRepoIds,
    setSelectedRepoIds,
    draftTitle,
    jobPosting,
    setJobPosting,
    targetPosition,
    setTargetPosition,
    additionalNotes,
    setAdditionalNotes,
    generatedPrompt,
    setGeneratedPrompt,
    htmlResultDraft,
    setHtmlResultDraft,
    pendingCvId,
    setPendingCvId,
    preparingEmployment,
    setPreparingEmployment,
  } = useCvWizardStore();

  const defaultPreparingEmployment = useMemo(() => {
    const c = cumulativeSemesterFromGrade(userInfo?.grade, userInfo?.semester);
    return c != null && c >= 7;
  }, [userInfo?.grade, userInfo?.semester]);

  useEffect(() => {
    if (typeof preparingEmployment === 'boolean') return;
    setPreparingEmployment(defaultPreparingEmployment);
  }, [preparingEmployment, defaultPreparingEmployment, setPreparingEmployment]);

  const employmentPrepChecked =
    typeof preparingEmployment === 'boolean'
      ? preparingEmployment
      : defaultPreparingEmployment;

  const wizardSteps = useMemo<StepDef[]>(
    () => [
      {
        n: 1,
        label: employmentPrepChecked ? '공고 입력' : '진로 관심 분야',
      },
      { n: 2, label: '항목 선택' },
      { n: 3, label: '프롬프트 생성' },
      { n: 4, label: '결과 저장' },
    ],
    [employmentPrepChecked],
  );

  // 마운트 시 불완전한 저장 상태 보정
  useEffect(() => {
    const validStep = getValidatedWizardStep();
    if (validStep !== useCvWizardStore.getState().wizardStep) {
      setWizardStep(validStep);
    }
  }, [setWizardStep]);

  const visibleRepos = useMemo(
    () => (Array.isArray(repos) ? repos.filter(r => r.is_visible) : []),
    [repos],
  );

  // 데이터 로드 후 유효하지 않은 선택값 제거
  useEffect(() => {
    if (mileageItems.length === 0) return;
    const current = useCvWizardStore.getState().selectedMileageIds;
    setSelectedMileageIds(current.filter(id => mileageItems.some(m => m.id === id)));
  }, [mileageItems, setSelectedMileageIds]);

  useEffect(() => {
    if (activities.length === 0) return;
    const current = useCvWizardStore.getState().selectedActivityIds;
    setSelectedActivityIds(current.filter(id => activities.some(a => a.id === id)));
  }, [activities, setSelectedActivityIds]);

  useEffect(() => {
    if (visibleRepos.length === 0) return;
    const current = useCvWizardStore.getState().selectedRepoIds;
    setSelectedRepoIds(current.filter(id => visibleRepos.some(r => repoSelectionId(r) === id)));
  }, [visibleRepos, setSelectedRepoIds]);

  useEffect(() => {
    if (wizardStep !== 3 && wizardStep !== 3.5) return;
    if (!generatedPrompt.trim()) setWizardStep(2);
  }, [wizardStep, generatedPrompt, setWizardStep]);

  useEffect(() => {
    if (wizardStep !== 4) return;
    if (pendingCvId === null) {
      toast.warn('CV 정보가 없습니다. 프롬프트 생성 단계부터 다시 진행해 주세요.');
      setWizardStep(3);
    }
  }, [wizardStep, pendingCvId, setWizardStep]);

  const getCommittedSelection = useCallback(() => {
    const mileageIds = mileageItems
      .filter(m => typeof m.id === 'number' && selectedMileageIds.includes(m.id))
      .map(m => m.id as number);
    const activityIds = activities
      .filter(a => selectedActivityIds.includes(a.id))
      .map(a => a.id);
    const repoIds = visibleRepos
      .filter(r => selectedRepoIds.includes(repoSelectionId(r)))
      .map(r => repoSelectionId(r));
    return {
      selected_mileage_ids: mileageIds,
      selected_activity_ids: activityIds,
      selected_repo_ids: repoIds,
    };
  }, [
    activities,
    mileageItems,
    selectedActivityIds,
    selectedMileageIds,
    selectedRepoIds,
    visibleRepos,
  ]);

  const handleBack = useCallback(() => {
    navigate(ROUTE_PATH.cv);
  }, [navigate]);

  const handleNextFromStep1 = useCallback(() => {
    if (!targetPosition.trim()) {
      toast.warn('지원 직무를 입력하거나 선택해 주세요.');
      return;
    }
    setWizardStep(2);
  }, [setWizardStep, targetPosition]);

  const handlePrevFromStep2 = useCallback(() => {
    setWizardStep(1);
  }, [setWizardStep]);

  const handlePrevFromStep3 = useCallback(() => {
    setWizardStep(2);
  }, [setWizardStep]);

  const handleGoToStep3Customize = useCallback(() => {
    setWizardStep(3.5);
  }, [setWizardStep]);

  const handlePrevFromStep3Customize = useCallback(() => {
    setWizardStep(3);
  }, [setWizardStep]);

  const handleGenerateHtmlSuccess = useCallback(
    (detail: PortfolioCvDetail) => {
      setGeneratedPrompt(detail.prompt);
      setHtmlResultDraft(detail.html_content ?? '');
      setWizardStep(4);
      toast.success('HTML이 생성되어 4단계에 반영되었습니다.');
    },
    [setGeneratedPrompt, setHtmlResultDraft, setWizardStep],
  );

  const handleGoToStep4 = useCallback(() => {
    if (pendingCvId === null) {
      toast.warn('먼저 프롬프트를 생성해 주세요.');
      return;
    }
    setWizardStep(4);
  }, [pendingCvId, setWizardStep]);

  const handlePrevFromStep4 = useCallback(() => {
    setWizardStep(3);
  }, [setWizardStep]);

  const handleSaveHistory = useCallback(() => {
    if (pendingCvId === null) {
      toast.error('저장할 CV를 찾을 수 없습니다.');
      return;
    }
    const raw = htmlResultDraft.trim();
    if (!raw) {
      toast.warn('저장할 HTML을 입력해 주세요.');
      return;
    }
    const html_content = sanitizeCvHtml(raw);
    patchCvMutation.mutate(
      { id: pendingCvId, body: { html_content } },
      {
        onSuccess: () => {
          toast.success('히스토리에 저장되었습니다.');
          navigate(ROUTE_PATH.cv);
        },
        onError: () => {
          toast.error('저장에 실패했습니다. 잠시 후 다시 시도해 주세요.');
        },
      },
    );
  }, [htmlResultDraft, navigate, patchCvMutation, pendingCvId]);

  const handleBuildPrompt = useCallback(() => {
    const jp = jobPosting.trim();
    const tp = targetPosition.trim();
    if (!tp) {
      toast.warn('지원 직무를 입력하거나 선택해 주세요.');
      return;
    }
    const ids = getCommittedSelection();
    buildPromptMutation.mutate(
      {
        mode: employmentPrepChecked ? 'cv' : 'archive',
        title: '',
        job_posting: jp,
        target_position: tp,
        additional_notes: additionalNotes.trim(),
        selected_mileage_ids: ids.selected_mileage_ids,
        selected_activity_ids: ids.selected_activity_ids,
        selected_repo_ids: ids.selected_repo_ids,
        design_preferences: null,
      },
      {
        onSuccess: data => {
          setGeneratedPrompt(data.prompt);
          setPendingCvId(data.cv_id);
          setWizardStep(3);
          toast.success('프롬프트가 생성되었습니다.');
        },
        onError: () => {
          toast.error('프롬프트 생성에 실패했습니다. 잠시 후 다시 시도해 주세요.');
        },
      },
    );
  }, [
    additionalNotes,
    buildPromptMutation,
    employmentPrepChecked,
    getCommittedSelection,
    jobPosting,
    setGeneratedPrompt,
    setPendingCvId,
    setWizardStep,
    targetPosition,
  ]);

  const name = userInfo?.name ?? '-';
  const bio = userInfo?.bio ?? '';
  const department = userInfo?.department ?? '';
  const major1 = userInfo?.major1 ?? '';
  const major2 = userInfo?.major2 ?? '';
  const majorLine = [major1, major2].filter(Boolean).join(' / ') || '-';
  const departmentMajorLine =
    department.trim() !== '' ? `${department} ${majorLine}` : majorLine;

  const profileImageUrl = getProfileImageUrl(userInfo?.profile_image_url ?? null);

  return (
    <Flex.Column
      margin="1rem"
      gap="1.25rem"
      width="100%"
      style={{
        maxWidth: '56rem',
        marginLeft: 'auto',
        marginRight: 'auto',
        minWidth: 0,
        boxSizing: 'border-box',
        ...(isMobile ? { paddingLeft: '0.75rem', paddingRight: '0.75rem' } : {}),
      }}
    >
      <Flex.Row align="center" gap="0.75rem" wrap="wrap">
        <S.BackButton
          type="button"
          variant="outlined"
          onClick={handleBack}
          aria-label="포트폴리오 관리로 뒤로가기"
          startIcon={<ArrowBackIcon sx={{ fontSize: 20, color: 'inherit' }} />}
        >
          뒤로가기
        </S.BackButton>
      </Flex.Row>

      <Flex.Column gap="0.35rem" width="100%">
        <Heading as="h1" margin="0" color={theme.palette.text.primary}>
          포트폴리오 생성하기
        </Heading>
        <Text
          margin="0"
          style={{
            ...theme.typography.body1,
            color: theme.palette.grey[600],
          }}
        >
          {employmentPrepChecked
            ? '채용 공고를 입력한 뒤 포함할 활동을 고르고, 맞춤 프롬프트를 만들어 히스토리로 관리하세요'
            : '진로 관심 분야를 입력한 뒤 포함할 활동을 고르고, 맞춤 프롬프트를 만들어 히스토리로 관리하세요'}
        </Text>
      </Flex.Column>

      <S.Card
        aria-busy={buildPromptMutation.isPending}
        style={
          buildPromptMutation.isPending
            ? { minHeight: 'min(60vh, 28rem)' }
            : undefined
        }
      >
        <S.StepperRow role="list" aria-label="진행 단계">
          {wizardSteps.map((step, idx) => {
            const vs = stepVisual(step.n, wizardStep);
            return (
              <Fragment key={step.n}>
                <S.StepItemColumn align="center">
                  <S.StepCircle
                    $active={vs === 'active'}
                    $completed={vs === 'completed'}
                    $muted={vs === 'upcoming'}
                    aria-current={vs === 'active' ? 'step' : undefined}
                  >
                    {vs === 'completed' ? (
                      <CheckIcon sx={{ fontSize: 15 }} aria-hidden />
                    ) : (
                      step.n
                    )}
                  </S.StepCircle>
                  <S.StepLabel $active={vs === 'active'} $completed={vs === 'completed'}>
                    {step.label}
                  </S.StepLabel>
                </S.StepItemColumn>
                {idx < wizardSteps.length - 1 ? (
                  <S.StepConnector
                    $completed={stepperDisplayStep(wizardStep) >= idx + 2}
                    aria-hidden
                  />
                ) : null}
              </Fragment>
            );
          })}
        </S.StepperRow>

        {buildPromptMutation.isPending ? (
          <Flex.Column
            role="status"
            aria-live="polite"
            align="center"
            justify="center"
            gap="0.75rem"
            width="100%"
            style={{
              marginTop: '1.5rem',
              minHeight: 'min(50vh, 20rem)',
              flex: '1 1 auto',
            }}
          >
            <LoadingIcon width={100} height={100} aria-hidden />
            <Text
              margin="0"
              style={{
                ...theme.typography.body2,
                color: theme.palette.grey[600],
              }}
            >
              프롬프트를 생성하는 중입니다…
            </Text>
          </Flex.Column>
        ) : (
          <>
            {wizardStep === 1 ? (
              <CvGenerateStep2
                isMobile={isMobile}
                preparingEmployment={employmentPrepChecked}
                onPreparingEmploymentChange={setPreparingEmployment}
                jobPosting={jobPosting}
                onJobPostingChange={setJobPosting}
                targetPosition={targetPosition}
                onTargetPositionChange={setTargetPosition}
                additionalNotes={additionalNotes}
                onAdditionalNotesChange={setAdditionalNotes}
                onNext={handleNextFromStep1}
                nextButtonLabel="다음: 항목 선택"
              />
            ) : null}

            {wizardStep === 2 ? (
              <CvGenerateStep1
                name={name}
                bio={bio}
                departmentMajorLine={departmentMajorLine}
                profileImageUrl={profileImageUrl}
                profileLinks={userInfo?.profile_links ?? []}
                mileageItems={mileageItems}
                activities={activities}
                visibleRepos={visibleRepos}
                selectedMileageIds={selectedMileageIds}
                selectedActivityIds={selectedActivityIds}
                selectedRepoIds={selectedRepoIds}
                onSelectedMileageIdsChange={setSelectedMileageIds}
                onSelectedActivityIdsChange={setSelectedActivityIds}
                onSelectedRepoIdsChange={setSelectedRepoIds}
                onPrev={handlePrevFromStep2}
                onBuildPrompt={handleBuildPrompt}
                buildPromptPending={buildPromptMutation.isPending}
                preparingEmployment={employmentPrepChecked}
              />
            ) : null}

            {wizardStep === 3 ? (
              <CvGenerateStep3
                value={generatedPrompt}
                onChange={setGeneratedPrompt}
                onPrev={handlePrevFromStep3}
                onNextToStep4={handleGoToStep4}
                onGoToCustomize={handleGoToStep3Customize}
              />
            ) : null}

            {wizardStep === 3.5 ? (
              <CvGenerateStep3Customize
                onPrevToPromptStep={handlePrevFromStep3Customize}
                cvId={pendingCvId}
                onGenerateHtmlSuccess={handleGenerateHtmlSuccess}
              />
            ) : null}

            {wizardStep === 4 ? (
              <CvGenerateStep4
                htmlInput={htmlResultDraft}
                onHtmlChange={setHtmlResultDraft}
                draftTitle={draftTitle}
                jobPosting={jobPosting}
                targetPosition={targetPosition}
                onPrev={handlePrevFromStep4}
                onSave={handleSaveHistory}
                saveDisabled={patchCvMutation.isPending}
              />
            ) : null}
          </>
        )}
      </S.Card>
    </Flex.Column>
  );
};

export default CvGeneratePage;
