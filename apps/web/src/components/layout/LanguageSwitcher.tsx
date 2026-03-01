import { Dropdown } from 'antd';
import { GlobalOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import type { MenuProps } from 'antd';

const languages = [
  { key: 'en-US', label: 'English' },
  { key: 'zh-CN', label: '中文' },
];

export default function LanguageSwitcher() {
  const { i18n } = useTranslation();

  const currentLabel = languages.find((l) => l.key === i18n.language)?.label ?? 'English';

  const items: MenuProps['items'] = languages.map((lang) => ({
    key: lang.key,
    label: lang.label,
  }));

  const onClick: MenuProps['onClick'] = ({ key }) => {
    i18n.changeLanguage(key);
  };

  return (
    <Dropdown menu={{ items, onClick, selectedKeys: [i18n.language] }}>
      <span style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        <GlobalOutlined />
        {currentLabel}
      </span>
    </Dropdown>
  );
}
