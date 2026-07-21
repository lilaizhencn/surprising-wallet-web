import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { hasRole, hasScope, useSession, type AccountType } from '../auth/session';

type ProtectedRouteProps = {
  accountType: AccountType;
  requiredScope?: string;
  requiredRole?: string;
};

export function ProtectedRoute({ accountType, requiredScope, requiredRole }: ProtectedRouteProps) {
  const session = useSession();
  const location = useLocation();

  if (!session || session.accountType !== accountType) {
    return (
      <Navigate
        to="/console/login"
        replace
        state={{ from: location.pathname, accountType }}
      />
    );
  }
  if ((requiredScope && !hasScope(session, requiredScope))
    || (requiredRole && !hasRole(session, requiredRole))) {
    return <Navigate to={accountType === 'platform' ? '/platform' : '/console/overview'} replace />;
  }
  return <Outlet />;
}
