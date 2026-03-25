import { Tag, Tooltip } from 'antd';
import { useTranslation } from 'react-i18next';

const COLORS: Record<string, string> = {
  high: '#52c41a',
  medium: '#faad14',
  low: '#ff4d4f',
};

interface ConfidenceIndicatorProps {
  confidence: number;
  confidenceLevel: 'high' | 'medium' | 'low';
}

export default function ConfidenceIndicator({
  confidence,
  confidenceLevel,
}: ConfidenceIndicatorProps) {
  const { t } = useTranslation();
  const color = COLORS[confidenceLevel] ?? COLORS.medium;
  const label = t(`sidekick.confidence.${confidenceLevel}`);

  return (
    <Tooltip title={label}>
      <Tag
        color={color}
        style={{ borderRadius: 10, fontSize: 12, lineHeight: '18px' }}
      >
        {Math.round(confidence * 100)}%
      </Tag>
    </Tooltip>
  );
}
