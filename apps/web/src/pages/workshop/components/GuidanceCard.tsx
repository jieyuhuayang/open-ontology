import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Input, Button, message } from 'antd';
import { useCreateAgentSession } from '@/api/agent';
import { useWorkshopStore } from '../stores/workshop-store';
import styles from '../styles/workshop.module.css';

const { TextArea } = Input;

const DOMAINS = [
  'ecommerce',
  'finance',
  'supplyChain',
  'healthcare',
  'manufacturing',
  'hr',
] as const;

const DOMAIN_ICONS: Record<string, string> = {
  ecommerce: '🛒',
  finance: '🏦',
  supplyChain: '📦',
  healthcare: '🏥',
  manufacturing: '🏭',
  hr: '👥',
};

const GOALS = [
  'dataIntegration',
  'analytics',
  'knowledgeGraph',
  'aiFoundation',
  'dataGovernance',
] as const;

const GOAL_ICONS: Record<string, string> = {
  dataIntegration: '🔗',
  analytics: '📊',
  knowledgeGraph: '🧠',
  aiFoundation: '⚡',
  dataGovernance: '🛡️',
};

interface GuidanceCardProps {
  ontologyRid: string;
}

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
      message.error(t('workshop.guidance.createFailed', 'Failed to create session'));
    }
  };

  const toggleDomain = (d: string) =>
    setSelectedDomain((prev) => (prev === d ? null : d));

  const toggleGoal = (g: string) =>
    setSelectedGoal((prev) => (prev === g ? null : g));

  return (
    <div className={styles.guidanceOverlay} data-testid="guidance-card">
      <div className={styles.guidanceGlass}>
        {/* Title */}
        <h1 className={styles.guidanceTitle}>
          {t('workshop.guidance.title')}
        </h1>
        <p className={styles.guidanceSubtitle}>
          {t('workshop.guidance.subtitle')}
        </p>

        {/* Domain */}
        <div className={styles.guidanceSection}>
          <div className={styles.guidanceSectionLabel}>
            {t('workshop.guidance.domain')}
          </div>
          <div className={styles.guidancePillGrid}>
            {DOMAINS.map((d) => (
              <div
                key={d}
                className={`${styles.guidancePill} ${selectedDomain === d ? styles.guidancePillSelected : ''}`}
                onClick={() => toggleDomain(d)}
              >
                <span>{DOMAIN_ICONS[d]}</span>
                <span>{t(`workshop.domains.${d}`)}</span>
              </div>
            ))}
            <div
              className={`${styles.guidancePill} ${selectedDomain === 'custom' ? styles.guidancePillSelected : ''}`}
              onClick={() => toggleDomain('custom')}
            >
              <span>✦</span>
              <span>{t('common.other', 'Other')}</span>
            </div>
          </div>
          {selectedDomain === 'custom' && (
            <div className={styles.guidanceCustomInput}>
              <Input
                size="small"
                style={{ maxWidth: 220 }}
                value={customDomain}
                onChange={(e) => setCustomDomain(e.target.value)}
              />
            </div>
          )}
        </div>

        {/* Goal */}
        <div className={styles.guidanceSection}>
          <div className={styles.guidanceSectionLabel}>
            {t('workshop.guidance.goal')}
          </div>
          <div className={styles.guidancePillGrid}>
            {GOALS.map((g) => (
              <div
                key={g}
                className={`${styles.guidancePill} ${selectedGoal === g ? styles.guidancePillSelected : ''}`}
                onClick={() => toggleGoal(g)}
              >
                <span>{GOAL_ICONS[g]}</span>
                <span>{t(`workshop.goals.${g}`)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Scope */}
        <div className={styles.guidanceScopeWrapper}>
          <div className={styles.guidanceSectionLabel}>
            {t('workshop.guidance.scope')}
          </div>
          <TextArea
            rows={3}
            value={scopeHint}
            onChange={(e) => setScopeHint(e.target.value)}
            placeholder={t('workshop.guidance.scopePlaceholder')}
          />
        </div>

        {/* Actions */}
        <div className={styles.guidanceActions}>
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
        </div>
      </div>
    </div>
  );
}
