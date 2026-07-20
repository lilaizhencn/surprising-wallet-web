import { getIntlLocale } from '../i18n';

export function formatAmount(value: unknown, maximumFractionDigits = 8) {
  if (value === null || value === undefined || value === '') return '0';
  const number = Number(value);
  if (!Number.isFinite(number)) return String(value);
  return new Intl.NumberFormat(getIntlLocale(), {
    maximumFractionDigits,
    minimumFractionDigits: 0,
  }).format(number);
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
