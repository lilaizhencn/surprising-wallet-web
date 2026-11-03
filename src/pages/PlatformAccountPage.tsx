import { Card, Descriptions } from 'antd';
import { useSession } from '../auth/session';
import { PageHeader } from '../components/PageHeader';
import { useI18n } from '../i18n';

export default function PlatformAccountPage() {
  const session = useSession();
  const { t } = useI18n();
  return <>
    <PageHeader title={t('My account')} />
    <Card>
      <Descriptions column={1} items={[
        { key: 'name', label: t('Display name'), children: session?.displayName },
        { key: 'email', label: t('Email'), children: session?.email },
        { key: 'role', label: t('Role'), children: t('Platform admin') },
      ]} />
    </Card>
  </>;
}
