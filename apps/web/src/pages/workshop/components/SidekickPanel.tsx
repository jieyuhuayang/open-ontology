import { useTranslation } from 'react-i18next';
import { useWorkshopStore } from '../stores/workshop-store';
import PlanProgressTree from './PlanProgressTree';
import SuggestionCard from './SuggestionCard';
import BlueprintSummary from './BlueprintSummary';

interface SidekickPanelProps {
  blueprintName?: string;
  blueprintItemCount?: number;
}

export default function SidekickPanel({
  blueprintName,
  blueprintItemCount,
}: SidekickPanelProps) {
  const { t } = useTranslation();
  const pageState = useWorkshopStore((s) => s.pageState);
  const pendingCrystallizations = useWorkshopStore(
    (s) => s.pendingCrystallizations,
  );
  const setSelectedEntityRid = useWorkshopStore(
    (s) => s.setSelectedEntityRid,
  );

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
      {/* Header */}
      <div
        style={{
          padding: '16px 16px 8px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          fontSize: 14,
          fontWeight: 500,
          color: 'rgba(255,255,255,0.8)',
        }}
      >
        {t('workshop.sidekick.title')}
      </div>

      {/* Plan progress */}
      <PlanProgressTree />

      {/* Suggestion cards (scrollable) */}
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

      {/* Blueprint summary */}
      {pageState === 'blueprint_pending' && blueprintName && (
        <BlueprintSummary
          name={blueprintName}
          itemCount={blueprintItemCount ?? 0}
        />
      )}
    </div>
  );
}
