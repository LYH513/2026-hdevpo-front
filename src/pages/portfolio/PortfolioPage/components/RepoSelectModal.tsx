import { LoadingIcon, SearchIcon } from '@/assets';
import EmptyBoxImg from '@/assets/imgs/emptyBox.svg?react';
import { Button, Flex, Heading, Input, Modal, Text } from '@/components';
import { palette } from '@/styles/palette';
import type { GitHubOrgItem } from '@/pages/profile/types/github';
import { getGitHubOrgs, readGitHubNameFromStorage } from '@/pages/profile/apis/github';
import type { PortfolioRepositoryItem, PutRepositoryItem } from '../../apis/portfolio';
import {
  getAllRepositories,
  getRepositories,
  postGithubRepositoriesCacheRefresh,
  putRepositories,
} from '../../apis/portfolio';
import { formatDateRange } from '../../utils/date';
import {
  portfolioRepoToRepoItem,
  usePortfolioContext,
} from '../context/PortfolioContext';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type FunctionComponent,
  type SVGProps,
} from 'react';
import Checkbox from '@mui/material/Checkbox';
import LinearProgress from '@mui/material/LinearProgress';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import RefreshIcon from '@mui/icons-material/Refresh';
import {
  Avatar,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  styled,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { toast } from 'react-toastify';

interface RepoSelectModalProps {
  open: boolean;
  onClose: () => void;
}

/** 목록은 페이지당 10건 GET, 확인 시에만 전체 페이지를 순회해 PUT (서버 스키마 유지) */
const REPOS_PER_PAGE = 10;
/** 입력 디바운스 후 GET `search` 반영 (ms) */
const SEARCH_DEBOUNCE_MS = 200;
const SELF_OWNER_TOKEN = '__self__';

function portfolioRepoListTitle(repo: PortfolioRepositoryItem): string {
  if (repo.custom_title != null && repo.custom_title.trim() !== '') {
    return repo.custom_title.trim();
  }
  if (repo.github_title != null && repo.github_title.trim() !== '') {
    return repo.github_title.trim();
  }
  return String(repo.repo_id);
}

const RepoSelectModal = ({ open, onClose }: RepoSelectModalProps) => {
  const theme = useTheme();
  const compactRepoPagination = useMediaQuery('(max-width: 429px)');
  const { setRepos, repos: portfolioRepos } = usePortfolioContext();
  const [pageRepos, setPageRepos] = useState<PortfolioRepositoryItem[]>([]);
  const [loadedRepoById, setLoadedRepoById] = useState<
    Map<number, PortfolioRepositoryItem>
  >(() => new Map());
  const [page, setPage] = useState(1);
  /** GET 응답 `total` — 검색·owner 필터 기준 전체 건수 */
  const [repoTotal, setRepoTotal] = useState(0);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  /** 디바운스(또는 검색 버튼·Enter 즉시) 확정값 → queryParams.search */
  const [appliedSearch, setAppliedSearch] = useState('');
  const [orgs, setOrgs] = useState<GitHubOrgItem[]>([]);
  const [orgsLoading, setOrgsLoading] = useState(false);
  const [githubUsername, setGithubUsername] = useState('');
  const [selectedOwner, setSelectedOwner] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  /** 확인 클릭 후: 전체 목록 fetch → PUT 저장 단계 구분(오버레이 문구) */
  const [submitPhase, setSubmitPhase] = useState<'fetchAll' | 'save'>(
    'fetchAll',
  );
  const [refreshing, setRefreshing] = useState(false);
  const [listVersion, setListVersion] = useState(0);

  /** 사용자가 체크박스를 건드린 뒤에는 컨텍스트 동기화로 선택을 덮어쓰지 않음 */
  const selectionTouchedRef = useRef(false);
  const portfolioReposRef = useRef(portfolioRepos);
  portfolioReposRef.current = portfolioRepos;

  // 모달이 열리자마자 백그라운드에서 전체 레포 프리페치 시작
  // 확인 클릭 시 이미 완료된 Promise를 재사용해 대기 시간 최소화
  const allReposPromiseRef = useRef<Promise<PortfolioRepositoryItem[]> | null>(null);
  const loadedRepoByIdRef = useRef(loadedRepoById);
  loadedRepoByIdRef.current = loadedRepoById;
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const queryParams = useMemo(() => {
    const search =
      appliedSearch.trim() === '' ? undefined : appliedSearch.trim();
    const ownerRaw = selectedOwner.trim();
    const owner =
      ownerRaw === ''
        ? undefined
        : ownerRaw === SELF_OWNER_TOKEN
          ? githubUsername.trim() || undefined
          : ownerRaw;
    return { search, owner };
  }, [appliedSearch, selectedOwner, githubUsername]);

  useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(() => {
      setAppliedSearch(searchQuery.trim());
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(id);
  }, [searchQuery, open]);

  useEffect(() => {
    setPage(1);
    setRepoTotal(0);
  }, [appliedSearch, selectedOwner]);

  /** 디바운스 기다리지 않고 즉시 검색(Enter·버튼) */
  const runSearch = useCallback(() => {
    if (loading) return;
    setAppliedSearch(searchQuery.trim());
    setPage(1);
    queueMicrotask(() => searchInputRef.current?.focus());
  }, [searchQuery, loading]);

  useLayoutEffect(() => {
    if (!open) return;
    selectionTouchedRef.current = false;
    setPage(1);
    setRepoTotal(0);
    setLoadedRepoById(new Map());
    setSearchQuery('');
    setAppliedSearch('');
    setSelectedOwner(SELF_OWNER_TOKEN);
    setOrgs([]);
    setGithubUsername('');
    setSelectedIds(
      new Set(
        portfolioReposRef.current.filter(r => r.is_visible).map(r => r.repo_id),
      ),
    );
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setGithubUsername(readGitHubNameFromStorage());
    setOrgsLoading(true);
    Promise.allSettled([getGitHubOrgs()])
      .then(results => {
        const [orgsRes] = results;
        const nextOrgs =
          orgsRes.status === 'fulfilled' && Array.isArray(orgsRes.value)
            ? orgsRes.value
            : [];

        setOrgs(nextOrgs);
        // 디폴트는 owner 쿼리 없이(전체) — UI는 "내 계정" 토큰을 선택 상태로 유지
        setSelectedOwner(SELF_OWNER_TOKEN);
      })
      .catch(() => {
        // ignore (allSettled라 일반적으로 여기로 오지 않음)
      })
      .finally(() => setOrgsLoading(false));
  }, [open]);

  useEffect(() => {
    if (!open || selectionTouchedRef.current) return;
    setSelectedIds(
      new Set(portfolioRepos.filter(r => r.is_visible).map(r => r.repo_id)),
    );
  }, [open, portfolioRepos]);

  // 모달이 열리거나 캐시가 갱신되면 백그라운드에서 전체 레포 프리페치
  // 검색 필터 없이 전체를 가져와야 PUT body가 완전해짐
  useEffect(() => {
    if (!open) {
      allReposPromiseRef.current = null;
      return;
    }
    allReposPromiseRef.current = getAllRepositories({
      perPage: REPOS_PER_PAGE,
    });
  }, [open, listVersion]);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    const { search, owner } = queryParams;

    getRepositories({
      page,
      per_page: REPOS_PER_PAGE,
      search,
      owner,
    })
      .then(res => {
        const list = res.repositories ?? [];
        setPageRepos(list);
        setRepoTotal(res.total ?? list.length);
        setLoadedRepoById(prev => {
          const next = new Map(prev);
          for (const r of list) {
            next.set(r.repo_id, r);
          }
          return next;
        });
      })
      .catch(() => {
        toast.error('레포지토리 목록을 불러오지 못했습니다.');
        onClose();
      })
      .finally(() => setLoading(false));
  }, [open, onClose, page, queryParams, listVersion]);

  const handleRefreshCache = useCallback(async () => {
    setRefreshing(true);
    try {
      await postGithubRepositoriesCacheRefresh();
      setListVersion(v => v + 1);
      allReposPromiseRef.current = getAllRepositories({
        perPage: REPOS_PER_PAGE,
      });
      toast.success('레포지토리 목록을 최신화했습니다.', {
        position: 'top-center',
      });
    } catch {
      toast.error('레포지토리 캐시 갱신에 실패했습니다.');
    } finally {
      setRefreshing(false);
    }
  }, []);

  const toggleRepo = useCallback((repoId: number) => {
    selectionTouchedRef.current = true;
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(repoId)) next.delete(repoId);
      else next.add(repoId);
      return next;
    });
  }, []);

  const handleConfirm = useCallback(async () => {
    setSubmitPhase('fetchAll');
    setSubmitting(true);
    // 상태 반영·로딩 오버레이가 한 프레임 그려진 뒤 네트워크 대기 (미표시 방지)
    await Promise.resolve();
    try {
      // 이미 백그라운드에서 시작된 프리페치 Promise를 재사용 (검색 없이 전체 레포)
      const fullList = await (allReposPromiseRef.current ?? getAllRepositories({
        perPage: REPOS_PER_PAGE,
      }));
      setSubmitPhase('save');
      const putBody: PutRepositoryItem[] = fullList.map(p => ({
        repo_id: p.repo_id,
        custom_title: p.custom_title != null ? p.custom_title : '',
        description: p.description != null ? p.description : '',
        is_visible: selectedIds.has(p.repo_id),
      }));
      // fullList에 없는 selectedIds(검색·타이밍 차이로 누락된 레포)도 PUT body에 포함
      const fullListIdSet = new Set(fullList.map(p => p.repo_id));
      for (const id of selectedIds) {
        if (!fullListIdSet.has(id)) {
          const repo =
            loadedRepoByIdRef.current.get(id) ??
            portfolioReposRef.current.find(r => r.repo_id === id);
          putBody.push({
            repo_id: id,
            custom_title: repo?.custom_title ?? null,
            description: repo?.description ?? '',
            is_visible: true,
          });
        }
      }
      await putRepositories(putBody);
      const visible = await getAllRepositories({ visible_only: true });
      setRepos((visible ?? []).map(portfolioRepoToRepoItem));
      toast.success('변경사항이 저장되었습니다.', {
        position: 'top-center',
      });
      onClose();
    } catch {
      toast.error('레포지토리 저장에 실패했습니다.');
    } finally {
      setSubmitting(false);
      setSubmitPhase('fetchAll');
    }
  }, [selectedIds, setRepos, onClose]);

  const handleModalClose = useCallback(() => {
    if (submitting || refreshing) return;
    onClose();
  }, [submitting, refreshing, onClose]);

  const selectedRepos = useMemo(() => {
    return [...selectedIds]
      .map(id => {
        const loaded = loadedRepoById.get(id);
        if (loaded) return loaded;
        const pr = portfolioRepos.find(r => r.repo_id === id);
        if (pr) {
          return {
            repo_id: pr.repo_id,
            custom_title: pr.custom_title,
            github_title: pr.github_title,
            description: pr.description,
            github_description: pr.github_description,
            is_visible: pr.is_visible,
            display_order: pr.display_order ?? 0,
            html_url: pr.html_url ?? '',
            created_at: pr.created_at,
            updated_at: pr.updated_at,
            visibility: '',
            owner: pr.owner ?? '',
            id: pr.id ?? 0,
            language: pr.languages[0],
            languages: pr.languageBreakdown,
          } satisfies PortfolioRepositoryItem;
        }
        return {
          repo_id: id,
          custom_title: null,
          github_title: '',
          description: '',
          github_description: '',
          is_visible: false,
          display_order: 0,
          html_url: '',
          created_at: '',
          updated_at: '',
          visibility: '',
          owner: '',
          id: 0,
        } satisfies PortfolioRepositoryItem;
      })
      .sort((a, b) => a.repo_id - b.repo_id);
  }, [selectedIds, loadedRepoById, portfolioRepos]);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(repoTotal / REPOS_PER_PAGE)),
    [repoTotal],
  );
  const hasPrevPage = page > 1;
  const hasNextPage =
    repoTotal > 0 ? page < totalPages : pageRepos.length >= REPOS_PER_PAGE;
  const selectedCount = selectedIds.size;

  return (
    <Modal
      open={open}
      toggleModal={handleModalClose}
      size="large"
      hasCloseButton
      style={{ backgroundColor: theme.palette.background.default }}
    >
      <S.ModalSurface aria-busy={submitting || refreshing}>
      <Modal.Header position="start">레포지토리 선택</Modal.Header>
      <Modal.Body position="start" style={{ gap: '1rem', marginTop: '0.5rem' }}>
        <Flex.Row
          justify="space-between"
          align="center"
          wrap="wrap"
          gap="0.75rem"
          style={{ width: '100%' }}
        >
          <Text
            style={{
              ...theme.typography.body2,
              color: theme.palette.grey[600],
              margin: 0,
              flex: '1 1 auto',
              minWidth: 'min(100%, 12rem)',
            }}
          >
            포트폴리오에 추가할 레포지토리를 선택하세요. 기여하지 않은 레포지토리는 자동으로 제외됩니다.
          </Text>
          <Button
            label="레포지토리 목록 업데이트"
            variant="outlined"
            size="medium"
            icon={
              RefreshIcon as FunctionComponent<SVGProps<SVGSVGElement>>
            }
            iconPosition="start"
            disabled={refreshing || submitting}
            onClick={handleRefreshCache}
            style={{ flexShrink: 0, marginLeft: 'auto' }}
          />
        </Flex.Row>
        <S.FilterBar>
          <Flex.Row gap="0.5rem" align="center" style={{ flexShrink: 0 }}>
            <Input
              placeholder="레포지토리 검색..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  runSearch();
                }
              }}
              inputRef={searchInputRef}
              style={{
                width: '100%',
                maxWidth: '20rem',
                backgroundColor:
                  theme.palette.variant?.default ?? theme.palette.grey[50],
              }}
              inputProps={{ 'aria-label': '레포지토리 검색' }}
            />
            <S.SearchButton
              type="button"
              aria-label="검색"
              disabled={loading}
              onMouseDown={e => {
                if (!loading) e.preventDefault();
              }}
              onClick={runSearch}
            >
              <SearchIcon />
            </S.SearchButton>
          </Flex.Row>
          <S.FilterRight>
            <FormControl
              size="small"
              sx={{
                width: 200,
                minWidth: 160,
                flex: '0 0 auto',
              }}
              disabled={orgsLoading}
            >
              <InputLabel>Organization</InputLabel>
              <Select
                value={selectedOwner}
                label="Organization"
                displayEmpty
                onChange={e => {
                  setSelectedOwner(String(e.target.value ?? ''));
                  setPage(1);
                }}
                renderValue={value => {
                  const v = String(value ?? '');
                  if (v.trim() === '' || v === SELF_OWNER_TOKEN) {
                    return githubUsername.trim() !== ''
                      ? githubUsername.trim()
                      : '내 계정';
                  }
                  const item = orgs.find(o => o.owner === v);
                  if (!item) return v || 'Organization';
                  return (
                    <S.OrgSelectedValue align="center" gap="0.5rem">
                      <Avatar
                        src={item.avatarUrl}
                        alt={item.owner}
                        sx={{ width: 22, height: 22, flexShrink: 0 }}
                      />
                      <span>{item.owner}</span>
                    </S.OrgSelectedValue>
                  );
                }}
                MenuProps={{
                  PaperProps: {
                    sx: { maxHeight: 340 },
                  },
                }}
                sx={{
                  backgroundColor:
                    theme.palette.variant?.default ?? theme.palette.grey[50],
                }}
              >
                <MenuItem value={SELF_OWNER_TOKEN}>
                  <Text
                    style={{
                      ...theme.typography.body2,
                      margin: 0,
                      color: theme.palette.text.primary,
                    }}
                  >
                    {githubUsername.trim() !== '' ? githubUsername.trim() : '내 계정'}
                  </Text>
                </MenuItem>
                {orgs.map(org => (
                  <MenuItem key={org.id} value={org.owner}>
                    <Flex.Row align="center" gap="0.5rem">
                      <Avatar
                        src={org.avatarUrl}
                        alt={org.owner}
                        sx={{ width: 22, height: 22, flexShrink: 0 }}
                      />
                      <Text
                        style={{
                          ...theme.typography.body2,
                          margin: 0,
                          color: theme.palette.text.primary,
                        }}
                      >
                        {org.owner}
                      </Text>
                    </Flex.Row>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </S.FilterRight>
        </S.FilterBar>
        {selectedRepos.length > 0 && (
          <S.SelectedTags wrap="wrap" gap="0.5rem">
            {selectedRepos.map(repo => (
              <S.SelectedTag
                key={repo.repo_id}
                type="button"
                onClick={e => {
                  e.preventDefault();
                  e.stopPropagation();
                  toggleRepo(repo.repo_id);
                }}
                aria-label={`${portfolioRepoListTitle(repo)} 선택 해제`}
              >
                <span>{portfolioRepoListTitle(repo)}</span>
                <S.TagRemove aria-hidden>×</S.TagRemove>
              </S.SelectedTag>
            ))}
          </S.SelectedTags>
        )}
        <S.ListWrap>
          {loading ? (
            <S.LoadingWrap>
              <LinearProgress
                sx={{
                  width: '12rem',
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: palette.blue300,
                  '& .MuiLinearProgress-bar': {
                    backgroundColor: palette.blue500,
                  },
                }}
              />
            </S.LoadingWrap>
          ) : (
          <>
          <S.List>
            {pageRepos.length === 0 ? (
              <S.EmptyState
                width="100%"
                height="100%"
                justify="center"
                align="center"
                gap="0.75rem"
                style={{ minHeight: 180 }}
              >
                <EmptyBoxImg width={72} height={72} />
                <Heading as="h3" style={{ color: theme.palette.grey300 }}>
                  {appliedSearch.trim()
                    ? '검색 결과가 없습니다'
                    : '표시할 레포지토리가 없습니다'}
                </Heading>
              </S.EmptyState>
            ) : (
            pageRepos.map(repo => (
              <S.Row
                key={repo.repo_id}
                role="button"
                tabIndex={0}
                onClick={() => toggleRepo(repo.repo_id)}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    toggleRepo(repo.repo_id);
                  }
                }}
              >
                <Checkbox
                  checked={selectedIds.has(repo.repo_id)}
                  onChange={() => toggleRepo(repo.repo_id)}
                  onClick={e => e.stopPropagation()}
                  sx={{
                    color: palette.grey400,
                    '&.Mui-checked': { color: palette.blue500 },
                  }}
                />
                <Flex.Column gap="0.5rem" style={{ flex: 1, minWidth: 0 }}>
                  {repo.html_url ? (
                    <S.RepoNameLink
                      href={repo.html_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={e => e.stopPropagation()}
                      style={{
                        ...theme.typography.body2,
                        fontWeight: 600,
                        margin: 0,
                        color: theme.palette.text.primary,
                      }}
                    >
                      {portfolioRepoListTitle(repo)}
                    </S.RepoNameLink>
                  ) : (
                    <Text
                      style={{
                        ...theme.typography.body2,
                        fontWeight: 600,
                        margin: 0,
                        color: theme.palette.text.primary,
                      }}
                    >
                      {portfolioRepoListTitle(repo)}
                    </Text>
                  )}
                  {repo.description && (
                    <Text
                      style={{
                        ...theme.typography.caption,
                        color: theme.palette.grey[600],
                        margin: 0,
                      }}
                    >
                      {repo.description}
                    </Text>
                  )}
                  <Text
                    style={{
                      ...theme.typography.caption,
                      color: theme.palette.grey[500],
                      margin: 0,
                      width: '100%',
                    }}
                  >
                    {formatDateRange(repo.created_at, repo.updated_at)}
                  </Text>
                </Flex.Column>
              </S.Row>
            ))
            )}
          </S.List>
          <S.PaginationBar align="center" wrap="wrap">
            {compactRepoPagination ? (
              <S.PaginationIconSlot>
                <Button
                  label=""
                  aria-label="이전 페이지"
                  variant="outlined"
                  size="medium"
                  icon={
                    ChevronLeftIcon as FunctionComponent<
                      SVGProps<SVGSVGElement>
                    >
                  }
                  iconPosition="start"
                  disabled={!hasPrevPage}
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                />
              </S.PaginationIconSlot>
            ) : (
              <Button
                label="이전"
                variant="outlined"
                size="medium"
                icon={
                  ChevronLeftIcon as FunctionComponent<
                    SVGProps<SVGSVGElement>
                  >
                }
                iconPosition="start"
                disabled={!hasPrevPage}
                onClick={() => setPage(p => Math.max(1, p - 1))}
              />
            )}
            <Text
              style={{
                ...theme.typography.body2,
                color: theme.palette.grey[600],
                margin: 0,
                flex: '1 1 0',
                minWidth: 0,
                textAlign: 'center',
              }}
            >
              {page} / {totalPages} 페이지 
            </Text>
            {compactRepoPagination ? (
              <S.PaginationIconSlot>
                <Button
                  label=""
                  aria-label="다음 페이지"
                  variant="outlined"
                  size="medium"
                  icon={
                    ChevronRightIcon as FunctionComponent<
                      SVGProps<SVGSVGElement>
                    >
                  }
                  iconPosition="end"
                  disabled={!hasNextPage}
                  onClick={() => setPage(p => p + 1)}
                />
              </S.PaginationIconSlot>
            ) : (
              <Button
                label="다음"
                variant="outlined"
                size="medium"
                icon={
                  ChevronRightIcon as FunctionComponent<
                    SVGProps<SVGSVGElement>
                  >
                }
                iconPosition="end"
                disabled={!hasNextPage}
                onClick={() => setPage(p => p + 1)}
              />
            )}
          </S.PaginationBar>
          </>
          )}
        </S.ListWrap>
      </Modal.Body>
      <Modal.Footer
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'flex-end',
          alignItems: 'center',
          gap: '0.75rem',
        }}
      >
        <Text
          style={{
            ...theme.typography.body2,
            color: theme.palette.grey[600],
            margin: 0,
          }}
        >
          {selectedCount}개 선택됨
        </Text>
        <Flex.Row gap="0.5rem">
          <Button
            label="취소"
            variant="outlined"
            size="large"
            disabled={submitting || refreshing}
            onClick={handleModalClose}
          />
          <Button
            label="확인"
            variant="contained"
            color="blue"
            size="large"
            disabled={loading || submitting || refreshing}
            onClick={handleConfirm}
          />
        </Flex.Row>
      </Modal.Footer>
      {submitting || refreshing ? (
        <S.SubmitOverlay
          align="center"
          justify="center"
          gap="0.75rem"
          role="status"
          aria-live="polite"
          aria-label={
            refreshing
              ? '레포지토리 목록을 최신화하는 중'
              : submitPhase === 'fetchAll'
                ? '전체 레포지토리 목록을 불러오는 중'
                : '레포지토리 정보를 추가하는 중'
          }
        >
          <LoadingIcon width={88} height={88} aria-hidden />
          <Text
            style={{
              margin: 0,
              fontSize: '0.875rem',
              color: theme.palette.grey[600],
              textAlign: 'center',
            }}
          >
            {refreshing
              ? '레포지토리 목록을 최신화하는 중입니다.'
              : submitPhase === 'fetchAll'
                ? '전체 레포지토리 목록을 불러오는 중입니다.'
                : '레포지토리 정보를 추가중입니다.'}
          </Text>
        </S.SubmitOverlay>
      ) : null}
      </S.ModalSurface>
    </Modal>
  );
};

export default RepoSelectModal;

const LIST_AREA_HEIGHT = '28rem';

const S = {
  ModalSurface: styled('div')`
    position: relative;
    width: 100%;
  `,
  SubmitOverlay: styled(Flex.Column)`
    position: absolute;
    inset: 0;
    z-index: 10;
    border-radius: 0.75rem;
    background-color: rgba(250, 250, 252, 0.94);
    box-sizing: border-box;
    padding: 1.5rem;
  `,
  FilterBar: styled('div')`
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 0.75rem;
    width: 100%;
  `,
  FilterRight: styled('div')`
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: flex-end;
    gap: 0.5rem;
    flex: 1 1 12rem;
    min-width: min(100%, 12rem);
  `,
  OrgSelectedValue: styled(Flex.Row)`
    min-width: 0;
    & span {
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  `,
  SearchButton: styled('button')`
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 3rem;
    background-color: ${({ theme }) => theme.palette.primary.main};
    border: none;
    border-radius: 0.4rem;
    padding: 0.8rem 1.25rem;
    cursor: pointer;
    color: ${palette.white};
    & svg {
      width: 22px;
      height: 22px;
    }
    &:hover:not(:disabled),
    &:active:not(:disabled) {
      background-color: ${palette.blue600};
    }
    &:disabled {
      opacity: 0.55;
      cursor: not-allowed;
    }
  `,
  ListWrap: styled('div')`
    display: flex;
    flex-direction: column;
    width: 100%;
    height: ${LIST_AREA_HEIGHT};
    min-height: ${LIST_AREA_HEIGHT};
    flex-shrink: 0;
  `,
  LoadingWrap: styled('div')`
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    min-height: ${LIST_AREA_HEIGHT};
  `,
  List: styled('div')`
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    width: 100%;
    flex: 1 1 auto;
    min-height: 0;
    overflow-y: auto;
  `,
  EmptyHint: styled(Text)`
    margin: 0;
    padding: 1.5rem 1rem;
    text-align: center;
    color: ${({ theme }) => theme.palette.grey[600]};
    font-size: 0.875rem;
  `,
  EmptyState: styled(Flex.Column)`
    padding: 1.5rem 1rem;
    box-sizing: border-box;
  `,
  PaginationBar: styled(Flex.Row)`
    flex-shrink: 0;
    width: 100%;
    padding-top: 0.625rem;
    margin-top: 0.25rem;
    border-top: 1px solid ${({ theme }) => theme.palette.grey[200]};
    gap: 0.5rem;
    @media (max-width: 429px) {
      flex-wrap: nowrap;
    }
  `,
  PaginationIconSlot: styled('div')`
    flex-shrink: 0;
    & .MuiButton-root {
      min-width: 2.25rem;
      padding-left: 0;
      padding-right: 0;
    }
    & .MuiButton-startIcon,
    & .MuiButton-endIcon {
      margin: 0;
    }
  `,
  Row: styled(Flex.Row)`
    align-items: flex-start;
    gap: 1rem;
    padding: 1rem 1.25rem;
    border-radius: 0.75rem;
    background-color: ${({ theme }) => theme.palette.background.paper};
    border: 1px solid ${({ theme }) => theme.palette.grey[200]};
    cursor: pointer;
    transition: box-shadow 0.2s ease, border-color 0.2s ease;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
    &:hover {
      border-color: ${palette.blue300};
      box-shadow: 0 2px 8px rgba(83, 127, 241, 0.08);
    }
  `,
  RepoNameLink: styled('a')`
    color: ${palette.blue500};
    text-decoration: none;
    cursor: pointer;
    &:hover {
      color: ${palette.blue600};
      text-decoration: underline;
    }
  `,
  SelectedTags: styled(Flex.Row)`
    width: 100%;
  `,
  SelectedTag: styled('button')`
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.35rem 0.5rem 0.35rem 0.75rem;
    border-radius: 999px;
    border: 1.5px solid ${palette.blue400};
    background-color: ${palette.white};
    color: ${palette.blue600};
    font-size: 0.8125rem;
    font-weight: 500;
    cursor: pointer;
    transition: background-color 0.2s ease, border-color 0.2s ease;
    &:hover {
      background-color: ${palette.blue300};
      border-color: ${palette.blue500};
    }
    span {
      max-width: 12rem;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  `,
  TagRemove: styled('span')`
    font-size: 1.125rem;
    line-height: 1;
    opacity: 0.8;
  `,
};
