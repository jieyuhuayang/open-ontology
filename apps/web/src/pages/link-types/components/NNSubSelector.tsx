import { Flex, Typography, theme } from 'antd';
import { WarningOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import RelationshipDiagram from './RelationshipDiagram';

const { Text } = Typography;

interface NNSubSelectorProps {
  visible: boolean;
  isBackingObject: boolean;
  onChange: (isBackingObject: boolean) => void;
}

export default function NNSubSelector({ visible, isBackingObject, onChange }: NNSubSelectorProps) {
  const { t } = useTranslation();
  const { token } = theme.useToken();

  const cardStyle = (selected: boolean): React.CSSProperties => ({
    flex: 1,
    border: selected
      ? `2px solid ${token.colorPrimary}`
      : `1px solid ${token.colorBorderSecondary}`,
    borderRadius: token.borderRadiusLG,
    background: selected ? token.colorPrimaryBg : token.colorBgContainer,
    padding: 16,
    cursor: 'pointer',
    transition: 'all 0.2s',
  });

  return (
    <div
      style={{
        overflow: 'hidden',
        maxHeight: visible ? 300 : 0,
        opacity: visible ? 1 : 0,
        transition: 'max-height 0.3s ease, opacity 0.3s ease',
        marginTop: visible ? 8 : 0,
      }}
    >
      <Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
        {t('linkType.wizard.nnSubQuestion')}
      </Text>
      <Flex gap={12}>
        <div
          role="button"
          tabIndex={0}
          style={cardStyle(!isBackingObject)}
          onClick={() => onChange(false)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onChange(false);
            }
          }}
        >
          <Flex vertical align="center" gap={6}>
            <RelationshipDiagram type="many-to-many" active={!isBackingObject} />
            <Text strong style={{ fontSize: 14 }}>
              {t('linkType.wizard.nnSimple')}
            </Text>
            <Text type="secondary" style={{ fontSize: 12, textAlign: 'center' }}>
              {t('linkType.wizard.nnSimpleDesc')}
            </Text>
            <Text
              type="secondary"
              italic
              style={{ fontSize: 12, color: token.colorTextQuaternary }}
            >
              {t('linkType.wizard.nnSimpleExample')}
            </Text>
          </Flex>
        </div>
        <div
          role="button"
          tabIndex={0}
          style={cardStyle(isBackingObject)}
          onClick={() => onChange(true)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onChange(true);
            }
          }}
        >
          <Flex vertical align="center" gap={6}>
            <RelationshipDiagram type="many-to-many-bo" active={isBackingObject} />
            <Text strong style={{ fontSize: 14 }}>
              {t('linkType.wizard.nnRich')}
            </Text>
            <Text type="secondary" style={{ fontSize: 12, textAlign: 'center' }}>
              {t('linkType.wizard.nnRichDesc')}
            </Text>
            <Text
              type="secondary"
              italic
              style={{ fontSize: 12, color: token.colorTextQuaternary }}
            >
              {t('linkType.wizard.nnRichExample')}
            </Text>
            <Text style={{ fontSize: 12, color: token.colorWarning }}>
              <WarningOutlined style={{ marginRight: 4 }} />
              {t('linkType.wizard.nnRichNote')}
            </Text>
          </Flex>
        </div>
      </Flex>
    </div>
  );
}
