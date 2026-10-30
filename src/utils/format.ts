import { getIntlLocale } from '../i18n';

/** Keep every supplied decimal unit; missing financial data is never presented as zero. */
export function formatAmount(value: unknown) {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'bigint') return '—';
  const text = String(value).trim();
  if (text.length > 256) return '—';
  const match = /^([+-]?)(\d+)(?:\.(\d+))?(?:[eE]([+-]?\d{1,3}))?$/.exec(text);
  if (!match) return '—';
  const exponent = Number(match[4] ?? '0'); // Only the bounded exponent, never the amount.
  if (Math.abs(exponent) > 78) return '—';
  const digits = match[2] + (match[3] ?? '');
  const point = match[2].length + exponent;
  const whole = (point <= 0 ? '0' : digits.slice(0, point).padEnd(point, '0')).replace(/^0+(?=\d)/, '');
  const fraction = (point < 0 ? '0'.repeat(-point) + digits : digits.slice(point)).replace(/0+$/, '');
  const formatter = new Intl.NumberFormat(getIntlLocale(), { maximumFractionDigits: 0 });
  const separator = new Intl.NumberFormat(getIntlLocale()).formatToParts(1.1).find((part) => part.type === 'decimal')?.value ?? '.';
  const negative = match[1] === '-' && (BigInt(whole) !== 0n || fraction.length > 0);
  return `${negative ? '-' : ''}${formatter.format(BigInt(whole))}${fraction ? separator + fraction : ''}`;
}

export function formatDate(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(getIntlLocale(), {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

export function queryString(values: Record<string, string | number | undefined | null>) {
  const search = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      search.set(key, String(value));
    }
  });
  const result = search.toString();
  return result ? `?${result}` : '';
}
