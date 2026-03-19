import { useState } from 'react';
import { Collapse, Empty, Pagination, Spin, Tag, Tooltip, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { useHistory } from '@/api/history';
import type { Change, ChangeRecord } from '@/api/types';

dayjs.extend(relativeTime);

const { Title, Text } = Typography;

const CHANGE_TYPE_COLORS: Record<string, string> = {
  CREATE: 'green',
  UPDATE: 'blue',
  DELETE: 'red',
};

const CHANGE_TYPE_KEYS: Record<string, string> = {
  CREATE: 'changeManagement.created',
  UPDATE: 'changeManagement.modified',
  DELETE: 'changeManagement.deleted',
};

function changeSummary(changes: Change[], t: (key: string, opts?: Record<string, unknown>) => string): string {
  const counts: Record<string, number> = {};
  for (const c of changes) {
    counts[c.changeType] = (counts[c.changeType] ?? 0) + 1;
  }
  const parts: string[] = [];
  if (counts['CREATE']) parts.push(`${counts['CREATE']} ${t('changeManagement.created').toLowerCase()}`);
  if (counts['UPDATE']) parts.push(`${counts['UPDATE']} ${t('changeManagement.modified').toLowerCase()}`);
  if (counts['DELETE']) parts.push(`${counts['DELETE']} ${t('changeManagement.deleted').toLowerCase()}`);
  return `${t('changeManagement.changesCount', { count: changes.length })}: ${parts.join(', ')}`;
}

function displayName(change: Change): string {
  return (
    (change.after as Record<string, unknown> | null)?.displayName ??
    (change.before as Record<string, unknown> | null)?.displayName ??
    change.resourceRid
  ) as string;
}

export default function HistoryPage() {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const { data, isLoading } = useHistory(page, pageSize);

  if (isLoading) return <Spin style={{ display: 'block', marginTop: 100 }} />;

  const items = data?.items ?? [];
  const total = data?.total ?? 0;

  return (
    <div>
      <Title level={4}>{t('changeManagement.history')}</Title>
      {items.length === 0 ? (
        <Empty description={t('changeManagement.historyEmpty')} />
      ) : (
        <>
          <Collapse
            accordion
            items={items.map((record: ChangeRecord) => ({
              key: String(record.version),
              label: (
                <span style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <Text strong>{t('changeManagement.version', { version: record.version })}</Text>
                  <Tooltip title={dayjs(record.savedAt).format('YYYY-MM-DD HH:mm:ss')}>
                    <Text type="secondary">{dayjs(record.savedAt).fromNow()}</Text>
                  </Tooltip>
                  <Text type="secondary">{record.savedBy}</Text>
                  <Text type="secondary">{changeSummary(record.changes, t)}</Text>
                </span>
              ),
              children: (
                <div>
                  {record.changes.map((change: Change) => (
                    <div key={change.id} style={{ padding: '4px 0' }}>
                      <Tag color={CHANGE_TYPE_COLORS[change.changeType]}>
                        {t(CHANGE_TYPE_KEYS[change.changeType] ?? change.changeType)}
                      </Tag>
                      <Text type="secondary">{change.resourceType}</Text>
                      {' — '}
                      {displayName(change)}
                    </div>
                  ))}
                </div>
              ),
            }))}
          />
          {total > pageSize && (
            <Pagination
              current={page}
              pageSize={pageSize}
              total={total}
              onChange={setPage}
              style={{ marginTop: 16, textAlign: 'right' }}
            />
          )}
        </>
      )}
    </div>
  );
}
