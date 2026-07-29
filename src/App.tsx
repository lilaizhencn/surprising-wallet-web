import { Component, lazy, Suspense, type ComponentType, type ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { App as AntApp, Button, Spin } from 'antd';
import { ConsoleShell } from './components/ConsoleShell';
import { ProtectedRoute } from './components/ProtectedRoute';
import { PublicDocsShell } from './components/PublicDocsShell';

const LandingPage = lazyRoute(() => import('./pages/LandingPage'));
const LoginPage = lazyRoute(() => import('./pages/LoginPage'));
const OverviewPage = lazyRoute(() => import('./pages/OverviewPage'));
const AddressesPage = lazyRoute(() => import('./pages/AddressesPage'));
const TransfersPage = lazyRoute(() => import('./pages/TransfersPage'));
const ApiAccessPage = lazyRoute(() => import('./pages/ApiAccessPage'));
const AuditPage = lazyRoute(() => import('./pages/AuditPage'));
const TenantsPage = lazyRoute(() => import('./pages/TenantsPage'));
const TenantDetailPage = lazyRoute(() => import('./pages/TenantDetailPage'));
const WalletConfigOverviewPage = lazyRoute(() => import('./pages/WalletConfigOverviewPage'));
const WalletChainDetailPage = lazyRoute(() => import('./pages/WalletChainDetailPage'));
const TenantChainsPage = lazyRoute(() => import('./pages/TenantChainsPage'));
const DeveloperDocsPage = lazyRoute(() => import('./pages/DeveloperDocsPage'));
const AssetRecoveriesPage = lazyRoute(() => import('./pages/AssetRecoveriesPage'));

const ROUTE_RELOAD_PREFIX = 'wallet-web:route-reload:';
const ROUTE_ERROR_RELOAD_PREFIX = 'wallet-web:route-error-reload:';

function lazyRoute<T extends ComponentType<any>>(loader: () => Promise<{ default: T }>) {
  return lazy(async () => {
    const reloadKey = `${ROUTE_RELOAD_PREFIX}${window.location.pathname}`;
    try {
      const module = await loader();
      sessionStorage.removeItem(reloadKey);
      return module;
    } catch (error) {
      if (!sessionStorage.getItem(reloadKey)) {
        sessionStorage.setItem(reloadKey, '1');
        window.location.reload();
        return new Promise<{ default: T }>(() => undefined);
      }
      throw error;
    }
  });
}

class RouteErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch() {
    const reloadKey = `${ROUTE_ERROR_RELOAD_PREFIX}${window.location.pathname}`;
    const lastReload = Number(sessionStorage.getItem(reloadKey) ?? 0);
    if (!lastReload || Date.now() - lastReload > 60_000) {
      sessionStorage.setItem(reloadKey, String(Date.now()));
      window.location.reload();
    }
  }

  render() {
    if (this.state.failed) {
      return (
        <div className="route-fallback" role="alert">
          <Button type="primary" onClick={() => window.location.reload()}>
            Reload application
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}

function RouteFallback() {
  return (
    <div className="route-fallback" aria-live="polite">
      <Spin size="large" />
    </div>
  );
}

export default function App() {
  return (
    <AntApp>
      <RouteErrorBoundary>
        <Suspense fallback={<RouteFallback />}>
          <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/console/login" element={<LoginPage />} />
          <Route element={<PublicDocsShell />}>
            <Route path="/console/developer-docs" element={<DeveloperDocsPage />} />
          </Route>
          <Route element={<ProtectedRoute accountType="tenant" />}>
            <Route path="/console" element={<ConsoleShell accountType="tenant" />}>
              <Route index element={<Navigate to="overview" replace />} />
              <Route element={<ProtectedRoute accountType="tenant" requiredScope="assets:read" />}>
                <Route path="overview" element={<OverviewPage />} />
              </Route>
              <Route element={<ProtectedRoute accountType="tenant" requiredScope="chains:read" />}>
                <Route path="chains" element={<TenantChainsPage />} />
              </Route>
              <Route element={<ProtectedRoute accountType="tenant" requiredRole="TENANT_ADMIN" />}>
                <Route path="api-access" element={<ApiAccessPage />} />
              </Route>
              <Route element={<ProtectedRoute accountType="tenant" requiredScope="addresses:read" />}>
                <Route path="addresses" element={<AddressesPage />} />
              </Route>
              <Route element={<ProtectedRoute accountType="tenant" requiredScope="deposits:read" />}>
                <Route path="deposits" element={<TransfersPage type="deposits" />} />
                <Route path="asset-recoveries" element={<AssetRecoveriesPage />} />
              </Route>
              <Route element={<ProtectedRoute accountType="tenant" requiredScope="withdrawals:read" />}>
                <Route path="withdrawals" element={<TransfersPage type="withdrawals" />} />
              </Route>
              <Route element={<ProtectedRoute accountType="tenant" requiredScope="audit:read" />}>
                <Route path="audit-log" element={<AuditPage />} />
              </Route>
            </Route>
          </Route>
          <Route element={<ProtectedRoute accountType="platform" />}>
            <Route path="/platform" element={<ConsoleShell accountType="platform" />}>
              <Route index element={<Navigate to="wallet-config" replace />} />
              <Route path="wallet-config" element={<WalletConfigOverviewPage />} />
              <Route path="wallet-config/chains" element={<Navigate to="/platform/wallet-config" replace />} />
              <Route path="wallet-config/chains/:chainId" element={<WalletChainDetailPage />} />
              <Route path="wallet-config/tokens" element={<Navigate to="/platform/wallet-config" replace />} />
              <Route path="wallet-config/audit-log" element={<AuditPage platform />} />
              <Route path="tenants" element={<TenantsPage />} />
              <Route path="tenants/:tenantId" element={<TenantDetailPage />} />
              <Route path="asset-recoveries" element={<AssetRecoveriesPage platform />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </RouteErrorBoundary>
    </AntApp>
  );
}
