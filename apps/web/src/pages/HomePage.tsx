import { Typography } from 'antd';
import { useTranslation } from 'react-i18next';

const { Title, Paragraph } = Typography;

export default function HomePage() {
  const { t } = useTranslation();

  return (
    <div style={{ textAlign: 'center', paddingTop: 120 }}>
      <Title>{t('home.welcome')}</Title>
      <Paragraph>{t('home.description')}</Paragraph>
    </div>
  );
}
