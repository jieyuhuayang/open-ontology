import type { Change } from '@/api/types';

/** Color mapping for ChangeType tags. */
export const CHANGE_TYPE_COLORS: Record<string, string> = {
  CREATE: 'green',
  UPDATE: 'blue',
  DELETE: 'red',
};

/** i18n key mapping for ChangeType labels. */
export const CHANGE_TYPE_KEYS: Record<string, string> = {
  CREATE: 'changeManagement.created',
  UPDATE: 'changeManagement.modified',
  DELETE: 'changeManagement.deleted',
};

/** Extract displayName from a Change's after/before snapshot. */
export function changeDisplayName(change: Change): string {
  return (
    (change.after as Record<string, unknown> | null)?.displayName ??
    (change.before as Record<string, unknown> | null)?.displayName ??
    change.resourceRid
  ) as string;
}
