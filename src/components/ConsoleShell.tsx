import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { App, Avatar, Button, Dropdown, Layout, Menu, Space, Tag, Typography } from 'antd';
import {
  ApiOutlined,
  AuditOutlined,
  BankOutlined,
  DashboardOutlined,
  DatabaseOutlined,
  DownOutlined,
  GlobalOutlined,
  LinkOutlined,
  KeyOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  SafetyCertificateOutlined,
  ReadOutlined,
  SwapOutlined,
  TeamOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { clearSession, hasRole, hasScope, useSession, type AccountType } from '../auth/session';
import { useI18n } from '../i18n';
import { Brand } from './Brand';
import { LanguageSwitch } from './LanguageSwitch';

const { Header, Sider, Content } = Layout;

type TenantItemDefinition = {
  key: string;
  icon: ReactNode;
  label: string;
  scope?: string;
  role?: string;
};

const tenantItemDefinitions: TenantItemDefinition[] = [
  { key: '/console/overview', icon: <DashboardOutlined />, label: 'Overview', scope: 'assets:read' },
  { key: '/console/assets', icon: <BankOutlined />, label: 'Assets', scope: 'assets:read' },
  { key: '/console/chains', icon: <GlobalOutlined />, label: 'Tenant chains', scope: 'chains:read' },
  { key: '/console/gas-station', icon: <ThunderboltOutlined />, label: 'Gas station', role: 'TENANT_ADMIN' },
  { key: '/console/addresses', icon: <DatabaseOutlined />, label: 'Addresses', scope: 'addresses:read' },
  { key: '/console/deposits', icon: <GlobalOutlined />, label: 'Deposits', scope: 'deposits:read' },
  { key: '/console/withdrawals', icon: <SwapOutlined />, label: 'Withdrawals', scope: 'withdrawals:read' },
  { key: '/console/webhooks', icon: <LinkOutlined />, label: 'Webhooks', scope: 'webhooks:read' },
  { key: '/console/api-access', icon: <ApiOutlined />, label: 'API access', role: 'TENANT_ADMIN' },
  { key: '/console/developer-docs', icon: <ReadOutlined />, label: 'Developer documentation' },
  { key: '/console/audit-log', icon: <AuditOutlined />, label: 'Audit log', scope: 'audit:read' },
];

const platformItemDefinitions = [
  { key: '/platform/wallet-config', icon: <DashboardOutlined />, label: 'Wallet config' },
  { key: '/platform/wallet-config/chains', icon: <GlobalOutlined />, label: 'Chains & Tokens' },
  { key: '/platform/wallet-config/audit-log', icon: <AuditOutlined />, label: 'Config audit' },
  { key: '/platform/tenants', icon: <TeamOutlined />, label: 'Tenants' },
  { key: '/platform/wallet-keys', icon: <KeyOutlined />, label: 'Wallet keys' },
];
const deploymentEnvironment = import.meta.env.VITE_CUSTODY_ENVIRONMENT ?? 'Sandbox';

export function ConsoleShell({ accountType }: { accountType: AccountType }) {
  const [collapsed, setCollapsed] = useState(false);
  const session = useSession();
  const location = useLocation();
  const navigate = useNavigate();
  const { message } = App.useApp();
  const { t } = useI18n();
  const tenantItems = tenantItemDefinitions
    .filter((item) => (!item.scope || hasScope(session, item.scope))
      && (!item.role || hasRole(session, item.role)))
    .map((item) => ({ ...item, label: t(item.label) }));
  const platformItems = platformItemDefinitions.map((item) => ({ ...item, label: t(item.label) }));
  const items = accountType === 'platform' ? platformItems : tenantItems;
  const selectedMenuKey = accountType === 'platform'
    ? [...platformItems]
      .sort((left, right) => right.key.length - left.key.length)
      .find((item) => location.pathname.startsWith(item.key))?.key ?? location.pathname
    : location.pathname;
  const initials = (session?.displayName || session?.email || 'A')
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const profileItems = useMemo(
    () => [
      {
        key: 'logout',
        icon: <LogoutOutlined />,
        label: t('Sign out'),
        onClick: async () => {
          if (session) {
            const path = accountType === 'platform'
              ? '/custody/platform/v1/auth/logout'
              : '/custody/console/v1/auth/logout';
            try {
              await api.post(path);
            } catch {
              // Local session removal remains authoritative for this browser.
            }
          }
          clearSession();
          await message.success(t('Signed out'));
          navigate('/console/login', { replace: true });
        },
      },
    ],
    [accountType, message, navigate, session, t],
  );

  return (
    <Layout className="console-layout">
      <Sider
        className="console-sider"
        width={214}
        collapsedWidth={72}
        collapsed={collapsed}
        trigger={null}
        breakpoint="lg"
        onBreakpoint={setCollapsed}
      >
        <div className="console-brand">
          <Brand compact={collapsed} />
        </div>
        <Menu
          mode="inline"
          selectedKeys={[selectedMenuKey]}
          items={items}
          onClick={({ key }) => navigate(key)}
        />
        <Button
          className="sider-collapse"
          type="text"
          icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
          onClick={() => setCollapsed((value) => !value)}
        >
          {!collapsed ? t('Collapse') : null}
        </Button>
      </Sider>
      <Layout>
        <Header className="console-header">
          <div>
            {accountType === 'tenant' ? (
              <Space size={8}>
                <Typography.Text strong>{session?.tenantSlug}</Typography.Text>
                <Tag variant="filled">{t('Tenant')}</Tag>
                <Tag icon={<SafetyCertificateOutlined />} color="blue">
                  {deploymentEnvironment}
                </Tag>
              </Space>
            ) : (
              <Typography.Text strong>{t('Platform administration')}</Typography.Text>
            )}
          </div>
          <Space size={16}>
            <LanguageSwitch compact />
            <Dropdown menu={{ items: profileItems }} placement="bottomRight">
              <Button type="text" className="profile-button">
                <Avatar size={30}>{initials}</Avatar>
                <span className="profile-name">{session?.displayName || session?.email}</span>
                <DownOutlined />
              </Button>
            </Dropdown>
          </Space>
        </Header>
        <Content className="console-content">
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
