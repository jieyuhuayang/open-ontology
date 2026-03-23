import { useState } from 'react';
import {
  Avatar,
  Card,
  Empty,
  Pagination,
  Skeleton,
  Space,
  Tag,
  Timeline,
  Tooltip,
  Typography,
} from 'antd';
import {
  ClockCircleOutlined,
  HistoryOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { useHistory } from '@/api/history';
import type { Change, ChangeRecord } from '@/api/types';
import {
  CHANGE_TYPE_COLORS,
  CHANGE_TYPE_KEYS,
  changeDisplayName,
} from '@/utils/change-helpers';

dayjs.extend(relativeTime);

const { Title, Text } = Typography;

/** Resource type i18n key mapping */
const RESOURCE_TYPE_KEYS: Record<string, string> = {
  ObjectType: 'changeManagement.objectTypes',
  Property: 'changeManagement.properties',
  LinkType: 'changeManagement.linkTypes',
};

/** Group changes by resourceType */
function groupByResourceType(changes: Change[]): Record<string, Change[]> {
  const groups: Record<string, Change[]> = {};
  for (const c of changes) {
    const key = c.resourceType;
    if (!groups[key]) groups[key] = [];
    groups[key].push(c);
  }
  return groups;
}

/** Build change summary counts */
function changeSummary(
  changes: Change[],
  t: (key: string, opts?: Record<string, unknown>) => string,
): string {
  const counts: Record<string, number> = {};
  for (const c of changes) {
    counts[c.changeType] = (counts[c.changeType] ?? 0) + 1;
  }
  const parts: string[] = [];
  if (counts['CREATE'])
    parts.push(
      `${counts['CREATE']} ${t('changeManagement.created').toLowerCase()}`,
    );
  if (counts['UPDATE'])
    parts.push(
      `${counts['UPDATE']} ${t('changeManagement.modified').toLowerCase()}`,
    );
  if (counts['DELETE'])
    parts.push(
      `${counts['DELETE']} ${t('changeManagement.deleted').toLowerCase()}`,
    );
  return parts.join(', ');
}

function VersionCard({
  record,
  t,
}: {
  record: ChangeRecord;
  t: (key: string, opts?: Record<string, unknown>) => string;
}) {
  const grouped = groupByResourceType(record.changes);

  return (
    <Card
      size="small"
      style={{
        borderRadius: 8,
        border: '1px solid #f0f0f0',
        boxShadow: '0 1px 4px rgba(0, 0, 0, 0.04)',
      }}
      styles={{ body: { padding: '16px 20px' } }}
    >
      {/* Header row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 12,
        }}
      >
        <Space size="middle" align="center">
          <Tag
            color="blue"
            style={{
              margin: 0,
              fontWeight: 600,
              fontSize: 13,
              padding: '2px 10px',
              borderRadius: 4,
            }}
          >
            {t('changeManagement.version', { version: record.version })}
          </Tag>
          <Space size={4} align="center">
            <Avatar
              size={20}
              icon={<UserOutlined />}
              style={{ backgroundColor: '#e6f4ff', color: '#1677ff' }}
            />
            <Text style={{ fontSize: 13 }}>{record.savedBy}</Text>
          </Space>
        </Space>
        <Tooltip
          title={dayjs(record.savedAt).format('YYYY-MM-DD HH:mm:ss')}
        >
          <Space size={4} align="center" style={{ flexShrink: 0 }}>
            <ClockCircleOutlined
              style={{ fontSize: 12, color: 'rgba(0,0,0,0.35)' }}
            />
            <Text type="secondary" style={{ fontSize: 12 }}>
              {dayjs(record.savedAt).fromNow()}
            </Text>
          </Space>
        </Tooltip>
      </div>

      {/* Summary line */}
      <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 12 }}>
        {t('changeManagement.changesCount', {
          count: record.changes.length,
        })}
        {' — '}
        {changeSummary(record.changes, t)}
      </Text>

      {/* Grouped changes */}
      {Object.entries(grouped).map(([resourceType, changes]) => (
        <div key={resourceType} style={{ marginBottom: 8 }}>
          <Text
            strong
            style={{
              fontSize: 11,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              color: 'rgba(0,0,0,0.45)',
              display: 'block',
              marginBottom: 4,
            }}
          >
            {t(RESOURCE_TYPE_KEYS[resourceType] ?? resourceType)}
          </Text>
          {changes.map((change: Change) => (
            <div
              key={change.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '3px 0',
              }}
            >
              <Tag
                color={CHANGE_TYPE_COLORS[change.changeType]}
                style={{
                  margin: 0,
                  fontSize: 11,
                  lineHeight: '18px',
                  padding: '0 6px',
                  borderRadius: 3,
                }}
              >
                {t(
                  CHANGE_TYPE_KEYS[change.changeType] ?? change.changeType,
                )}
              </Tag>
              <Text style={{ fontSize: 13 }}>
                {changeDisplayName(change)}
              </Text>
            </div>
          ))}
        </div>
      ))}
    </Card>
  );
}

function LoadingSkeleton() {
  return (
    <div style={{ padding: '24px 0' }}>
      {[1, 2, 3].map((i) => (
        <Card
          key={i}
          size="small"
          style={{ marginBottom: 16, borderRadius: 8 }}
          styles={{ body: { padding: '16px 20px' } }}
        >
          <Skeleton active paragraph={{ rows: 2 }} />
        </Card>
      ))}
    </div>
  );
}

export default function HistoryPage() {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const { data, isLoading } = useHistory(page, pageSize);

  const items = data?.items ?? [];
  const total = data?.total ?? 0;

  return (
    <div style={{ maxWidth: 720 }}>
      <Title level={4} style={{ marginBottom: 24 }}>
        {t('changeManagement.history')}
      </Title>

      {isLoading ? (
        <LoadingSkeleton />
      ) : items.length === 0 ? (
        <Empty
          image={
            <HistoryOutlined
              style={{ fontSize: 48, color: 'rgba(0,0,0,0.15)' }}
            />
          }
          description={
            <Text type="secondary">
              {t('changeManagement.historyEmpty')}
            </Text>
          }
          style={{ padding: '80px 0' }}
        />
      ) : (
        <>
          <Timeline
            items={items.map((record: ChangeRecord) => ({
              key: String(record.version),
              color: 'blue',
              children: <VersionCard record={record} t={t} />,
            }))}
            style={{ paddingTop: 4 }}
          />
          {total > pageSize && (
            <Pagination
              current={page}
              pageSize={pageSize}
              total={total}
              onChange={setPage}
              style={{ marginTop: 8, textAlign: 'right' }}
            />
          )}
        </>
      )}
    </div>
  );
}
