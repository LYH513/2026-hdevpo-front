import { BASE_URL } from '@/apis/config';
import { ENDPOINT } from '@/apis/endPoint';

const LOCAL_PREFIX = 'local:';

/**
 * `profile_image_url`이 서버 저장 파일명이면 API 이미지 URL로,
 * `local:파일명`이면 Vite public 루트 기준 경로(`/파일명`)로 해석합니다.
 */
export function getProfileImageUrl(filename: string | null | undefined): string | null {
  const trimmed = filename?.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith(LOCAL_PREFIX)) {
    const path = trimmed.slice(LOCAL_PREFIX.length).trim().replace(/^\/+/, '');
    return path ? `/${encodeURI(path)}` : null;
  }
  return `${BASE_URL}${ENDPOINT.PORTFOLIO_USER_INFO_IMAGE}/${encodeURIComponent(trimmed)}`;
}
