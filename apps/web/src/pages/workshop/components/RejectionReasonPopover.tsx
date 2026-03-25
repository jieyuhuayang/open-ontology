import { useState } from 'react';
import { Button, Input, Popover, Radio, Space, Tooltip } from 'antd';
import { CloseOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import type { BlueprintItem } from '@/api/types';

interface RejectionReasonPopoverProps {
  item: BlueprintItem;
  blueprintRid: string;
  disabled: boolean;
  onConfirm: (reason: string) => void;
}

export default function RejectionReasonPopover({
  item,
  disabled,
  onConfirm,
}: RejectionReasonPopoverProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('irrelevant');
  const [customReason, setCustomReason] = useState('');

  const handleConfirm = () => {
    const finalReason =
      reason === 'other' ? customReason : t(`workshop.review.reason${capitalize(reason)}`);
    onConfirm(finalReason);
    setOpen(false);
    setReason('irrelevant');
    setCustomReason('');
  };

  const content = (
    <div style={{ width: 240 }}>
      <div style={{ marginBottom: 8, fontWeight: 500, fontSize: 13 }}>
        {t('workshop.review.rejectReasonTitle')}
      </div>
      <Radio.Group
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        style={{ display: 'flex', flexDirection: 'column', gap: 6 }}
      >
        <Radio value="irrelevant">
          {t('workshop.review.reasonIrrelevant')}
        </Radio>
        <Radio value="duplicate">
          {t('workshop.review.reasonDuplicate')}
        </Radio>
        <Radio value="inaccurate">
          {t('workshop.review.reasonInaccurate')}
        </Radio>
        <Radio value="other">{t('workshop.review.reasonOther')}</Radio>
      </Radio.Group>
      {reason === 'other' && (
        <Input
          size="small"
          style={{ marginTop: 8 }}
          value={customReason}
          onChange={(e) => setCustomReason(e.target.value)}
          placeholder="..."
        />
      )}
      <div style={{ marginTop: 12, textAlign: 'right' }}>
        <Space>
          <Button size="small" onClick={() => setOpen(false)}>
            {t('workshop.review.cancelEdit')}
          </Button>
          <Button
            size="small"
            danger
            type="primary"
            onClick={handleConfirm}
          >
            {t('workshop.review.confirmReject')}
          </Button>
        </Space>
      </div>
    </div>
  );

  return (
    <Popover
      content={content}
      trigger="click"
      open={open}
      onOpenChange={(v) => !disabled && setOpen(v)}
    >
      <Tooltip
        title={
          disabled
            ? t('workshop.review.decisionLocked')
            : t('workshop.review.reject')
        }
      >
        <Button
          size="small"
          type="text"
          icon={<CloseOutlined />}
          disabled={disabled}
          style={
            item.userDecision === 'rejected'
              ? { color: '#ff4d4f' }
              : undefined
          }
          onClick={(e) => e.stopPropagation()}
        />
      </Tooltip>
    </Popover>
  );
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
