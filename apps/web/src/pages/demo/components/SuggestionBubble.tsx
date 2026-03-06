import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import type { Suggestion } from '../types';
import styles from '../styles/canvas.module.css';

interface SuggestionBubbleProps {
  suggestion: Suggestion;
  onAccept: (id: string) => void;
  onDismiss: (id: string) => void;
}

export default function SuggestionBubble({
  suggestion,
  onAccept,
  onDismiss,
}: SuggestionBubbleProps) {
  const { t } = useTranslation();

  return (
    <motion.div
      className={styles.suggestionBubble}
      initial={{ opacity: 0, x: 40, scale: 0.95 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 40, scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      layout
    >
      <div>{suggestion.text}</div>
      <div className={styles.suggestionActions}>
        <button
          className={styles.suggestionAccept}
          onClick={() => onAccept(suggestion.id)}
        >
          {t('demo.accept')}
        </button>
        <button
          className={styles.suggestionDismiss}
          onClick={() => onDismiss(suggestion.id)}
        >
          {t('demo.dismiss')}
        </button>
      </div>
    </motion.div>
  );
}
