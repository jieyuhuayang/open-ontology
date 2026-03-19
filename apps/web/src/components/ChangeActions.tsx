import { createPortal } from 'react-dom';
import { Button, Space, Modal } from 'antd';
import { useTranslation } from 'react-i18next';
import { useWorkingState, useDiscardAll } from '@/api/working-state';
import { useSaveDialogStore } from '@/stores/save-dialog-store';

export default function ChangeActions() {
  const { t } = useTranslation();
  const { data: ws } = useWorkingState();
  const discardAll = useDiscardAll();
  const openDialog = useSaveDialogStore((s) => s.openDialog);

  const slot = document.getElementById('change-status-slot');
  if (!slot) return null;

  const changes = ws?.changes ?? [];
  if (changes.length === 0) return createPortal(null, slot);

  const handleDiscard = () => {
    Modal.confirm({
      title: t('changeManagement.discardConfirm'),
      content: t('changeManagement.discardConfirmMessage'),
      okButtonProps: { danger: true },
      okText: t('changeManagement.discard'),
      onOk: () => discardAll.mutateAsync(),
    });
  };

  return createPortal(
    <Space>
      <Button type="primary" onClick={() => openDialog()}>
        {t('changeManagement.save')} ({changes.length})
      </Button>
      <Button danger type="text" onClick={handleDiscard}>
        {t('changeManagement.discard')}
      </Button>
    </Space>,
    slot,
  );
}
