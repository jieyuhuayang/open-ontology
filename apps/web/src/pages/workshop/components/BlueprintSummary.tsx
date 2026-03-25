import { useTranslation } from 'react-i18next';

interface BlueprintSummaryProps {
  name: string;
  itemCount: number;
}

export default function BlueprintSummary({
  name,
  itemCount,
}: BlueprintSummaryProps) {
  const { t } = useTranslation();

  return (
    <div
      style={{
        padding: '12px 16px',
        borderTop: '1px solid rgba(255,255,255,0.06)',
        fontSize: 13,
      }}
      data-testid="blueprint-summary"
    >
      <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, marginBottom: 4 }}>
        {t('workshop.sidekick.blueprintComplete')}
      </div>
      <div style={{ color: 'rgba(255,255,255,0.85)', fontWeight: 500 }}>
        {name}
      </div>
      <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>
        {itemCount} items
      </div>
    </div>
  );
}
