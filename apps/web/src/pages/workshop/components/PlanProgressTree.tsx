import { useTranslation } from 'react-i18next';
import { LoadingOutlined, CheckCircleFilled } from '@ant-design/icons';
import { useWorkshopStore } from '../stores/workshop-store';

const containerStyle: React.CSSProperties = {
  padding: '12px 16px',
  borderBottom: '1px solid rgba(255,255,255,0.06)',
};

export default function PlanProgressTree() {
  const { t } = useTranslation();
  const planSteps = useWorkshopStore((s) => s.planSteps);

  if (planSteps.length === 0) return null;

  const lastStep = planSteps[planSteps.length - 1];
  const total = lastStep?.total ?? planSteps.length;

  return (
    <div style={containerStyle} data-testid="plan-progress-tree">
      <div
        style={{
          fontSize: 12,
          color: 'rgba(255,255,255,0.5)',
          marginBottom: 8,
          textTransform: 'uppercase',
          letterSpacing: 1,
        }}
      >
        {t('workshop.sidekick.planSteps')}
      </div>
      {planSteps.map((step, i) => {
        const isCurrent = i === planSteps.length - 1 && i < total - 1;
        return (
          <div
            key={`${step.index}-${step.step}`}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 8,
              padding: '4px 0',
              fontSize: 13,
            }}
          >
            <span style={{ flexShrink: 0, marginTop: 2 }}>
              {isCurrent ? (
                <LoadingOutlined
                  style={{ color: '#4f8eff', fontSize: 12 }}
                />
              ) : (
                <CheckCircleFilled
                  style={{ color: '#52c41a', fontSize: 12 }}
                />
              )}
            </span>
            <span style={{ color: 'rgba(255,255,255,0.75)' }}>
              {step.step}
            </span>
          </div>
        );
      })}
      <div
        style={{
          fontSize: 11,
          color: 'rgba(255,255,255,0.4)',
          marginTop: 4,
        }}
      >
        {planSteps.length} / {total}
      </div>
    </div>
  );
}
