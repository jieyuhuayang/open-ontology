import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import type { IngestionPhase } from '../types';
import styles from '../styles/canvas.module.css';
import animStyles from '../styles/animations.module.css';

interface IngestionVortexProps {
  phase: IngestionPhase;
  fileName: string | null;
}

const phaseMessages: Record<string, string> = {
  ABSORBING: 'demo.phaseAbsorbing',
  PROCESSING: 'demo.phaseProcessing',
  CRYSTALLIZING: 'demo.phaseCrystallizing',
};

export default function IngestionVortex({ phase, fileName }: IngestionVortexProps) {
  const { t } = useTranslation();

  if (phase === 'IDLE' || phase === 'COMPLETE') return null;

  const messageKey = phaseMessages[phase];

  return (
    <motion.div
      className={styles.vortexContainer}
      initial={{ opacity: 0, scale: 0.5 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.5 }}
      transition={{ duration: 0.4 }}
    >
      <div className={styles.vortexCenter}>
        {/* Expanding rings */}
        <div className={animStyles.vortexRing} />
        <div className={animStyles.vortexRing} />
        <div className={animStyles.vortexRing} />

        {/* Spinning particles */}
        {Array.from({ length: 12 }, (_, i) => (
          <div
            key={i}
            className={animStyles.vortexParticle}
            style={{
              top: '50%',
              left: '50%',
              transformOrigin: '0 0',
            }}
          />
        ))}

        {/* Core glow */}
        <div className={animStyles.vortexCore} />

        {/* Status text */}
        <div className={styles.vortexText}>
          {messageKey ? t(messageKey) : ''}
          {phase === 'ABSORBING' && fileName && (
            <span style={{ opacity: 0.5, marginLeft: 8 }}>{fileName}</span>
          )}
        </div>
      </div>
    </motion.div>
  );
}
