import { Alert, Button, List, Space, Tag } from 'antd';
import { useTranslation } from 'react-i18next';
import type { ConflictCheckResult } from '@/api/types';

interface ConflictWarningAlertProps {
  conflicts: ConflictCheckResult[];
  onIgnore: () => void;
  onGoBack: () => void;
}

export default function ConflictWarningAlert({
  conflicts,
  onIgnore,
  onGoBack,
}: ConflictWarningAlertProps) {
  const { t } = useTranslation();
  const hasBlocking = conflicts.some(
    (c) => c.conflictType === 'dependency_missing',
  );

  return (
    <div style={{ padding: '12px 0' }}>
      <Alert
        type={hasBlocking ? 'error' : 'warning'}
        showIcon
        message={
          hasBlocking
            ? t('workshop.review.conflictDependency')
            : t('workshop.review.conflictApiName')
        }
        description={
          <>
            <List
              size="small"
              dataSource={conflicts}
              renderItem={(item) => (
                <List.Item style={{ padding: '4px 0' }}>
                  <Tag
                    color={
                      item.conflictType === 'dependency_missing'
                        ? 'red'
                        : 'orange'
                    }
                  >
                    {item.conflictType === 'dependency_missing'
                      ? t('workshop.review.conflictDependency')
                      : t('workshop.review.conflictApiName')}
                  </Tag>
                  <span style={{ fontSize: 12 }}>{item.message}</span>
                </List.Item>
              )}
            />
            <Space style={{ marginTop: 12 }}>
              <Button size="small" onClick={onGoBack}>
                {t('workshop.review.conflictGoBack')}
              </Button>
              {!hasBlocking && (
                <Button size="small" type="primary" onClick={onIgnore}>
                  {t('workshop.review.conflictIgnore')}
                </Button>
              )}
            </Space>
          </>
        }
      />
    </div>
  );
}
