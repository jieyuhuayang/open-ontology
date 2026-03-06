import { useCallback, useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { CloudUploadOutlined } from '@ant-design/icons';
import styles from '../styles/canvas.module.css';

interface IngestionDropZoneProps {
  onFileDropped: (fileName: string) => void;
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
      className={styles.dropZone}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div
        className={`${styles.dropZoneInner} ${isDragOver ? styles.dropZoneActive : ''}`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={handleClick}
      >
        <CloudUploadOutlined className={styles.dropZoneIcon} />
        <div className={styles.dropZoneTitle}>{t('demo.dropTitle')}</div>
        <div className={styles.dropZoneHint}>{t('demo.dropHint')}</div>
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
