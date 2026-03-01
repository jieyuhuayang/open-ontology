import { Result } from 'antd';
import { Link, useRouteError } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export default function ErrorBoundary() {
  const error = useRouteError();
  const { t } = useTranslation();

  console.error('[ErrorBoundary]', error);

  return (
    <Result
      status="error"
      title={t('error.somethingWentWrong')}
      subTitle={t('error.somethingWentWrongDesc')}
      extra={<Link to="/">{t('error.backHome')}</Link>}
    />
  );
}
