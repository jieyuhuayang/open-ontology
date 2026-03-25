import { useState } from 'react';
import { Table, Button, Tag, Tooltip, Space } from 'antd';
import { CheckOutlined, EditOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import type { ColumnsType } from 'antd/es/table';
import { useUpdateItemDecision } from '@/api/blueprints';
import type { BlueprintItem } from '@/api/types';
import { useWorkshopStore } from '../stores/workshop-store';
import InlineEditForm from './InlineEditForm';
import RejectionReasonPopover from './RejectionReasonPopover';

interface BlueprintReviewTableProps {
  items: BlueprintItem[];
  blueprintRid: string;
  filters: { type?: string; confidenceLevel?: string };
  selectedRowKeys: string[];
  onSelectedRowKeysChange: (keys: string[]) => void;
}

const TYPE_ICONS: Record<string, string> = {
  object_type: '🔵',
  property: '🟣',
  link_type: '🔗',
};

const ROW_STYLES = `
  .review-row-accepted { background: rgba(82, 196, 26, 0.08) !important; }
  .review-row-edited { background: rgba(22, 119, 255, 0.08) !important; }
  .review-row-rejected { background: rgba(255, 77, 79, 0.04) !important; text-decoration: line-through; opacity: 0.6; }
  .review-row-accepted td, .review-row-edited td, .review-row-rejected td { background: transparent !important; }
`;

const CONFIDENCE_COLORS: Record<string, string> = {
  high: 'green',
  medium: 'gold',
  low: 'red',
};

export default function BlueprintReviewTable({
  items,
  blueprintRid,
  filters,
  selectedRowKeys,
  onSelectedRowKeysChange,
}: BlueprintReviewTableProps) {
  const { t } = useTranslation();
  const [expandedRowKeys, setExpandedRowKeys] = useState<string[]>([]);
  const decisionMutation = useUpdateItemDecision(blueprintRid);
  const setHighlightedEntityRids = useWorkshopStore(
    (s) => s.setHighlightedEntityRids,
  );
  const clearHighlights = useWorkshopStore((s) => s.clearHighlights);
  const setFocusedEntityRid = useWorkshopStore(
    (s) => s.setFocusedEntityRid,
  );
  const addShockwave = useWorkshopStore((s) => s.addShockwave);
  const addCollapse = useWorkshopStore((s) => s.addCollapse);

  const filteredItems = items.filter((item) => {
    if (filters.type && item.itemType !== filters.type) return false;
    if (
      filters.confidenceLevel &&
      item.confidenceLevel !== filters.confidenceLevel
    )
      return false;
    return true;
  });

  const handleAccept = (item: BlueprintItem) => {
    decisionMutation.mutate(
      { itemRid: item.rid, userDecision: 'accepted' },
      {
        onSuccess: () => {
          addShockwave({
            id: `review-accept-${item.rid}`,
            position: { x: 0, y: 0, z: 0 },
            startTime: Date.now(),
          });
        },
      },
    );
  };

  const handleRejectConfirm = (
    item: BlueprintItem,
    reason: string,
  ) => {
    decisionMutation.mutate(
      {
        itemRid: item.rid,
        userDecision: 'rejected',
        rejectionReason: reason,
      },
      {
        onSuccess: () => {
          addCollapse({
            id: `review-reject-${item.rid}`,
            position: { x: 0, y: 0, z: 0 },
            color: '#ff4d4f',
            startTime: Date.now(),
          });
        },
      },
    );
  };

  const handleEditConfirm = () => {
    setExpandedRowKeys([]);
  };

  const sourceLabel = (source: string) => {
    const map: Record<string, string> = {
      field_analysis: t('workshop.review.sourceFieldAnalysis'),
      pattern_matching: t('workshop.review.sourcePatternMatching'),
      semantic_inference: t('workshop.review.sourceSemanticInference'),
      best_practices: t('workshop.review.sourceBestPractices'),
    };
    return map[source] ?? source;
  };

  const columns: ColumnsType<BlueprintItem> = [
    {
      title: t('workshop.review.colType'),
      dataIndex: 'itemType',
      width: 50,
      render: (type: string) => (
        <span style={{ fontSize: 16 }}>{TYPE_ICONS[type] ?? '?'}</span>
      ),
    },
    {
      title: t('workshop.review.colName'),
      dataIndex: ['suggestion', 'displayName'],
      ellipsis: true,
      render: (_: unknown, record: BlueprintItem) =>
        (record.suggestion as Record<string, unknown>)?.displayName as
          | string
          | undefined,
    },
    {
      title: t('workshop.review.colDetail'),
      width: 80,
      render: (_: unknown, record: BlueprintItem) => {
        const suggestion = record.suggestion as Record<string, unknown>;
        if (record.itemType === 'object_type') {
          const props = suggestion.properties as unknown[] | undefined;
          return props ? `${props.length} ${t('workshop.review.properties')}` : '—';
        }
        if (record.itemType === 'link_type') {
          const sideA = (suggestion.sideA as Record<string, unknown>)
            ?.displayName as string | undefined;
          const sideB = (suggestion.sideB as Record<string, unknown>)
            ?.displayName as string | undefined;
          return `${sideA ?? '?'} → ${sideB ?? '?'}`;
        }
        return '—';
      },
    },
    {
      title: t('workshop.review.colConfidence'),
      dataIndex: 'confidence',
      width: 70,
      render: (_: unknown, record: BlueprintItem) => (
        <Tag
          color={CONFIDENCE_COLORS[record.confidenceLevel] ?? 'default'}
        >
          {Math.round(record.confidence * 100)}%
        </Tag>
      ),
    },
    {
      title: t('workshop.review.colSource'),
      dataIndex: 'source',
      width: 80,
      render: (source: string) => (
        <Tag style={{ fontSize: 11 }}>{sourceLabel(source)}</Tag>
      ),
    },
    {
      title: t('workshop.review.colActions'),
      width: 120,
      render: (_: unknown, record: BlueprintItem) => {
        const decided = record.userDecision != null;
        return (
          <Space size={4}>
            <Tooltip
              title={
                decided
                  ? t('workshop.review.decisionLocked')
                  : t('workshop.review.accept')
              }
            >
              <Button
                size="small"
                type="text"
                icon={<CheckOutlined />}
                disabled={decided}
                style={
                  record.userDecision === 'accepted'
                    ? { color: '#52c41a' }
                    : undefined
                }
                onClick={(e) => {
                  e.stopPropagation();
                  handleAccept(record);
                }}
              />
            </Tooltip>
            <Tooltip
              title={
                decided
                  ? t('workshop.review.decisionLocked')
                  : t('workshop.review.edit')
              }
            >
              <Button
                size="small"
                type="text"
                icon={<EditOutlined />}
                disabled={decided}
                style={
                  record.userDecision === 'edited'
                    ? { color: '#1677ff' }
                    : undefined
                }
                onClick={(e) => {
                  e.stopPropagation();
                  setExpandedRowKeys([record.rid]);
                }}
              />
            </Tooltip>
            <RejectionReasonPopover
              item={record}
              disabled={decided}
              onConfirm={(reason) => handleRejectConfirm(record, reason)}
            />
          </Space>
        );
      },
    },
  ];

  const rowClassName = (record: BlueprintItem) => {
    switch (record.userDecision) {
      case 'accepted':
        return 'review-row-accepted';
      case 'edited':
        return 'review-row-edited';
      case 'rejected':
        return 'review-row-rejected';
      default:
        return '';
    }
  };

  return (
    <>
      <style>{ROW_STYLES}</style>
      <Table<BlueprintItem>
        dataSource={filteredItems}
        columns={columns}
        rowKey="rid"
        size="small"
        pagination={false}
        rowClassName={rowClassName}
        rowSelection={{
          selectedRowKeys,
          onChange: (keys) => onSelectedRowKeysChange(keys as string[]),
          getCheckboxProps: (record) => ({
            disabled: record.userDecision != null,
          }),
        }}
        expandable={{
          expandedRowKeys,
          onExpand: (expanded, record) => {
            setExpandedRowKeys(expanded ? [record.rid] : []);
          },
          expandedRowRender: (record) => (
            <InlineEditForm
              item={record}
              blueprintRid={blueprintRid}
              onConfirm={handleEditConfirm}
              onCancel={() => setExpandedRowKeys([])}
            />
          ),
          showExpandColumn: false,
        }}
        onRow={(record) => ({
          onMouseEnter: () =>
            setHighlightedEntityRids([
              record.rid,
            ]),
          onMouseLeave: () => clearHighlights(),
          onClick: () =>
            setFocusedEntityRid(record.rid),
          style: { cursor: 'pointer' },
        })}
      />
    </>
  );
}
