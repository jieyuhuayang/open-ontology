import { AnimatePresence, motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import type { Suggestion } from '../types';
import SuggestionBubble from './SuggestionBubble';
import styles from '../styles/canvas.module.css';

interface AgentSidekickProps {
  suggestions: Suggestion[];
  onAccept: (id: string) => void;
  onDismiss: (id: string) => void;
}

export default function AgentSidekick({
  suggestions,
  onAccept,
  onDismiss,
}: AgentSidekickProps) {
  const { t } = useTranslation();

  return (
    <motion.div
      className={styles.agentPanel}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5, duration: 0.4 }}
    >
      <div className={styles.agentHeader}>
        <div className={styles.agentDot} />
        {t('demo.agentTitle')}
      </div>
      <AnimatePresence mode="popLayout">
        {suggestions.map((s) => (
          <SuggestionBubble
            key={s.id}
            suggestion={s}
            onAccept={onAccept}
            onDismiss={onDismiss}
          />
        ))}
      </AnimatePresence>
    </motion.div>
  );
}
