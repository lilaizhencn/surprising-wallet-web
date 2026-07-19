import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useSession, type AccountType } from '../auth/session';

export function ProtectedRoute({ accountType }: { accountType: AccountType }) {
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
  return <Outlet />;
}
