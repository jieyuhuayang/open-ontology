import { Button, Select, Space, Modal } from 'antd';
import {
  CheckOutlined,
  CloseOutlined,
  ThunderboltOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import {
  useBatchUpdateDecisions,
  useApplyBlueprint,
  usePreApplyCheck,
} from '@/api/blueprints';
import type { BlueprintItem } from '@/api/types';
import { useWorkshopStore } from '../stores/workshop-store';
import ApplyProgressModal from './ApplyProgressModal';
import { useState } from 'react';

interface ReviewToolbarProps {
  items: BlueprintItem[];
  selectedRowKeys: string[];
  blueprintRid: string;
  filters: { type?: string; confidenceLevel?: string };
  onFilterChange: (f: { type?: string; confidenceLevel?: string }) => void;
}

export default function ReviewToolbar({
  items,
  selectedRowKeys,
  blueprintRid,
  filters,
  onFilterChange,
}: ReviewToolbarProps) {
  const { t } = useTranslation();
  const batchMutation = useBatchUpdateDecisions(blueprintRid);
  const [applyModalOpen, setApplyModalOpen] = useState(false);
  const setSidekickActiveTab = useWorkshopStore(
    (s) => s.setSidekickActiveTab,
  );

  const actionableCount = items.filter(
    (i) => i.userDecision === 'accepted' || i.userDecision === 'edited',
  ).length;
  const undecidedRids = items
    .filter((i) => i.userDecision == null)
    .map((i) => i.rid);

  const handleAcceptAll = () => {
    batchMutation.mutate({
      itemRids: undecidedRids,
      userDecision: 'accepted',
    });
  };

  const handleBatchReject = () => {
    batchMutation.mutate({
      itemRids: selectedRowKeys,
      userDecision: 'rejected',
    });
  };

  const handleDiscard = () => {
    Modal.confirm({
      title: t('workshop.review.discardConfirmTitle'),
      content: t('workshop.review.discardConfirmContent'),
      okButtonProps: { danger: true },
      onOk: async () => {
        const apiClient = (await import('@/api/client')).default;
        await apiClient.patch(`/blueprints/${blueprintRid}`, {
          status: 'discarded',
        });
        setSidekickActiveTab('assistant');
      },
    });
  };

  return (
    <div
      style={{
        padding: '8px 12px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        display: 'flex',
        flexWrap: 'wrap',
        gap: 6,
        alignItems: 'center',
      }}
      data-testid="review-toolbar"
    >
      <Button
        size="small"
        icon={<CheckOutlined />}
        onClick={handleAcceptAll}
        disabled={undecidedRids.length === 0}
        loading={batchMutation.isPending}
      >
        {t('workshop.review.acceptAll')}
      </Button>
      <Button
        size="small"
        danger
        icon={<CloseOutlined />}
        onClick={handleBatchReject}
        disabled={selectedRowKeys.length === 0}
        loading={batchMutation.isPending}
      >
        {t('workshop.review.batchReject')}
      </Button>
      <Select
        size="small"
        placeholder={t('workshop.review.filterByType')}
        allowClear
        style={{ width: 120 }}
        value={filters.type}
        onChange={(v) => onFilterChange({ ...filters, type: v })}
        options={[
          { label: 'OT', value: 'object_type' },
          { label: 'Property', value: 'property' },
          { label: 'LinkType', value: 'link_type' },
        ]}
      />
      <Select
        size="small"
        placeholder={t('workshop.review.filterByConfidence')}
        allowClear
        style={{ width: 100 }}
        value={filters.confidenceLevel}
        onChange={(v) => onFilterChange({ ...filters, confidenceLevel: v })}
        options={[
          { label: '🟢', value: 'high' },
          { label: '🟡', value: 'medium' },
          { label: '🔴', value: 'low' },
        ]}
      />
      <Space style={{ marginLeft: 'auto' }}>
        <Button
          size="small"
          type="text"
          danger
          icon={<DeleteOutlined />}
          onClick={handleDiscard}
        >
          {t('workshop.review.discardBlueprint')}
        </Button>
        <Button
          size="small"
          type="primary"
          icon={<ThunderboltOutlined />}
          disabled={actionableCount === 0}
          title={
            actionableCount === 0
              ? t('workshop.review.noActionableItems')
              : undefined
          }
          onClick={() => setApplyModalOpen(true)}
        >
          {t('workshop.review.applyBlueprint')}
        </Button>
      </Space>
      {applyModalOpen && (
        <ApplyProgressModal
          blueprintRid={blueprintRid}
          open={applyModalOpen}
          onClose={() => setApplyModalOpen(false)}
        />
      )}
    </div>
  );
}
