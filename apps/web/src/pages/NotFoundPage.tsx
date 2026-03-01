import { Result } from 'antd';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export default function NotFoundPage() {
  const { t } = useTranslation();

  return (
    <Result
      status="404"
      title={t('error.pageNotFound')}
      subTitle={t('error.pageNotFoundDesc')}
      extra={<Link to="/">{t('error.backHome')}</Link>}
    />
  );
}
