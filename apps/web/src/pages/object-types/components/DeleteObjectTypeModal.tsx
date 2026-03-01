import { Modal, Typography, message } from 'antd';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useDeleteObjectType } from '@/api/object-types';
import { useLinkTypes } from '@/api/link-types';
import type { AxiosError } from 'axios';

const { Text } = Typography;

interface ApiErrorResponse {
  error?: { code?: string; message?: string };
}

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
  const { data: relatedLinkTypes } = useLinkTypes(1, 100, { objectTypeRid: rid });
  const relatedCount = relatedLinkTypes?.total ?? 0;

  const handleOk = async () => {
    try {
      await deleteMutation.mutateAsync(rid);
      message.success(t('objectType.deleteSuccess'));
      onClose();
      navigate('/object-types');
    } catch (err) {
      const axiosErr = err as AxiosError<ApiErrorResponse>;
      const code = axiosErr.response?.data?.error?.code;
      if (code === 'OBJECT_TYPE_ACTIVE_CANNOT_DELETE') {
        message.error(t('objectType.cannotDeleteActive'));
      } else {
        const serverMessage = axiosErr.response?.data?.error?.message;
        message.error(serverMessage ?? t('error.somethingWentWrong'));
      }
    }
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
      <div>{t('objectType.deleteConfirm', { name: displayName })}</div>
      {relatedCount > 0 && (
        <Text type="warning" style={{ display: 'block', marginTop: 8 }}>
          {t('objectType.deleteCascadeWarning', { count: relatedCount })}
        </Text>
      )}
    </Modal>
  );
}
