import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Input, Button, message } from 'antd';
import { motion } from 'framer-motion';
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

const stagger = (i: number) => ({
  initial: { opacity: 0, y: 18 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.45, delay: 0.1 + i * 0.08, ease: [0.16, 1, 0.3, 1] },
});

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
    <motion.div
      className={styles.guidanceOverlay}
      data-testid="guidance-card"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.35 }}
    >
      <motion.div
        className={styles.guidanceGlass}
        initial={{ opacity: 0, y: 28, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, delay: 0.05, ease: [0.16, 1, 0.3, 1] }}
      >
        {/* Title */}
        <motion.h1 className={styles.guidanceTitle} {...stagger(0)}>
          {t('workshop.guidance.title')}
        </motion.h1>
        <motion.p className={styles.guidanceSubtitle} {...stagger(1)}>
          {t('workshop.guidance.subtitle')}
        </motion.p>

        {/* Domain */}
        <motion.div {...stagger(2)}>
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
            <div className={styles.guidanceCustomInput} style={{ marginTop: -16, marginBottom: 28 }}>
              <Input
                size="small"
                style={{ maxWidth: 220 }}
                value={customDomain}
                onChange={(e) => setCustomDomain(e.target.value)}
              />
            </div>
          )}
        </motion.div>

        {/* Goal */}
        <motion.div {...stagger(3)}>
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
        </motion.div>

        {/* Scope */}
        <motion.div className={styles.guidanceScopeWrapper} {...stagger(4)}>
          <div className={styles.guidanceSectionLabel}>
            {t('workshop.guidance.scope')}
          </div>
          <TextArea
            rows={3}
            value={scopeHint}
            onChange={(e) => setScopeHint(e.target.value)}
            placeholder={t('workshop.guidance.scopePlaceholder')}
          />
        </motion.div>

        {/* Actions */}
        <motion.div className={styles.guidanceActions} {...stagger(5)}>
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
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
