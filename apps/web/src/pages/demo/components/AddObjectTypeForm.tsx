import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  UserOutlined,
  ShoppingCartOutlined,
  TagOutlined,
  FileOutlined,
  HomeOutlined,
  BankOutlined,
  CloseOutlined,
} from '@ant-design/icons';
import type { DemoObjectType } from '../types';
import styles from '../styles/canvas.module.css';

const PRESET_COLORS = [
  '#4096ff',
  '#52c41a',
  '#faad14',
  '#eb2f96',
  '#13c2c2',
  '#722ed1',
];

const PRESET_ICONS = [
  { key: 'user', icon: <UserOutlined /> },
  { key: 'cart', icon: <ShoppingCartOutlined /> },
  { key: 'tag', icon: <TagOutlined /> },
  { key: 'file', icon: <FileOutlined /> },
  { key: 'home', icon: <HomeOutlined /> },
  { key: 'bank', icon: <BankOutlined /> },
];

const ICON_NAMES: Record<string, string> = {
  user: 'UserOutlined',
  cart: 'ShoppingCartOutlined',
  tag: 'TagOutlined',
  file: 'FileOutlined',
  home: 'HomeOutlined',
  bank: 'BankOutlined',
};

interface AddObjectTypeFormProps {
  onSubmit: (objectType: DemoObjectType) => void;
  onClose: () => void;
}

export default function AddObjectTypeForm({
  onSubmit,
  onClose,
}: AddObjectTypeFormProps) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [selectedColor, setSelectedColor] = useState(PRESET_COLORS[0]!);
  const [selectedIcon, setSelectedIcon] = useState('user');

  const handleSubmit = () => {
    if (!name.trim()) return;
    const objectType: DemoObjectType = {
      id: `manual-${Date.now()}`,
      displayName: name.trim(),
      icon: ICON_NAMES[selectedIcon] ?? 'UserOutlined',
      color: selectedColor,
      properties: [],
    };
    onSubmit(objectType);
    setName('');
  };

  return (
    <div className={styles.addFormCard}>
      <div className={styles.addFormHeader}>
        <span>{t('demo.addObjectType')}</span>
        <button className={styles.addFormClose} onClick={onClose}>
          <CloseOutlined />
        </button>
      </div>
      <input
        className={styles.addFormInput}
        type="text"
        placeholder={t('demo.objectTypeName')}
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleSubmit();
        }}
        autoFocus
      />
      <div className={styles.addFormSwatches}>
        {PRESET_COLORS.map((color) => (
          <button
            key={color}
            className={`${styles.addFormSwatch} ${selectedColor === color ? styles.addFormSwatchActive : ''}`}
            style={{ background: color }}
            onClick={() => setSelectedColor(color)}
          />
        ))}
      </div>
      <div className={styles.addFormIcons}>
        {PRESET_ICONS.map(({ key, icon }) => (
          <button
            key={key}
            className={`${styles.addFormIcon} ${selectedIcon === key ? styles.addFormIconActive : ''}`}
            onClick={() => setSelectedIcon(key)}
          >
            {icon}
          </button>
        ))}
      </div>
      <button
        className={styles.addFormSubmit}
        onClick={handleSubmit}
        disabled={!name.trim()}
      >
        {t('demo.createObjectType')}
      </button>
    </div>
  );
}
