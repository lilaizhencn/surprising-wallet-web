import { Button } from 'antd';
import { Link, Outlet } from 'react-router-dom';
import { Brand } from './Brand';
import { LanguageSwitch } from './LanguageSwitch';
import { useI18n } from '../i18n';

export function PublicDocsShell() {
  const { t } = useI18n();

  return (
    <div className="public-docs-page">
      <header className="marketing-header">
        <Link to="/" aria-label={t('Back to product')}><Brand /></Link>
        <nav aria-label={t('Developer documentation')}>
          <Link to="/">{t('Product')}</Link>
          <Link to="/console/developer-docs">{t('Developers')}</Link>
        </nav>
        <div className="marketing-header-actions">
          <LanguageSwitch compact />
          <Link to="/console/login"><Button type="primary">{t('Open Console')}</Button></Link>
        </div>
      </header>
      <main className="public-docs-content">
        <Outlet />
      </main>
    </div>
  );
}
