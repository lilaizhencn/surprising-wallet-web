import { Link } from 'react-router-dom';
import { useI18n } from '../i18n';

export function Brand({ compact = false }: { compact?: boolean }) {
  const { t } = useI18n();
  return (
    <Link to="/" className="brand" aria-label={t('Surprising Wallet home')}>
      <span className="brand-mark-frame" aria-hidden="true">
        <img src="/brand/surprising-mark.png" alt="" />
      </span>
      {!compact ? <span>Surprising Wallet</span> : null}
    </Link>
  );
}
