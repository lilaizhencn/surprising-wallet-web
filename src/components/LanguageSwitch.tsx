import { Segmented } from 'antd';
import { GlobalOutlined } from '@ant-design/icons';
import { useI18n, type AppLocale } from '../i18n';

export function LanguageSwitch({ compact = false }: { compact?: boolean }) {
  const { locale, setLocale, t } = useI18n();
  return (
    <Segmented<AppLocale>
      className="language-switch"
      size="small"
      value={locale}
      aria-label={t('Language')}
      options={compact
        ? [
            { value: 'zh-CN', label: '中' },
            { value: 'en-US', label: 'EN' },
          ]
        : [
            { value: 'zh-CN', label: <><GlobalOutlined /> 中文</> },
            { value: 'en-US', label: 'English' },
          ]}
      onChange={setLocale}
    />
  );
}
