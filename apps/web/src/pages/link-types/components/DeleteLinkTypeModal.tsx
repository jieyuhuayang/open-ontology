import { Modal, message } from 'antd';
import { useTranslation } from 'react-i18next';
import { useDeleteLinkType } from '@/api/link-types';
import type { AxiosError } from 'axios';

interface ApiErrorResponse {
  error?: { code?: string; message?: string };
}

interface DeleteLinkTypeModalProps {
  rid: string;
  displayId: string;
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function DeleteLinkTypeModal({
  rid,
  displayId,
  open,
  onClose,
  onSuccess,
}: DeleteLinkTypeModalProps) {
  const { t } = useTranslation();
  const deleteMutation = useDeleteLinkType();

  const handleOk = async () => {
    try {
      await deleteMutation.mutateAsync(rid);
      message.success(t('linkType.deleteSuccess'));
      onClose();
      onSuccess?.();
    } catch (err) {
      const axiosErr = err as AxiosError<ApiErrorResponse>;
      const code = axiosErr.response?.data?.error?.code;
      if (code === 'LINK_TYPE_ACTIVE_CANNOT_DELETE') {
        message.error(t('linkType.cannotDeleteActive'));
      } else {
        const serverMessage = axiosErr.response?.data?.error?.message;
        message.error(serverMessage ?? t('error.somethingWentWrong'));
      }
    }
  };

  return (
    <Modal
      title={t('linkType.deleteTitle')}
      open={open}
      onOk={handleOk}
      onCancel={onClose}
      okText={t('common.delete')}
      cancelText={t('common.cancel')}
      okButtonProps={{ danger: true }}
      confirmLoading={deleteMutation.isPending}
    >
      {t('linkType.deleteConfirm', { name: displayId })}
    </Modal>
  );
}
