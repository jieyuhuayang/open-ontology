import { useCallback } from 'react';
import { Table, Tag, Tooltip } from 'antd';
import { HolderOutlined, KeyOutlined } from '@ant-design/icons';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useTranslation } from 'react-i18next';
import type { ColumnsType } from 'antd/es/table';
import StatusBadge from '@/components/StatusBadge';
import ChangeStateBadge from '@/components/ChangeStateBadge';
import type { Property, ResourceStatus, ChangeState } from '@/api/types';


const PRIMARY_KEY_TYPES = new Set([
  'string', 'integer', 'short', 'date', 'timestamp', 'boolean', 'byte', 'long',
]);

const TITLE_KEY_TYPES = new Set([
  'string', 'integer', 'short', 'date', 'timestamp', 'boolean', 'byte', 'long',
  'float', 'double', 'decimal', 'geopoint', 'cipher', 'array',
]);

interface SortableRowProps extends React.HTMLAttributes<HTMLTableRowElement> {
  'data-row-key': string;
}

function SortableRow({ children, ...props }: SortableRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: props['data-row-key'],
  });

  const style: React.CSSProperties = {
    ...props.style,
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    cursor: 'default',
  };

  return (
    <tr ref={setNodeRef} {...props} {...attributes} style={style}>
      {children}
    </tr>
  );
}

interface DragHandleCellProps {
  listeners?: ReturnType<typeof useSortable>['listeners'];
}

function DragHandleCell({ rid }: { rid: string }) {
  const { listeners } = useSortable({ id: rid });
  return (
    <span
      {...listeners}
      style={{ cursor: 'grab', padding: '0 8px', color: '#bfbfbf', fontSize: 16 }}
      onClick={(e) => e.stopPropagation()}
    >
      <HolderOutlined />
    </span>
  );
}

interface PropertyTableProps {
  properties: Property[];
  objectTypeStatus?: string;
  onRowClick?: (property: Property) => void;
  onReorder?: (newOrder: Property[]) => void;
}

export default function PropertyTable({
  properties,
  objectTypeStatus,
  onRowClick,
  onReorder,
}: PropertyTableProps) {
  const { t } = useTranslation();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const oldIndex = properties.findIndex((p) => p.rid === active.id);
      const newIndex = properties.findIndex((p) => p.rid === over.id);
      if (oldIndex === -1 || newIndex === -1) return;
      const newOrder = arrayMove(properties, oldIndex, newIndex);
      onReorder?.(newOrder);
    },
    [properties, onReorder],
  );

  const columns: ColumnsType<Property> = [
    {
      key: 'drag',
      width: 40,
      render: (_, record) => <DragHandleCell rid={record.rid} />,
      onCell: () => ({ onClick: (e: React.MouseEvent) => e.stopPropagation() }),
    },
    {
      title: t('property.fields.displayName'),
      key: 'displayName',
      render: (_, record) => (
        <span>
          {record.displayName}{' '}
          <ChangeStateBadge state={record.changeState as ChangeState} />
        </span>
      ),
    },
    {
      title: t('property.fields.id'),
      dataIndex: 'id',
      key: 'id',
      width: 160,
    },
    {
      title: t('property.fields.apiName'),
      dataIndex: 'apiName',
      key: 'apiName',
      width: 180,
    },
    {
      title: t('property.fields.baseType'),
      key: 'baseType',
      width: 140,
      render: (_, record) => (
        <span>
          {t(`property.baseTypes.${record.baseType}`, record.baseType)}
          {record.baseType === 'array' && record.arrayInnerType && (
            <Tag style={{ marginLeft: 4, fontSize: 11 }}>
              {t(`property.baseTypes.${record.arrayInnerType}`, record.arrayInnerType)}
            </Tag>
          )}
        </span>
      ),
    },
    {
      title: t('property.fields.backingColumn'),
      key: 'backingColumn',
      width: 140,
      render: (_, record) => record.backingColumn ?? <span style={{ color: '#bfbfbf' }}>—</span>,
    },
    {
      title: t('property.fields.status'),
      key: 'status',
      width: 120,
      render: (_, record) => <StatusBadge status={record.status as ResourceStatus} />,
    },
    {
      title: t('property.fields.visibility'),
      dataIndex: 'visibility',
      key: 'visibility',
      width: 100,
    },
    {
      title: t('property.fields.isPrimaryKey'),
      key: 'isPrimaryKey',
      width: 80,
      align: 'center',
      render: (_, record) => {
        const canBePK = PRIMARY_KEY_TYPES.has(record.baseType);
        if (!canBePK) {
          return (
            <Tooltip title={t('property.primaryKey.invalidType', { type: record.baseType })}>
              <KeyOutlined style={{ color: '#d9d9d9' }} />
            </Tooltip>
          );
        }
        return record.isPrimaryKey ? (
          <Tooltip title={t('property.fields.isPrimaryKey')}>
            <KeyOutlined style={{ color: '#faad14' }} />
          </Tooltip>
        ) : null;
      },
    },
    {
      title: t('property.fields.isTitleKey'),
      key: 'isTitleKey',
      width: 80,
      align: 'center',
      render: (_, record) => {
        const canBeTK = TITLE_KEY_TYPES.has(record.baseType);
        if (!canBeTK) {
          return (
            <Tooltip title={t('property.titleKey.set')}>
              <KeyOutlined style={{ color: '#d9d9d9', transform: 'rotate(90deg)' }} />
            </Tooltip>
          );
        }
        return record.isTitleKey ? (
          <Tooltip title={t('property.fields.isTitleKey')}>
            <KeyOutlined style={{ color: '#52c41a', transform: 'rotate(90deg)' }} />
          </Tooltip>
        ) : null;
      },
    },
  ];

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext
        items={properties.map((p) => p.rid)}
        strategy={verticalListSortingStrategy}
      >
        <Table<Property>
          columns={columns}
          dataSource={properties}
          rowKey="rid"
          size="small"
          pagination={false}
          onRow={(record) => ({
            onClick: () => onRowClick?.(record),
            style: { cursor: 'pointer' },
          })}
          components={{
            body: {
              row: SortableRow,
            },
          }}
          locale={{ emptyText: t('property.empty') }}
        />
      </SortableContext>
    </DndContext>
  );
}
