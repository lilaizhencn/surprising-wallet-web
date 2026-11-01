import { Alert, Button } from 'antd';
import { approvalOrigin } from '../approval/origin';
import { PageHeader } from '../components/PageHeader';
import { useI18n } from '../i18n';

export default function ApprovalEntryPage() {
  const { t } = useI18n(); const origin = approvalOrigin();
  return <><PageHeader title={t('Withdrawal approvals')} description={t('Use your separately activated approval account.')} />
    {origin && origin !== window.location.origin ? <Button type="primary" href={`${origin}/approval`} target="_blank" rel="noopener noreferrer">{t('Open independent approvals')}</Button>
      : <Alert type="warning" title={t('Independent approval site has not been configured.')} />}
  </>;
}
