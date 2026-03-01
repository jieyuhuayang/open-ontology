import { Card, Empty, Typography } from 'antd';
import { useTranslation } from 'react-i18next';

const { Text } = Typography;

interface PlaceholderCardProps {
  titleKey: string;
  count?: number;
  emptyTextKey?: string;
}

export default function PlaceholderCard({ titleKey, count = 0, emptyTextKey }: PlaceholderCardProps) {
  const { t } = useTranslation();

  return (
    <Card
      title={
        <span>
          {t(titleKey)} <Text type="secondary">({count})</Text>
        </span>
      }
      size="small"
    >
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description={emptyTextKey ? t(emptyTextKey) : t('common.noData')}
      />
    </Card>
  );
}
