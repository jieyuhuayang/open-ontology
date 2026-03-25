import { useState } from 'react';
import { Spin, Empty, Result } from 'antd';
import { useTranslation } from 'react-i18next';
import { useBlueprintDetail } from '@/api/blueprints';
import ReviewToolbar from './ReviewToolbar';
import BlueprintReviewTable from './BlueprintReviewTable';

interface BlueprintReviewPanelProps {
  blueprintRid: string | null;
}

export default function BlueprintReviewPanel({
  blueprintRid,
}: BlueprintReviewPanelProps) {
  const { t } = useTranslation();
  const { data: detail, isLoading } = useBlueprintDetail(blueprintRid);
  const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([]);
  const [filters, setFilters] = useState<{
    type?: string;
    confidenceLevel?: string;
  }>({});

  const blueprint = detail?.blueprint;
  const items = detail?.items ?? [];

  if (!blueprintRid || (!isLoading && !blueprint)) {
    return (
      <Empty
        description={t('workshop.review.empty')}
        style={{ padding: 32, color: 'rgba(255,255,255,0.45)' }}
      />
    );
  }

  if (isLoading || blueprint?.status === 'draft') {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          padding: 48,
        }}
      >
        <Spin tip={t('workshop.review.analyzing')} />
      </div>
    );
  }

  if (blueprint.status === 'applied') {
    const succeeded = items.filter(
      (i) => i.createdEntityRid != null,
    ).length;
    const failed = items.filter(
      (i) =>
        (i.userDecision === 'accepted' || i.userDecision === 'edited') &&
        i.createdEntityRid == null,
    ).length;
    const rejected = items.filter(
      (i) => i.userDecision === 'rejected',
    ).length;

    return (
      <Result
        status="success"
        title={t('workshop.review.readOnlySummary')}
        subTitle={`${t('workshop.review.succeeded')}: ${succeeded} | ${t('workshop.review.failed')}: ${failed} | ${t('workshop.review.skipped')}: ${rejected}`}
        style={{ padding: 24, color: 'rgba(255,255,255,0.8)' }}
      />
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
      }}
      data-testid="blueprint-review-panel"
    >
      <ReviewToolbar
        items={items}
        selectedRowKeys={selectedRowKeys}
        blueprintRid={blueprintRid}
        filters={filters}
        onFilterChange={setFilters}
      />
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <BlueprintReviewTable
          items={items}
          blueprintRid={blueprintRid}
          filters={filters}
          selectedRowKeys={selectedRowKeys}
          onSelectedRowKeysChange={setSelectedRowKeys}
        />
      </div>
    </div>
  );
}
