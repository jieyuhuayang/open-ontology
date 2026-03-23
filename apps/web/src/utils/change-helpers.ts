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
  const snapshot = (change.after ?? change.before) as Record<string, unknown> | null;
  if (!snapshot) return change.resourceRid;

  if (change.resourceType === 'LinkType') {
    const sideA = snapshot.sideA as Record<string, unknown> | undefined;
    const sideB = snapshot.sideB as Record<string, unknown> | undefined;
    const a = (sideA?.displayName as string) ?? '';
    const b = (sideB?.displayName as string) ?? '';
    if (a || b) return [a, b].filter(Boolean).join(' ↔ ');
  }

  return (snapshot.displayName as string) ?? change.resourceRid;
}
