import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { App as AntApp, Spin } from 'antd';
import { ConsoleShell } from './components/ConsoleShell';
import { ProtectedRoute } from './components/ProtectedRoute';

const LandingPage = lazy(() => import('./pages/LandingPage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const OverviewPage = lazy(() => import('./pages/OverviewPage'));
const GasStationPage = lazy(() => import('./pages/GasStationPage'));
const AddressesPage = lazy(() => import('./pages/AddressesPage'));
const TransfersPage = lazy(() => import('./pages/TransfersPage'));
const WebhooksPage = lazy(() => import('./pages/WebhooksPage'));
const ApiAccessPage = lazy(() => import('./pages/ApiAccessPage'));
const AuditPage = lazy(() => import('./pages/AuditPage'));
const TenantsPage = lazy(() => import('./pages/TenantsPage'));
const TenantDetailPage = lazy(() => import('./pages/TenantDetailPage'));
const WalletKeysPage = lazy(() => import('./pages/WalletKeysPage'));

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
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/console/login" element={<LoginPage />} />
          <Route element={<ProtectedRoute accountType="tenant" />}>
            <Route path="/console" element={<ConsoleShell accountType="tenant" />}>
              <Route index element={<Navigate to="overview" replace />} />
              <Route path="overview" element={<OverviewPage />} />
              <Route path="assets" element={<OverviewPage assetsOnly />} />
              <Route path="gas-station" element={<GasStationPage />} />
              <Route path="addresses" element={<AddressesPage />} />
              <Route path="deposits" element={<TransfersPage type="deposits" />} />
              <Route path="withdrawals" element={<TransfersPage type="withdrawals" />} />
              <Route path="webhooks" element={<WebhooksPage />} />
              <Route path="api-access" element={<ApiAccessPage />} />
              <Route path="audit-log" element={<AuditPage />} />
            </Route>
          </Route>
          <Route element={<ProtectedRoute accountType="platform" />}>
            <Route path="/platform" element={<ConsoleShell accountType="platform" />}>
              <Route index element={<Navigate to="tenants" replace />} />
              <Route path="tenants" element={<TenantsPage />} />
              <Route path="tenants/:tenantId" element={<TenantDetailPage />} />
              <Route path="wallet-keys" element={<WalletKeysPage />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </AntApp>
  );
}
