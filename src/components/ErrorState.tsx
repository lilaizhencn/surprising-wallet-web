import { Alert, Button } from 'antd';

export function ErrorState({
  message,
  onRetry,
}: {
  message?: string;
  onRetry?: () => void;
}) {
  if (!message) return null;
  return (
    <Alert
      showIcon
      type="error"
      title="Unable to load this view"
      description={message}
      action={onRetry ? <Button onClick={onRetry}>Retry</Button> : undefined}
    />
  );
}
