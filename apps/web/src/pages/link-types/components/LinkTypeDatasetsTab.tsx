import { Descriptions, Table, Typography, Empty } from 'antd';
import { useTranslation } from 'react-i18next';
import type { LinkType } from '@/api/types';

const { Text, Title } = Typography;

interface LinkTypeDatasetsTabProps {
  linkType: LinkType;
}

export default function LinkTypeDatasetsTab({ linkType }: LinkTypeDatasetsTabProps) {
  const { t } = useTranslation();

  if (!linkType.joinTableDatasetRid) {
    return <Empty description={t('linkType.detail.noJoinTable')} />;
  }

  const columnMappings = [
    linkType.sideA.joinTableColumn
      ? {
          key: 'A',
          side: t('linkType.wizard.sideA'),
          objectType: linkType.sideA.objectTypeDisplayName ?? linkType.sideA.objectTypeRid,
          column: linkType.sideA.joinTableColumn,
        }
      : null,
    linkType.sideB.joinTableColumn
      ? {
          key: 'B',
          side: t('linkType.wizard.sideB'),
          objectType: linkType.sideB.objectTypeDisplayName ?? linkType.sideB.objectTypeRid,
          column: linkType.sideB.joinTableColumn,
        }
      : null,
  ].filter(Boolean);

  return (
    <div>
      <Title level={5}>{t('linkType.detail.joinTableConfig')}</Title>
      <Descriptions column={1} size="small" bordered style={{ marginBottom: 16 }}>
        <Descriptions.Item label={t('linkType.detail.datasetRid')}>
          <Text copyable>{linkType.joinTableDatasetRid}</Text>
        </Descriptions.Item>
      </Descriptions>

      {columnMappings.length > 0 && (
        <>
          <Title level={5}>{t('linkType.detail.columnMapping')}</Title>
          <Table
            dataSource={columnMappings}
            rowKey="key"
            pagination={false}
            size="small"
            columns={[
              { title: t('linkType.detail.side'), dataIndex: 'side', key: 'side' },
              {
                title: t('linkType.fields.objectType'),
                dataIndex: 'objectType',
                key: 'objectType',
              },
              {
                title: t('linkType.detail.jtColumn'),
                dataIndex: 'column',
                key: 'column',
                render: (val: string) => <Text code>{val}</Text>,
              },
            ]}
          />
        </>
      )}
    </div>
  );
}
