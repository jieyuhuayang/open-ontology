import { useState, useCallback } from 'react';
import type { DemoProperty } from '../types';
import styles from '../styles/canvas.module.css';

interface NodePropertyEditorProps {
  properties: DemoProperty[];
  onAddProperty: (property: DemoProperty) => void;
}

export default function NodePropertyEditor({
  properties,
  onAddProperty,
}: NodePropertyEditorProps) {
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState('string');

  const handleAdd = useCallback(() => {
    if (!newName.trim()) return;
    onAddProperty({
      name: newName.trim(),
      type: newType,
      description: '',
    });
    setNewName('');
  }, [newName, newType, onAddProperty]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') handleAdd();
    },
    [handleAdd],
  );

  return (
    <div className={styles.propertyEditor}>
      {properties.map((p) => (
        <div key={p.name} className={styles.propertyItem}>
          <span className={styles.propertyName}>{p.name}</span>
          <span className={styles.propertyType}>{p.type}</span>
        </div>
      ))}
      <div className={styles.propertyEditorRow}>
        <input
          className={styles.propertyEditorInput}
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="property name"
        />
        <select
          className={styles.propertyEditorInput}
          value={newType}
          onChange={(e) => setNewType(e.target.value)}
          style={{ flex: '0 0 80px' }}
        >
          <option value="string">string</option>
          <option value="integer">integer</option>
          <option value="decimal">decimal</option>
          <option value="boolean">boolean</option>
          <option value="timestamp">timestamp</option>
        </select>
      </div>
    </div>
  );
}
