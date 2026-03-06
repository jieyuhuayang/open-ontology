import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { GraphNode } from '../types';
import styles from '../styles/canvas.module.css';

const CARDINALITY_OPTIONS = [
  'one-to-one',
  'one-to-many',
  'many-to-one',
  'many-to-many',
];

interface LinkConfigFormProps {
  sourceNode: GraphNode;
  targetNode: GraphNode;
  onConfirm: (label: string, cardinality: string) => void;
  onCancel: () => void;
}

export default function LinkConfigForm({
  sourceNode,
  targetNode,
  onConfirm,
  onCancel,
}: LinkConfigFormProps) {
  const { t } = useTranslation();
  const [label, setLabel] = useState('');
  const [cardinality, setCardinality] = useState('one-to-many');

  const handleSubmit = () => {
    if (!label.trim()) return;
    onConfirm(label.trim(), cardinality);
  };

  return (
    <div className={styles.linkFormCard}>
      <div className={styles.linkFormNodeInfo}>
        <span
          className={styles.linkFormDot}
          style={{ background: sourceNode.data.color }}
        />
        <span>{sourceNode.data.displayName}</span>
        <span className={styles.linkFormArrow}>→</span>
        <span
          className={styles.linkFormDot}
          style={{ background: targetNode.data.color }}
        />
        <span>{targetNode.data.displayName}</span>
      </div>
      <input
        className={styles.addFormInput}
        type="text"
        placeholder={t('demo.linkName')}
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleSubmit();
        }}
        autoFocus
      />
      <div className={styles.linkFormField}>
        <label className={styles.linkFormLabel}>{t('demo.cardinality')}</label>
        <select
          className={styles.linkFormSelect}
          value={cardinality}
          onChange={(e) => setCardinality(e.target.value)}
        >
          {CARDINALITY_OPTIONS.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      </div>
      <div className={styles.linkFormActions}>
        <button
          className={styles.addFormSubmit}
          onClick={handleSubmit}
          disabled={!label.trim()}
        >
          {t('demo.createLink')}
        </button>
        <button className={styles.linkFormCancel} onClick={onCancel}>
          {t('demo.closePanel')}
        </button>
      </div>
    </div>
  );
}
