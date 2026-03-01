import { Modal, message } from 'antd';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useDeleteObjectType } from '@/api/object-types';

interface DeleteObjectTypeModalProps {
  rid: string;
  displayName: string;
  open: boolean;
  onClose: () => void;
}

export default function DeleteObjectTypeModal({
  rid,
  displayName,
  open,
  onClose,
}: DeleteObjectTypeModalProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const deleteMutation = useDeleteObjectType();

  const handleOk = async () => {
    await deleteMutation.mutateAsync(rid);
    message.success(t('objectType.deleteSuccess'));
    onClose();
    navigate('/object-types');
  };

  return (
    <Modal
      title={t('objectType.deleteTitle')}
      open={open}
      onOk={handleOk}
      onCancel={onClose}
      okText={t('common.delete')}
      cancelText={t('common.cancel')}
      okButtonProps={{ danger: true }}
      confirmLoading={deleteMutation.isPending}
    >
      {t('objectType.deleteConfirm', { name: displayName })}
    </Modal>
  );
}
