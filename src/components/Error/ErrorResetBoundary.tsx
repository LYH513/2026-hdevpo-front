import { GlobalErrorBoundary, GlobalSuspense } from '@/components';
import { ROUTE_PATH } from '@/constants/routePath';
import useCvWizardStore from '@/stores/useCvWizardStore';
import { QueryErrorResetBoundary } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { Outlet, useLocation } from 'react-router-dom';

function isCvGenerateWizardPath(pathname: string) {
  return (
    pathname === ROUTE_PATH.cvGenerate ||
    pathname.startsWith(`${ROUTE_PATH.cvGenerate}/`)
  );
}

/** `/cv/generate` 를 벗어나면 CV 생성 마법사 상태를 초기화합니다. (`/cv` 관리 화면은 유지) */
function ClearCvWizardOnLeaveGenerateRoute() {
  const location = useLocation();
  const prevPathnameRef = useRef<string | null>(null);

  useEffect(() => {
    const prev = prevPathnameRef.current;
    if (
      prev != null &&
      isCvGenerateWizardPath(prev) &&
      !isCvGenerateWizardPath(location.pathname)
    ) {
      useCvWizardStore.getState().resetAll();
    }
    prevPathnameRef.current = location.pathname;
  }, [location.pathname]);

  return null;
}

const ErrorResetBoundary = () => {
  return (
    <QueryErrorResetBoundary>
      <GlobalErrorBoundary>
        <GlobalSuspense>
          <>
            <ClearCvWizardOnLeaveGenerateRoute />
            <Outlet />
          </>
        </GlobalSuspense>
      </GlobalErrorBoundary>
    </QueryErrorResetBoundary>
  );
};

export default ErrorResetBoundary;
