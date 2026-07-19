import { App, Button, Tooltip } from 'antd';
import { CopyOutlined } from '@ant-design/icons';

export function CopyText({ value, compact = true }: { value?: string | null; compact?: boolean }) {
  const { message } = App.useApp();
  if (!value) return <span>—</span>;
  const shortened = compact && value.length > 18
    ? `${value.slice(0, 8)}…${value.slice(-6)}`
    : value;
  return (
    <span className="copy-text">
      <span title={value}>{shortened}</span>
      <Tooltip title="Copy">
        <Button
          type="text"
          size="small"
          aria-label={`Copy ${value}`}
          icon={<CopyOutlined />}
          onClick={() => {
            void navigator.clipboard.writeText(value);
            void message.success('Copied');
          }}
        />
      </Tooltip>
    </span>
  );
}
