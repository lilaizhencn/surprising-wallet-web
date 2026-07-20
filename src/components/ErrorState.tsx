import { Alert, Button } from 'antd';
import { useI18n } from '../i18n';

export function ErrorState({
  message,
  onRetry,
}: {
  message?: string;
  onRetry?: () => void;
}) {
  const { t } = useI18n();
  if (!message) return null;
  return (
    <Alert
      showIcon
      type="error"
      title={t('Unable to load this view')}
      description={message}
      action={onRetry ? <Button onClick={onRetry}>{t('Retry')}</Button> : undefined}
    />
  );
}
