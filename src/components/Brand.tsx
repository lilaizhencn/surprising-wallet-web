import { Link } from 'react-router-dom';

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link to="/" className="brand" aria-label="Surprising Wallet home">
      <span className="brand-mark-frame" aria-hidden="true">
        <img src="/brand/surprising-mark.png" alt="" />
      </span>
      {!compact ? <span>Surprising Wallet</span> : null}
    </Link>
  );
}
