import { Card, Empty, Tag, Tooltip, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { useWorkingState } from '@/api/working-state';
import { useHistory } from '@/api/history';
import type { Change, ChangeRecord } from '@/api/types';
import { CHANGE_TYPE_COLORS, CHANGE_TYPE_KEYS, changeDisplayName } from '@/utils/change-helpers';

dayjs.extend(relativeTime);

const { Title, Text } = Typography;

export default function ObjectTypeHistoryPage() {
  const { t } = useTranslation();
  const { rid } = useParams<{ rid: string }>();
  const { data: ws } = useWorkingState();
  const { data: historyData } = useHistory(1, 100);

  const pendingChanges = (ws?.changes ?? []).filter(
    (c) => c.resourceRid === rid,
  );

  const publishedRecords = (historyData?.items ?? [])
    .map((record: ChangeRecord) => ({
      ...record,
      changes: record.changes.filter((c: Change) => c.resourceRid === rid),
    }))
    .filter((record) => record.changes.length > 0);

  const hasAnything = pendingChanges.length > 0 || publishedRecords.length > 0;

  return (
    <div>
      {pendingChanges.length > 0 && (
        <Card
          size="small"
          title={t('changeManagement.pendingChanges')}
          style={{ marginBottom: 16 }}
        >
          {pendingChanges.map((change) => (
            <div key={change.id} style={{ padding: '4px 0' }}>
              <Tag color={CHANGE_TYPE_COLORS[change.changeType]}>
                {t(CHANGE_TYPE_KEYS[change.changeType] ?? change.changeType)}
              </Tag>
              {changeDisplayName(change)}
            </div>
          ))}
        </Card>
      )}

      {publishedRecords.length > 0 ? (
        <div>
          <Title level={5}>{t('changeManagement.history')}</Title>
          {publishedRecords.map((record) => (
            <Card key={record.rid} size="small" style={{ marginBottom: 8 }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 8 }}>
                <Text strong>
                  {t('changeManagement.version', { version: record.version })}
                </Text>
                <Tooltip title={dayjs(record.savedAt).format('YYYY-MM-DD HH:mm:ss')}>
                  <Text type="secondary">{dayjs(record.savedAt).fromNow()}</Text>
                </Tooltip>
                <Text type="secondary">{record.savedBy}</Text>
              </div>
              {record.changes.map((change: Change) => (
                <div key={change.id} style={{ padding: '2px 0' }}>
                  <Tag color={CHANGE_TYPE_COLORS[change.changeType]}>
                    {t(CHANGE_TYPE_KEYS[change.changeType] ?? change.changeType)}
                  </Tag>
                  {changeDisplayName(change)}
                </div>
              ))}
            </Card>
          ))}
        </div>
      ) : (
        !hasAnything && <Empty description={t('changeManagement.noHistory')} />
      )}
    </div>
  );
}
