import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Drawer, Table, Tag, Button, Popconfirm, Typography } from 'antd';
import { DeleteOutlined } from '@ant-design/icons';
import { useWorkshopStore } from '../stores/workshop-store';
import ConfidenceIndicator from './ConfidenceIndicator';
import DataProbeButton from './DataProbeButton';
import type { WorkshopNode, WorkshopEdge } from '../types';

const { Text, Paragraph } = Typography;

interface EntityDrawerProps {
  nodes: WorkshopNode[];
  edges: WorkshopEdge[];
  onDeleteNode?: (nodeId: string) => void;
}

const SOURCE_LABELS: Record<string, string> = {
  field_analysis: 'source.field_analysis',
  pattern_matching: 'source.pattern_matching',
  semantic_inference: 'source.semantic_inference',
  best_practices: 'source.best_practices',
};

export default function EntityDrawer({ nodes, edges }: EntityDrawerProps) {
  const { t } = useTranslation();
  const selectedEntityRid = useWorkshopStore((s) => s.selectedEntityRid);
  const setSelectedEntityRid = useWorkshopStore(
    (s) => s.setSelectedEntityRid,
  );

  const node = nodes.find((n) => n.id === selectedEntityRid);

  if (!node) {
    return (
      <Drawer
        open={!!selectedEntityRid}
        onClose={() => setSelectedEntityRid(null)}
        width={0}
      />
    );
  }

  const relatedEdges = edges.filter(
    (e) => e.sourceNodeId === node.id || e.targetNodeId === node.id,
  );

  const typeLabel =
    node.type === 'object_type'
      ? t('workshop.entity.objectType')
      : t('workshop.entity.linkType');

  const propColumns = [
    {
      title: 'Name',
      dataIndex: 'displayName',
      key: 'displayName',
    },
    {
      title: 'API Name',
      dataIndex: 'apiName',
      key: 'apiName',
      render: (v: string) => (
        <Text code style={{ fontSize: 12 }}>
          {v}
        </Text>
      ),
    },
    {
      title: 'Type',
      dataIndex: 'baseType',
      key: 'baseType',
      render: (v: string) => <Tag>{v}</Tag>,
    },
  ];

  return (
    <Drawer
      open={!!selectedEntityRid}
      onClose={() => setSelectedEntityRid(null)}
      width={400}
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>{node.displayName}</span>
          <Tag color="blue">{typeLabel}</Tag>
          {node.status === 'pending' && (
            <span style={{ color: '#ffc53d', fontSize: 12 }}>✦ AI</span>
          )}
        </div>
      }
      styles={{
        header: { background: '#141428', borderBottom: '1px solid rgba(255,255,255,0.08)' },
        body: { background: '#141428', padding: '16px' },
      }}
      data-testid="entity-drawer"
    >
      {/* Confidence */}
      {node.status === 'pending' &&
        node.confidence != null &&
        node.confidenceLevel && (
          <div style={{ marginBottom: 16 }}>
            <ConfidenceIndicator
              confidence={node.confidence}
              confidenceLevel={node.confidenceLevel}
            />
          </div>
        )}

      {/* Description */}
      {node.description && (
        <Paragraph
          style={{ color: 'rgba(255,255,255,0.65)', fontSize: 13 }}
        >
          {node.description}
        </Paragraph>
      )}

      {/* Properties */}
      {node.properties && node.properties.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div
            style={{
              fontSize: 12,
              color: 'rgba(255,255,255,0.5)',
              marginBottom: 8,
              textTransform: 'uppercase',
            }}
          >
            {t('workshop.entity.properties')}
          </div>
          <Table
            dataSource={node.properties}
            columns={propColumns}
            rowKey="apiName"
            size="small"
            pagination={false}
            style={{ background: 'transparent' }}
          />
        </div>
      )}

      {/* Relationships */}
      {relatedEdges.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div
            style={{
              fontSize: 12,
              color: 'rgba(255,255,255,0.5)',
              marginBottom: 8,
              textTransform: 'uppercase',
            }}
          >
            {t('workshop.entity.relationships')}
          </div>
          {relatedEdges.map((edge) => {
            const otherNodeId =
              edge.sourceNodeId === node.id
                ? edge.targetNodeId
                : edge.sourceNodeId;
            const otherNode = nodes.find((n) => n.id === otherNodeId);
            return (
              <div
                key={edge.id}
                style={{
                  padding: '6px 10px',
                  marginBottom: 4,
                  background: 'rgba(255,255,255,0.04)',
                  borderRadius: 6,
                  fontSize: 13,
                }}
              >
                <span style={{ color: 'rgba(255,255,255,0.75)' }}>
                  {edge.label}
                </span>
                <span style={{ color: 'rgba(255,255,255,0.4)', margin: '0 6px' }}>
                  →
                </span>
                <span style={{ color: '#4f8eff' }}>
                  {otherNode?.displayName ?? otherNodeId}
                </span>
                {edge.cardinality && (
                  <Tag style={{ marginLeft: 8 }}>{edge.cardinality}</Tag>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Reasoning (pending only) */}
      {node.status === 'pending' && node.reasoning && (
        <div style={{ marginBottom: 16 }}>
          <div
            style={{
              fontSize: 12,
              color: 'rgba(255,255,255,0.5)',
              marginBottom: 8,
              textTransform: 'uppercase',
            }}
          >
            {t('workshop.entity.reasoning')}
          </div>
          {node.source && (
            <Tag style={{ marginBottom: 4 }}>
              {t(`workshop.${SOURCE_LABELS[node.source] ?? node.source}`)}
            </Tag>
          )}
          <Paragraph
            style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13 }}
          >
            {node.reasoning}
          </Paragraph>
        </div>
      )}

      {/* View detail button (confirmed only) */}
      {node.status === 'confirmed' && (
        <Button
          type="link"
          onClick={() => window.open(`/object-types/${node.id}`, '_blank')}
          data-testid="view-detail-button"
        >
          {t('workshop.entity.viewDetail')}
        </Button>
      )}
    </Drawer>
  );
}
