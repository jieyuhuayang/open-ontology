import { useEffect } from 'react';
import { Tabs } from 'antd';
import { useTranslation } from 'react-i18next';
import { useWorkshopStore } from '../stores/workshop-store';
import PlanProgressTree from './PlanProgressTree';
import SuggestionCard from './SuggestionCard';
import BlueprintSummary from './BlueprintSummary';
import BlueprintReviewPanel from './BlueprintReviewPanel';

interface SidekickPanelProps {
  blueprintName?: string;
  blueprintItemCount?: number;
  blueprintRid?: string | null;
  blueprintStatus?: string | null;
}

export default function SidekickPanel({
  blueprintName,
  blueprintItemCount,
  blueprintRid,
  blueprintStatus,
}: SidekickPanelProps) {
  const { t } = useTranslation();
  const pageState = useWorkshopStore((s) => s.pageState);
  const pendingCrystallizations = useWorkshopStore(
    (s) => s.pendingCrystallizations,
  );
  const setSelectedEntityRid = useWorkshopStore(
    (s) => s.setSelectedEntityRid,
  );
  const sidekickActiveTab = useWorkshopStore((s) => s.sidekickActiveTab);
  const setSidekickActiveTab = useWorkshopStore(
    (s) => s.setSidekickActiveTab,
  );

  const showReviewTab =
    blueprintStatus === 'pending_review' || blueprintStatus === 'applied';

  // Auto-switch to review tab when blueprint reaches pending_review
  useEffect(() => {
    if (blueprintStatus === 'pending_review') {
      setSidekickActiveTab('review');
    }
  }, [blueprintStatus, setSidekickActiveTab]);

  const assistantContent = (
    <div
      style={{ display: 'flex', flexDirection: 'column', height: '100%' }}
    >
      <PlanProgressTree />
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
        {pendingCrystallizations.map((item) => (
          <SuggestionCard
            key={item.rid}
            itemType={item.itemType}
            displayName={
              (item.suggestion.displayName as string) ??
              (item.suggestion.name as string) ??
              'Unknown'
            }
            confidence={item.confidence}
            confidenceLevel={item.confidenceLevel}
            source={item.suggestion.source as string | undefined}
            onClick={() => setSelectedEntityRid(item.rid)}
          />
        ))}
      </div>
      {pageState === 'blueprint_pending' && blueprintName && (
        <BlueprintSummary
          name={blueprintName}
          itemCount={blueprintItemCount ?? 0}
        />
      )}
    </div>
  );

  const tabItems = [
    {
      key: 'assistant',
      label: t('workshop.sidekick.title'),
      children: assistantContent,
    },
    ...(showReviewTab
      ? [
          {
            key: 'review',
            label: t('workshop.review.tabTitle'),
            children: (
              <BlueprintReviewPanel
                blueprintRid={blueprintRid ?? null}
              />
            ),
          },
        ]
      : []),
  ];

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
      }}
      data-testid="sidekick-content"
    >
      <Tabs
        activeKey={showReviewTab ? sidekickActiveTab : 'assistant'}
        onChange={(key) =>
          setSidekickActiveTab(key as 'assistant' | 'review')
        }
        items={tabItems}
        size="small"
        style={{ height: '100%' }}
        tabBarStyle={{
          padding: '0 16px',
          marginBottom: 0,
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          color: 'rgba(255,255,255,0.6)',
        }}
      />
    </div>
  );
}
