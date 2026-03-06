import { useCallback, useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import styles from '../styles/canvas.module.css';

interface IngestionDropZoneProps {
  onFileDropped: (fileName: string) => void;
  onManualCreate?: () => void;
}

export default function IngestionDropZone({ onFileDropped }: IngestionDropZoneProps) {
  const { t } = useTranslation();
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) onFileDropped(file.name);
    },
    [onFileDropped],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false);
  }, []);

  const handleClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) onFileDropped(file.name);
    },
    [onFileDropped],
  );

  return (
    <motion.div
      className={`${styles.idleOverlay} ${isDragOver ? styles.idleOverlayDragActive : ''}`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.6 }}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      <div className={styles.idleCard}>
        <h1 className={styles.idleTitle}>{t('demo.dropTitle')}</h1>
        <p className={styles.idleSubtitle}>{t('demo.dropHint')}</p>
        <button className={styles.idleButton} onClick={handleClick}>
          Upload
        </button>
        <input
          ref={fileInputRef}
          type="file"
          style={{ display: 'none' }}
          onChange={handleFileSelect}
        />
      </div>
    </motion.div>
  );
}
