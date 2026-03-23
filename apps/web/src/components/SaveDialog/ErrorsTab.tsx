import { Empty, List, Button } from 'antd';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import type { Change } from '@/api/types';

export interface ValidationError {
  changeId: string;
  resourceRid: string;
  resourceType: string;
  message: string;
}

/**
 * Extract front-end validation errors from changes.
 * Exported for use by SaveDialog to compute errorCount.
 */
function hasDisplayName(resourceType: string, after: Record<string, unknown> | null): boolean {
  if (!after) return false;
  if (resourceType === 'LinkType') {
    const sideA = after.sideA as Record<string, unknown> | undefined;
    const sideB = after.sideB as Record<string, unknown> | undefined;
    return !!(sideA?.displayName && sideB?.displayName);
  }
  return !!after.displayName;
}

export function getValidationErrors(changes: Change[]): ValidationError[] {
  const errors: ValidationError[] = [];
  for (const change of changes) {
    if (change.changeType === 'DELETE') continue;
    const after = change.after as Record<string, unknown> | null;
    if (!hasDisplayName(change.resourceType, after)) {
      errors.push({
        changeId: change.id,
        resourceRid: change.resourceRid,
        resourceType: change.resourceType,
        message: `${change.resourceType}: missing display name`,
      });
    }
  }
  return errors;
}

function resourcePath(resourceType: string, rid: string): string {
  switch (resourceType) {
    case 'ObjectType':
      return `/object-types/${rid}/overview`;
    case 'LinkType':
      return `/link-types/${rid}`;
    case 'Property':
      return `/properties`;
    default:
      return '/';
  }
}

interface ErrorsTabProps {
  changes: Change[];
}

export default function ErrorsTab({ changes }: ErrorsTabProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const errors = getValidationErrors(changes);

  if (errors.length === 0) {
    return <Empty description={t('changeManagement.noErrors')} />;
  }

  return (
    <List
      size="small"
      dataSource={errors}
      renderItem={(err) => (
        <List.Item
          actions={[
            <Button
              key="open"
              type="link"
              size="small"
              onClick={() => navigate(resourcePath(err.resourceType, err.resourceRid))}
            >
              {t('changeManagement.openResource')}
            </Button>,
          ]}
        >
          {err.message}
        </List.Item>
      )}
    />
  );
}
