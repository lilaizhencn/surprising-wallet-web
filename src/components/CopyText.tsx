import { App, Button, Tooltip } from 'antd';
import { CopyOutlined } from '@ant-design/icons';
import { useI18n } from '../i18n';

export function CopyText({ value, compact = true }: { value?: string | null; compact?: boolean }) {
  const { message } = App.useApp();
  const { t } = useI18n();
  if (!value) return <span>—</span>;
  const shortened = compact && value.length > 18
    ? `${value.slice(0, 8)}…${value.slice(-6)}`
    : value;
  return (
    <span className={`copy-text${compact ? '' : ' copy-text--full'}`}>
      <span title={compact ? value : undefined}>{shortened}</span>
      <Tooltip title={t('Copy')}>
        <Button
          type="text"
          size="small"
          aria-label={`${t('Copy')} ${value}`}
          icon={<CopyOutlined />}
          onClick={() => {
            void navigator.clipboard.writeText(value);
            void message.success(t('Copied'));
          }}
        />
      </Tooltip>
    </span>
  );
}
