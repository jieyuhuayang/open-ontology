import { useState, useMemo } from 'react';
import { Button, Empty, Flex, Select, Space, Spin, Tooltip, Typography, message } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useObjectType } from '@/api/object-types';
import { useProperties, useReorderProperties } from '@/api/properties';
import PropertyTable from './components/PropertyTable';
import CreatePropertyDrawer from './components/CreatePropertyDrawer';
import EditPropertyPanel from './components/EditPropertyPanel';
import type { Property } from '@/api/types';

const { Title } = Typography;

const MAX_PROPERTIES = 200;

export default function ObjectTypePropertiesPage() {
  const { rid } = useParams<{ rid: string }>();
  const { t } = useTranslation();
  const { data: objectType } = useObjectType(rid ?? '');
  const { data: propertiesData, isLoading } = useProperties(rid ?? '');
  const reorderMutation = useReorderProperties(rid ?? '');

  const [createOpen, setCreateOpen] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [filterStatus, setFilterStatus] = useState<string | null>(null);
  const [filterVisibility, setFilterVisibility] = useState<string | null>(null);
  const [filterBaseType, setFilterBaseType] = useState<string | null>(null);

  const properties = propertiesData?.items ?? [];
  const atLimit = properties.length >= MAX_PROPERTIES;

  const filteredProperties = useMemo(() => {
    return properties.filter((p) => {
      if (filterStatus && p.status !== filterStatus) return false;
      if (filterVisibility && p.visibility !== filterVisibility) return false;
      if (filterBaseType && p.baseType !== filterBaseType) return false;
      return true;
    });
  }, [properties, filterStatus, filterVisibility, filterBaseType]);

  const handleReorder = async (newOrder: Property[]) => {
    const propertyOrders = newOrder.map((p, i) => ({ rid: p.rid, sortOrder: i }));
    try {
      await reorderMutation.mutateAsync({ propertyOrders });
    } catch {
      void message.error(t('error.somethingWentWrong'));
    }
  };

  if (isLoading) {
    return (
      <Flex justify="center" align="center" style={{ minHeight: 200 }}>
        <Spin />
      </Flex>
    );
  }

  return (
    <div>
      <Flex justify="space-between" align="center" style={{ marginBottom: 16 }}>
        <Title level={5} style={{ margin: 0 }}>
          {t('detail.properties')}
        </Title>
        <Space>
          <Select
            allowClear
            placeholder={t('property.filters.allStatuses')}
            style={{ width: 140 }}
            value={filterStatus}
            onChange={setFilterStatus}
            options={[
              { value: 'active', label: t('objectType.status.active') },
              { value: 'experimental', label: t('objectType.status.experimental') },
              { value: 'deprecated', label: t('objectType.status.deprecated') },
            ]}
          />
          <Select
            allowClear
            placeholder={t('property.filters.allVisibilities')}
            style={{ width: 140 }}
            value={filterVisibility}
            onChange={setFilterVisibility}
            options={[
              { value: 'prominent', label: t('objectType.visibility.prominent') },
              { value: 'normal', label: t('objectType.visibility.normal') },
              { value: 'hidden', label: t('objectType.visibility.hidden') },
            ]}
          />
          <Select
            allowClear
            placeholder={t('property.filters.allTypes')}
            style={{ width: 140 }}
            value={filterBaseType}
            onChange={setFilterBaseType}
            showSearch
            options={[
              'string', 'integer', 'long', 'float', 'double', 'decimal',
              'boolean', 'date', 'timestamp', 'byte', 'short',
              'array', 'struct', 'geopoint', 'cipher',
            ].map((type) => ({
              value: type,
              label: t(`property.baseTypes.${type}`, type),
            }))}
          />
          <Tooltip title={atLimit ? t('property.validation.limitExceeded') : undefined}>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              disabled={atLimit}
              onClick={() => setCreateOpen(true)}
            >
              {t('property.addProperty')}
            </Button>
          </Tooltip>
        </Space>
      </Flex>

      {filteredProperties.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={
            properties.length === 0 ? t('property.empty') : t('property.filterEmpty')
          }
        />
      ) : (
        <PropertyTable
          properties={filteredProperties}
          objectTypeStatus={objectType?.status}
          onRowClick={setSelectedProperty}
          onReorder={(newOrder) => void handleReorder(newOrder)}
        />
      )}

      <CreatePropertyDrawer
        open={createOpen}
        objectTypeRid={rid ?? ''}
        onClose={() => setCreateOpen(false)}
      />

      <EditPropertyPanel
        property={selectedProperty}
        objectTypeStatus={objectType?.status}
        onClose={() => setSelectedProperty(null)}
      />
    </div>
  );
}
