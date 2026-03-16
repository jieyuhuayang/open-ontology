import i18n from '@/locales/i18n';

export function formatRelativeTime(val: string | null | undefined): string {
  if (!val) return '—';
  const date = new Date(val);
  const now = Date.now();
  const diffMs = now - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  const t = i18n.t.bind(i18n);
  if (diffSec < 60) return t('common.time.lessThanMinute');
  if (diffMin < 60) return t('common.time.minutesAgo', { count: diffMin });
  if (diffHr < 24) return t('common.time.hoursAgo', { count: diffHr });
  if (diffDay < 30) return t('common.time.daysAgo', { count: diffDay });
  return date.toLocaleDateString();
}
