import { Result } from 'antd';
import { useTranslation } from 'react-i18next';

interface PlaceholderPageProps {
  title: string;
  comingSoon?: boolean;
}

export default function PlaceholderPage({ title, comingSoon }: PlaceholderPageProps) {
  const { t } = useTranslation();

  return (
    <Result
      title={title}
      subTitle={comingSoon ? t('common.comingSoon') : undefined}
    />
  );
}
