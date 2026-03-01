import { Input } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';

export default function SearchBarPlaceholder() {
  const { t } = useTranslation();

  return (
    <Input
      prefix={<SearchOutlined />}
      placeholder={t('topBar.searchPlaceholder')}
      suffix={<span>⌘K</span>}
      disabled
      style={{ maxWidth: 400 }}
    />
  );
}
