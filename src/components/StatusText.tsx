import { Badge } from 'antd';
import { useI18n } from '../i18n';

const statusMap: Record<string, 'success' | 'processing' | 'warning' | 'error' | 'default'> = {
  ACTIVE: 'success',
  CONFIRMED: 'success',
  CREDITED: 'success',
  DELIVERED: 'success',
  READY: 'success',
  SETTLED: 'success',
  RECOVERED: 'success',
  VERIFIED: 'success',
  SENT: 'processing',
  RESERVED: 'processing',
  FROZEN: 'processing',
  SIGNING: 'processing',
  PENDING: 'processing',
  PENDING_REVIEW: 'warning',
  PENDING_VERIFICATION: 'warning',
  SUBMITTED: 'warning',
  APPROVED: 'processing',
  EXECUTING: 'processing',
  BROADCAST: 'processing',
  RETRY: 'warning',
  RETRY_SCHEDULED: 'warning',
  LOW_BALANCE: 'warning',
  SETUP_REQUIRED: 'warning',
  BROADCAST_UNKNOWN: 'warning',
  FAILED: 'error',
  OVERDUE: 'error',
  REJECTED: 'error',
  SUSPENDED: 'error',
  REVOKED: 'default',
  DISABLED: 'default',
  RELEASED: 'default',
  CANCELLED: 'default',
  REORGED: 'error',
};

export function StatusText({ value }: { value?: string | null }) {
  const label = value || 'UNKNOWN';
  const { locale, t } = useI18n();
  const normalized = label.replaceAll('_', ' ').toLowerCase();
  const display = normalized.charAt(0).toUpperCase() + normalized.slice(1);
  return (
    <Badge
      status={statusMap[label] ?? 'default'}
      text={locale === 'zh-CN' ? t(display) : label.replaceAll('_', ' ')}
    />
  );
}
