import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { Badge, Button, Modal, Space, Typography } from 'antd';
import { HistoryOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useWorkingState, useDiscardAll } from '@/api/working-state';
import { useSaveDialogStore } from '@/stores/save-dialog-store';

const { Text } = Typography;

export default function ChangeActions() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: ws } = useWorkingState();
  const discardAll = useDiscardAll();
  const openDialog = useSaveDialogStore((s) => s.openDialog);

  const slot = document.getElementById('change-status-slot');
  if (!slot) return null;

  const changes = ws?.changes ?? [];
  const changeCount = changes.length;

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
    <Space size="middle" align="center">
      <Badge count={changeCount > 0 ? `+${changeCount}` : 0} size="small">
        <Button
          type="text"
          icon={<HistoryOutlined />}
          onClick={() => navigate('/history')}
        >
          {t('changeManagement.history')}
        </Button>
      </Badge>
      {changeCount > 0 && (
        <>
          <Text
            type="secondary"
            style={{ cursor: 'pointer' }}
            onClick={() => openDialog('changes')}
          >
            {t('changeManagement.editsCount', { count: changeCount })}
          </Text>
          <Button onClick={handleDiscard}>
            {t('changeManagement.discard')}
          </Button>
          <Button type="primary" onClick={() => openDialog()}>
            {t('changeManagement.save')}
          </Button>
        </>
      )}
    </Space>,
    slot,
  );
}
