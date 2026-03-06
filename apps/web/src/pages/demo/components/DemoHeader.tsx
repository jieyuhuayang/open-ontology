import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import styles from '../styles/canvas.module.css';

export default function DemoHeader() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <header className={styles.header}>
      <button className={styles.headerBackBtn} onClick={() => navigate('/')}>
        ← {t('common.back')}
      </button>
      <span className={styles.headerTitle}>{t('demo.title')}</span>
      <span className={styles.headerBadge}>DEMO</span>
    </header>
  );
}
