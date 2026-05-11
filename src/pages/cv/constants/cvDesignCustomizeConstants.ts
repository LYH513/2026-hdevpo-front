/** POST generate-html / design_preferences — 서버·UI 공통 허용 값 (최대 50자 필드) */

export const CV_CUSTOMIZE_LAYOUT_VALUES = [
  '단일 칼럼',
  '랜딩 페이지',
  '사이드바',
  '카드 그리드',
] as const;
export type CvCustomizeLayoutValue = (typeof CV_CUSTOMIZE_LAYOUT_VALUES)[number];

export const CV_CUSTOMIZE_COLOR_THEME_VALUES = [
  'indigo',
  'emerald',
  'slate',
  'rose',
  'amber',
  'cyan',
] as const;
export type CvCustomizeColorThemeValue = (typeof CV_CUSTOMIZE_COLOR_THEME_VALUES)[number];

export const CV_CUSTOMIZE_COLOR_THEME_LABELS: Record<CvCustomizeColorThemeValue, string> = {
  indigo: '인디고',
  emerald: '에메랄드',
  slate: '슬레이트',
  rose: '로즈',
  amber: '앰버',
  cyan: '시안',
};

export const CV_CUSTOMIZE_DENSITY_VALUES = ['1페이지 내', '페이지 제한 없음'] as const;
export type CvCustomizeDensityValue = (typeof CV_CUSTOMIZE_DENSITY_VALUES)[number];

export const CV_CUSTOMIZE_MAX_SHORT_FIELD = 50;
export const CV_CUSTOMIZE_MAX_ADDITIONAL_NOTES = 1000;

export type CvColorSwatch = { primary: string; secondary: string; soft: string };

export const CV_COLOR_THEME_SWATCHES: Record<CvCustomizeColorThemeValue, CvColorSwatch> = {
  indigo: { primary: '#6366F1', secondary: '#818CF8', soft: '#C7D2FE' },
  emerald: { primary: '#10B981', secondary: '#34D399', soft: '#A7F3D0' },
  slate: { primary: '#334155', secondary: '#64748B', soft: '#CBD5E1' },
  rose: { primary: '#F43F5E', secondary: '#FB7185', soft: '#FFE4E6' },
  amber: { primary: '#F59E0B', secondary: '#FBBF24', soft: '#FEF3C7' },
  cyan: { primary: '#06B6D4', secondary: '#22D3EE', soft: '#CFFAFE' },
};
