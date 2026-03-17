import { Flex, Popover, Typography, Divider, theme } from 'antd';
import { QuestionCircleOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import RelationshipDiagram from './RelationshipDiagram';
import type { DiagramType } from './RelationshipDiagram';

const { Text } = Typography;

interface RelationshipCardProps {
  diagramType: DiagramType;
  title: string;
  description: string;
  example: string;
  helpKey: string;
  selected: boolean;
  onClick: () => void;
}

export default function RelationshipCard({
  diagramType,
  title,
  description,
  example,
  helpKey,
  selected,
  onClick,
}: RelationshipCardProps) {
  const { t } = useTranslation();
  const { token } = theme.useToken();

  const helpContent = (
    <div style={{ maxWidth: 280 }}>
      <Text strong>{title}</Text>
      <div style={{ marginTop: 8 }}>
        <Text>{t(`linkType.relationHelp.${helpKey}.body`)}</Text>
      </div>
      <div style={{ marginTop: 4 }}>
        <Text type="secondary" italic>
          {t(`linkType.relationHelp.${helpKey}.example`)}
        </Text>
      </div>
      <Divider style={{ margin: '8px 0' }} />
      <Text type="secondary" style={{ fontSize: 12 }}>
        {t('linkType.relationHelp.technicalLabel')}:{' '}
        {t(`linkType.relationHelp.${helpKey}.technical`)}
      </Text>
    </div>
  );

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      style={{
        flex: 1,
        position: 'relative',
        border: selected
          ? `2px solid ${token.colorPrimary}`
          : `1px solid ${token.colorBorderSecondary}`,
        borderRadius: token.borderRadiusLG,
        background: selected ? token.colorPrimaryBg : token.colorBgContainer,
        padding: 16,
        cursor: 'pointer',
        transition: 'all 0.2s',
      }}
    >
      <Popover content={helpContent} trigger="click" placement="bottom">
        <QuestionCircleOutlined
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'absolute',
            top: 8,
            right: 8,
            color: token.colorTextQuaternary,
            fontSize: 14,
          }}
        />
      </Popover>
      <Flex vertical align="center" gap={6}>
        <RelationshipDiagram type={diagramType} active={selected} />
        <Text strong style={{ fontSize: 14 }}>
          {title}
        </Text>
        <Text type="secondary" style={{ fontSize: 12, textAlign: 'center' }}>
          {description}
        </Text>
        <Text
          type="secondary"
          italic
          style={{ fontSize: 12, color: token.colorTextQuaternary }}
        >
          {example}
        </Text>
      </Flex>
    </div>
  );
}
