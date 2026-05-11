import { STORE_NAME } from '@/constants/storeName';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/** `3.5`: 프롬프트 단계에서만 진입(스테퍼에는 3단계와 동일하게 표시) */
export type CvWizardUiStep = 1 | 2 | 3 | 3.5 | 4;

/** `setState`처럼 값 또는 `(prev) => next` */
type IdListSetterArg = number[] | ((prev: number[]) => number[]);

interface CvWizardState {
  wizardStep: CvWizardUiStep;
  // 스텝 2 UI: 마일리지·활동·레포 선택
  selectedMileageIds: number[];
  selectedActivityIds: number[];
  selectedRepoIds: number[];
  // 스텝 1 UI: 공고·직무 입력 등 (title은 API용으로만 빈 문자열 전송)
  draftTitle: string;
  jobPosting: string;
  targetPosition: string;
  additionalNotes: string;
  // step 3
  generatedPrompt: string;
  // step 4
  htmlResultDraft: string;
  // build-prompt 응답에서 받은 CV id
  pendingCvId: number | null;
  /** null/undefined: 아직 기본값 미반영(학기 기준으로 채움). boolean: 취업 준비 중 여부 */
  preparingEmployment: boolean | null | undefined;

  setWizardStep: (step: CvWizardUiStep) => void;
  setSelectedMileageIds: (idsOrUpdater: IdListSetterArg) => void;
  setSelectedActivityIds: (idsOrUpdater: IdListSetterArg) => void;
  setSelectedRepoIds: (idsOrUpdater: IdListSetterArg) => void;
  setDraftTitle: (v: string) => void;
  setJobPosting: (v: string) => void;
  setTargetPosition: (v: string) => void;
  setAdditionalNotes: (v: string) => void;
  setGeneratedPrompt: (prompt: string) => void;
  setHtmlResultDraft: (html: string) => void;
  setPendingCvId: (id: number | null) => void;
  setPreparingEmployment: (v: boolean) => void;
  resetAll: () => void;
}

const initialState = {
  wizardStep: 1 as CvWizardUiStep,
  selectedMileageIds: [] as number[],
  selectedActivityIds: [] as number[],
  selectedRepoIds: [] as number[],
  draftTitle: '',
  jobPosting: '',
  targetPosition: '',
  additionalNotes: '',
  generatedPrompt: '',
  htmlResultDraft: '',
  pendingCvId: null as number | null,
  preparingEmployment: null as boolean | null,
};

const useCvWizardStore = create<CvWizardState>()(
  persist(
    set => ({
      ...initialState,
      setWizardStep: step => set({ wizardStep: step }),
      setSelectedMileageIds: idsOrUpdater =>
        set(state => ({
          selectedMileageIds:
            typeof idsOrUpdater === 'function'
              ? idsOrUpdater(state.selectedMileageIds)
              : idsOrUpdater,
        })),
      setSelectedActivityIds: idsOrUpdater =>
        set(state => ({
          selectedActivityIds:
            typeof idsOrUpdater === 'function'
              ? idsOrUpdater(state.selectedActivityIds)
              : idsOrUpdater,
        })),
      setSelectedRepoIds: idsOrUpdater =>
        set(state => ({
          selectedRepoIds:
            typeof idsOrUpdater === 'function'
              ? idsOrUpdater(state.selectedRepoIds)
              : idsOrUpdater,
        })),
      setDraftTitle: v => set({ draftTitle: v }),
      setJobPosting: v => set({ jobPosting: v }),
      setTargetPosition: v => set({ targetPosition: v }),
      setAdditionalNotes: v => set({ additionalNotes: v }),
      setGeneratedPrompt: prompt => set({ generatedPrompt: prompt }),
      setHtmlResultDraft: html => set({ htmlResultDraft: html }),
      setPendingCvId: id => set({ pendingCvId: id }),
      setPreparingEmployment: v => set({ preparingEmployment: v }),
      resetAll: () => set(initialState),
    }),
    {
      name: STORE_NAME.cvWizard,
      storage: createJSONStorage(() => sessionStorage),
    },
  ),
);

/** 저장된 상태가 불완전할 때 유효한 단계로 보정합니다. */
export function getValidatedWizardStep(): CvWizardUiStep {
  const { wizardStep, pendingCvId, generatedPrompt } = useCvWizardStore.getState();
  const hasPrompt = Boolean(generatedPrompt?.trim());
  if (wizardStep === 4) {
    if (pendingCvId !== null && hasPrompt) return 4;
    if (hasPrompt) return 3;
    return 2;
  }
  if (wizardStep === 3.5) return hasPrompt ? 3.5 : 2;
  if (wizardStep === 3) return hasPrompt ? 3 : 2;
  if (wizardStep === 2) return 2;
  return 1;
}

export default useCvWizardStore;
