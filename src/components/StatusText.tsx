import { Badge } from 'antd';

const statusMap: Record<string, 'success' | 'processing' | 'warning' | 'error' | 'default'> = {
  ACTIVE: 'success',
  CONFIRMED: 'success',
  CREDITED: 'success',
  DELIVERED: 'success',
  READY: 'success',
  SETTLED: 'success',
  SENT: 'processing',
  RESERVED: 'processing',
  FROZEN: 'processing',
  SIGNING: 'processing',
  PENDING: 'processing',
  PENDING_REVIEW: 'warning',
  PENDING_VERIFICATION: 'warning',
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
};

export function StatusText({ value }: { value?: string | null }) {
  const label = value || 'UNKNOWN';
  return <Badge status={statusMap[label] ?? 'default'} text={label.replaceAll('_', ' ')} />;
}
