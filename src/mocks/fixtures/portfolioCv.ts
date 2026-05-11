import type { PortfolioCvDetail } from '@/pages/cv/apis/cv';

const emptyDesignPreferences = {
  layout: '',
  color_theme: '',
  density: '',
  additional_notes: '',
};

/** 상세 프롬프트 위「AI 맞춤 디자인」블록 확인용 */
const mockDesignPrefsNaver: PortfolioCvDetail['design_preferences'] = {
  layout: '랜딩 페이지',
  color_theme: 'rose',
  density: '1페이지 내',
  additional_notes:
    '상단에 프로젝트(깃허브) 링크를 두드러지게 배치하고, 마일리지는 요약 카드 스타일로 정리해 주세요.',
};

const mockDesignPrefsKakao: PortfolioCvDetail['design_preferences'] = {
  layout: '사이드바',
  color_theme: 'emerald',
  density: '페이지 제한 없음',
  additional_notes: '',
};

export const mockPortfolioCvDetails: PortfolioCvDetail[] = [
  {
    id: 1,
    title: '네이버',
    job_posting: '2026 상반기 백엔드 신입 채용',
    target_position: '백엔드 개발자',
    additional_notes: 'Go, 분산 시스템 경험 강조',
    design_preferences: { ...mockDesignPrefsNaver },
    mode: 'cv',
    prompt:
      '# 이력서용 프롬프트 (Mock)\n\n- 지원 회사: 네이버\n- 직무: 백엔드 개발자\n',
    html_content:
      '<p><strong>경력 요약</strong></p><p>운영체제·알고리즘 프로젝트를 수행했습니다. (Mock HTML)</p>',
    public_token: '1000000001',
    is_public: false,
    created_at: '2026-03-20T09:00:00.000Z',
    updated_at: '2026-03-20T10:30:00.000Z',
    selected_repo_ids: [],
    selected_mileage_ids: [],
    selected_activity_ids: [],
  },
  {
    id: 2,
    title: '카카오',
    job_posting: '플랫폼 서버 개발자 채용',
    target_position: '서버 개발자',
    additional_notes: '',
    design_preferences: { ...mockDesignPrefsKakao },
    mode: 'archive',
    prompt: '# 이력서용 프롬프트 (Mock)\n\n- 지원 회사: 카카오\n',
    html_content: '<p>Mock 이력서 본문입니다.</p>',
    public_token: '1000000002',
    is_public: true,
    created_at: '2026-03-18T14:00:00.000Z',
    updated_at: '2026-03-19T11:00:00.000Z',
    selected_repo_ids: [1],
    selected_mileage_ids: [],
    selected_activity_ids: [],
  },
  /** 공개 + HTML 비어 있음 → GET share html 목에서 204 시뮬레이션용 */
  {
    id: 3,
    title: '공개·HTML대기',
    job_posting: '',
    target_position: '개발자',
    additional_notes: '',
    design_preferences: { ...emptyDesignPreferences },
    mode: 'cv',
    prompt: '',
    html_content: '',
    public_token: '1000000003',
    is_public: true,
    created_at: '2026-03-10T09:00:00.000Z',
    updated_at: '2026-03-10T09:00:00.000Z',
    selected_repo_ids: [],
    selected_mileage_ids: [],
    selected_activity_ids: [],
  },
];
