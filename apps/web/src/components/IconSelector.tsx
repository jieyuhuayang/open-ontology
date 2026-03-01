import { Popover, Button, Flex, Tooltip } from 'antd';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import DynamicIcon, { ICON_NAMES } from '@/components/DynamicIcon';
import type { Icon } from '@/api/types';

const COLORS = [
  '#1677ff', '#722ed1', '#eb2f96', '#f5222d',
  '#fa541c', '#fa8c16', '#faad14', '#a0d911',
  '#52c41a', '#13c2c2', '#2f54eb', '#595959',
];

interface IconSelectorProps {
  value: Icon;
  onChange: (icon: Icon) => void;
}

export default function IconSelector({ value, onChange }: IconSelectorProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  const content = (
    <div style={{ width: 280 }}>
      <div style={{ marginBottom: 8, fontWeight: 500 }}>{t('objectType.fields.icon')}</div>
      <Flex wrap gap={4} style={{ marginBottom: 12 }}>
        {ICON_NAMES.map((name) => (
          <Tooltip key={name} title={name.replace('Outlined', '')}>
            <Button
              type={value.name === name ? 'primary' : 'text'}
              size="small"
              icon={<DynamicIcon name={name} color={value.name === name ? '#fff' : value.color} size={16} />}
              onClick={() => onChange({ ...value, name })}
              style={{ width: 32, height: 32 }}
            />
          </Tooltip>
        ))}
      </Flex>
      <Flex wrap gap={4}>
        {COLORS.map((color) => (
          <Button
            key={color}
            size="small"
            onClick={() => onChange({ ...value, color })}
            style={{
              width: 24,
              height: 24,
              minWidth: 24,
              padding: 0,
              backgroundColor: color,
              border: value.color === color ? '2px solid #000' : '2px solid transparent',
              borderRadius: '50%',
            }}
          />
        ))}
      </Flex>
    </div>
  );

  return (
    <Popover
      content={content}
      trigger="click"
      open={open}
      onOpenChange={setOpen}
      placement="bottomLeft"
    >
      <Button
        type="text"
        style={{ width: 40, height: 40, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        <DynamicIcon name={value.name} color={value.color} size={24} />
      </Button>
    </Popover>
  );
}
