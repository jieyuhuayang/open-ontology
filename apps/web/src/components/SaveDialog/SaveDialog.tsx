import { Modal, Tabs, Button, Space, App } from 'antd';
import { useTranslation } from 'react-i18next';
import { useSaveDialogStore } from '@/stores/save-dialog-store';
import { useWorkingState, usePublish, useDiscardAll, useDiscardChange } from '@/api/working-state';
import ChangesTab from './ChangesTab';
import ErrorsTab, { getValidationErrors } from './ErrorsTab';

export default function SaveDialog() {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const { open, activeTab, closeDialog, setActiveTab } = useSaveDialogStore();
  const { data: ws } = useWorkingState();
  const publish = usePublish();
  const discardAll = useDiscardAll();
  const discardChange = useDiscardChange();

  const changes = ws?.changes ?? [];
  const errors = getValidationErrors(changes);
  const hasErrors = errors.length > 0;

  const handleSave = async () => {
    try {
      await publish.mutateAsync();
      void message.success(t('changeManagement.saveSuccess'));
      closeDialog();
    } catch {
      void message.error(t('changeManagement.saveError'));
    }
  };

  const handleDiscardAll = () => {
    Modal.confirm({
      title: t('changeManagement.discardConfirm'),
      content: t('changeManagement.discardConfirmMessage'),
      okButtonProps: { danger: true },
      okText: t('changeManagement.discardAll'),
      onOk: async () => {
        await discardAll.mutateAsync();
        closeDialog();
      },
    });
  };

  const handleDiscardChange = (changeId: string) => {
    discardChange.mutate(changeId);
  };

  const tabItems = [
    {
      key: 'changes',
      label: t('changeManagement.changes'),
      children: <ChangesTab changes={changes} onDiscardChange={handleDiscardChange} />,
    },
    {
      key: 'errors',
      label: (
        <span>
          {t('changeManagement.errors')}
          {hasErrors && (
            <span
              style={{
                marginLeft: 4,
                background: '#ff4d4f',
                color: '#fff',
                borderRadius: 10,
                padding: '0 6px',
                fontSize: 12,
              }}
            >
              {errors.length}
            </span>
          )}
        </span>
      ),
      children: <ErrorsTab changes={changes} />,
    },
  ];

  return (
    <Modal
      title={t('changeManagement.reviewEdits')}
      open={open}
      onCancel={closeDialog}
      width={640}
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <Button danger type="text" onClick={handleDiscardAll}>
            {t('changeManagement.discardAll')}
          </Button>
          <Space>
            <Button onClick={closeDialog}>{t('common.cancel')}</Button>
            <Button
              type="primary"
              onClick={handleSave}
              loading={publish.isPending}
              disabled={hasErrors || publish.isPending}
            >
              {t('changeManagement.save')}
            </Button>
          </Space>
        </div>
      }
    >
      <Tabs
        activeKey={activeTab}
        onChange={(key) => setActiveTab(key as 'changes' | 'errors')}
        items={tabItems}
      />
    </Modal>
  );
}
