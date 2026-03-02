import { useState } from 'react';
import { Button, Input, Modal, Space, Typography } from 'antd';
import { LinkOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';

const { Text } = Typography;

interface BackingColumnSectionProps {
  backingColumn: string | null | undefined;
  propertyName: string;
  onSave: (column: string | null) => void;
  disabled?: boolean;
}

export default function BackingColumnSection({
  backingColumn,
  propertyName,
  onSave,
  disabled,
}: BackingColumnSectionProps) {
  const { t } = useTranslation();
  const [editOpen, setEditOpen] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);
  const [draft, setDraft] = useState('');

  const handleOpenEdit = () => {
    setDraft(backingColumn ?? '');
    setEditOpen(true);
  };

  const handleSaveMapping = () => {
    const trimmed = draft.trim();
    onSave(trimmed || null);
    setEditOpen(false);
  };

  const handleRemove = () => {
    onSave(null);
    setRemoveOpen(false);
  };

  return (
    <>
      <Space direction="vertical" style={{ width: '100%' }}>
        <Space>
          <LinkOutlined style={{ color: backingColumn ? '#1677ff' : '#bfbfbf' }} />
          <Text type={backingColumn ? undefined : 'secondary'}>
            {backingColumn
              ? t('property.backingColumn.mapped', { column: backingColumn })
              : t('property.backingColumn.unmapped')}
          </Text>
        </Space>
        {!disabled && (
          <Space size="small">
            <Button size="small" onClick={handleOpenEdit}>
              {backingColumn
                ? t('property.backingColumn.changeMapping')
                : t('property.backingColumn.setMapping')}
            </Button>
            {backingColumn && (
              <Button size="small" danger onClick={() => setRemoveOpen(true)}>
                {t('property.backingColumn.removeMapping')}
              </Button>
            )}
          </Space>
        )}
      </Space>

      <Modal
        title={
          backingColumn
            ? t('property.backingColumn.changeMapping')
            : t('property.backingColumn.setMapping')
        }
        open={editOpen}
        onOk={handleSaveMapping}
        onCancel={() => setEditOpen(false)}
        okText={t('common.save')}
        cancelText={t('common.cancel')}
        destroyOnClose
      >
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={t('property.backingColumn.columnPlaceholder')}
          onPressEnter={handleSaveMapping}
          autoFocus
        />
      </Modal>

      <Modal
        title={t('property.backingColumn.removeMapping')}
        open={removeOpen}
        onOk={handleRemove}
        onCancel={() => setRemoveOpen(false)}
        okText={t('common.confirm')}
        cancelText={t('common.cancel')}
        okButtonProps={{ danger: true }}
      >
        <Text>
          {t('property.backingColumn.confirmRemove', { name: propertyName })}
        </Text>
      </Modal>
    </>
  );
}
