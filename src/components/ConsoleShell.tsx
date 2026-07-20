import { useMemo, useState } from 'react';
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
  SwapOutlined,
  TeamOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { clearSession, useSession, type AccountType } from '../auth/session';
import { Brand } from './Brand';

const { Header, Sider, Content } = Layout;

const tenantItems = [
  { key: '/console/overview', icon: <DashboardOutlined />, label: 'Overview' },
  { key: '/console/assets', icon: <BankOutlined />, label: 'Assets' },
  { key: '/console/gas-station', icon: <ThunderboltOutlined />, label: 'Gas station' },
  { key: '/console/addresses', icon: <DatabaseOutlined />, label: 'Addresses' },
  { key: '/console/deposits', icon: <GlobalOutlined />, label: 'Deposits' },
  { key: '/console/withdrawals', icon: <SwapOutlined />, label: 'Withdrawals' },
  { key: '/console/webhooks', icon: <LinkOutlined />, label: 'Webhooks' },
  { key: '/console/api-access', icon: <ApiOutlined />, label: 'API access' },
  { key: '/console/audit-log', icon: <AuditOutlined />, label: 'Audit log' },
];

const platformItems = [
  { key: '/platform/wallet-config', icon: <DashboardOutlined />, label: 'Wallet config' },
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
  const items = accountType === 'platform' ? platformItems : tenantItems;
  const selectedMenuKey = accountType === 'platform'
    ? platformItems.find((item) => location.pathname.startsWith(item.key))?.key ?? location.pathname
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
        label: 'Sign out',
        onClick: async () => {
          if (session) {
            const path = accountType === 'platform'
              ? '/custody/platform/v1/auth/logout'
              : '/custody/console/v1/auth/logout';
            try {
              await api.post(path, session.token);
            } catch {
              // Local session removal remains authoritative for this browser.
            }
          }
          clearSession();
          await message.success('Signed out');
          navigate('/console/login', { replace: true });
        },
      },
    ],
    [accountType, message, navigate, session],
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
          {!collapsed ? 'Collapse' : null}
        </Button>
      </Sider>
      <Layout>
        <Header className="console-header">
          <div>
            {accountType === 'tenant' ? (
              <Space size={8}>
                <Typography.Text strong>{session?.tenantSlug}</Typography.Text>
                <Tag variant="filled">Tenant</Tag>
                <Tag icon={<SafetyCertificateOutlined />} color="blue">
                  {deploymentEnvironment}
                </Tag>
              </Space>
            ) : (
              <Typography.Text strong>Platform administration</Typography.Text>
            )}
          </div>
          <Space size={16}>
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
