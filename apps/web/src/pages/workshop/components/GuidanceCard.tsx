import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Tag, Input, Button, Space, message } from 'antd';
import { useCreateAgentSession } from '@/api/agent';
import { useWorkshopStore } from '../stores/workshop-store';

const { TextArea } = Input;
const { CheckableTag } = Tag;

const DOMAINS = [
  'ecommerce',
  'finance',
  'supplyChain',
  'healthcare',
  'manufacturing',
  'hr',
] as const;

const GOALS = [
  'dataIntegration',
  'analytics',
  'knowledgeGraph',
  'aiFoundation',
  'dataGovernance',
] as const;

interface GuidanceCardProps {
  ontologyRid: string;
}

const cardStyle: React.CSSProperties = {
  margin: '24px 16px',
  padding: 24,
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 12,
};

export default function GuidanceCard({ ontologyRid }: GuidanceCardProps) {
  const { t } = useTranslation();
  const createSession = useCreateAgentSession();
  const setCurrentSessionRid = useWorkshopStore(
    (s) => s.setCurrentSessionRid,
  );
  const setPageState = useWorkshopStore((s) => s.setPageState);

  const [selectedDomain, setSelectedDomain] = useState<string | null>(null);
  const [customDomain, setCustomDomain] = useState('');
  const [selectedGoal, setSelectedGoal] = useState<string | null>(null);
  const [scopeHint, setScopeHint] = useState('');

  const handleSubmit = async (skip: boolean) => {
    const domain = skip
      ? undefined
      : selectedDomain === 'custom'
        ? customDomain
        : selectedDomain
          ? t(`workshop.domains.${selectedDomain}`)
          : undefined;
    const goal = skip
      ? undefined
      : selectedGoal
        ? t(`workshop.goals.${selectedGoal}`)
        : undefined;

    try {
      const session = await createSession.mutateAsync({
        ontologyRid,
        domain: domain ?? null,
        goal: goal ?? null,
        scopeHint: skip ? null : scopeHint || null,
      } as Parameters<typeof createSession.mutateAsync>[0]);
      setCurrentSessionRid(session.rid);
      setPageState('existing');
    } catch {
      message.error('Failed to create session');
    }
  };

  return (
    <div style={cardStyle} data-testid="guidance-card">
      <h3 style={{ color: 'rgba(255,255,255,0.9)', marginBottom: 20 }}>
        {t('workshop.guidance.title')}
      </h3>

      {/* Domain */}
      <div style={{ marginBottom: 16 }}>
        <div
          style={{
            color: 'rgba(255,255,255,0.6)',
            fontSize: 13,
            marginBottom: 8,
          }}
        >
          {t('workshop.guidance.domain')}
        </div>
        <Space size={[8, 8]} wrap>
          {DOMAINS.map((d) => (
            <CheckableTag
              key={d}
              checked={selectedDomain === d}
              onChange={(checked) => setSelectedDomain(checked ? d : null)}
            >
              {t(`workshop.domains.${d}`)}
            </CheckableTag>
          ))}
          <CheckableTag
            checked={selectedDomain === 'custom'}
            onChange={(checked) => setSelectedDomain(checked ? 'custom' : null)}
          >
            {t('common.other', 'Other')}
          </CheckableTag>
        </Space>
        {selectedDomain === 'custom' && (
          <Input
            size="small"
            style={{ marginTop: 8, maxWidth: 200 }}
            value={customDomain}
            onChange={(e) => setCustomDomain(e.target.value)}
          />
        )}
      </div>

      {/* Goal */}
      <div style={{ marginBottom: 16 }}>
        <div
          style={{
            color: 'rgba(255,255,255,0.6)',
            fontSize: 13,
            marginBottom: 8,
          }}
        >
          {t('workshop.guidance.goal')}
        </div>
        <Space size={[8, 8]} wrap>
          {GOALS.map((g) => (
            <CheckableTag
              key={g}
              checked={selectedGoal === g}
              onChange={(checked) => setSelectedGoal(checked ? g : null)}
            >
              {t(`workshop.goals.${g}`)}
            </CheckableTag>
          ))}
        </Space>
      </div>

      {/* Scope */}
      <div style={{ marginBottom: 20 }}>
        <div
          style={{
            color: 'rgba(255,255,255,0.6)',
            fontSize: 13,
            marginBottom: 8,
          }}
        >
          {t('workshop.guidance.scope')}
        </div>
        <TextArea
          rows={2}
          value={scopeHint}
          onChange={(e) => setScopeHint(e.target.value)}
          placeholder={t('workshop.guidance.scopePlaceholder')}
          style={{ background: 'rgba(255,255,255,0.06)', color: '#fff' }}
        />
      </div>

      {/* Actions */}
      <Space>
        <Button
          type="primary"
          onClick={() => handleSubmit(false)}
          loading={createSession.isPending}
          data-testid="guidance-confirm"
        >
          {t('workshop.guidance.confirm')}
        </Button>
        <Button
          onClick={() => handleSubmit(true)}
          loading={createSession.isPending}
          data-testid="guidance-skip"
        >
          {t('workshop.guidance.skip')}
        </Button>
      </Space>
    </div>
  );
}
