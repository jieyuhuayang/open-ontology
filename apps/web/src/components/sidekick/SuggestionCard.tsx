import { Button, Card, Collapse, Flex, Space, Tag, Typography } from 'antd';
import {
  CheckOutlined,
  CloseOutlined,
  EditOutlined,
  StarFilled,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import ConfidenceIndicator from './ConfidenceIndicator';
import type { Suggestion } from '@/api/sidekick';

const { Text, Paragraph } = Typography;

interface SuggestionCardProps {
  suggestion: Suggestion;
  llmAvailable: boolean;
  onAccept: () => void;
  onEdit: () => void;
  onIgnore: () => void;
}

export default function SuggestionCard({
  suggestion,
  llmAvailable,
  onAccept,
  onEdit,
  onIgnore,
}: SuggestionCardProps) {
  const { t } = useTranslation();
  const showAccept = !(suggestion.requiresLlm && !llmAvailable);

  return (
    <Card
      size="small"
      style={{ marginBottom: 8 }}
      styles={{ body: { padding: '12px 16px' } }}
    >
      <Flex justify="space-between" align="center" style={{ marginBottom: 8 }}>
        <Space size={4}>
          <StarFilled style={{ color: '#722ed1', fontSize: 12 }} />
          <Tag style={{ fontSize: 11 }}>{suggestion.suggestionType}</Tag>
        </Space>
        <ConfidenceIndicator
          confidence={suggestion.confidence}
          confidenceLevel={suggestion.confidenceLevel}
        />
      </Flex>

      <Text strong style={{ fontSize: 14 }}>
        {suggestion.title}
      </Text>
      <Paragraph
        type="secondary"
        style={{ fontSize: 13, marginTop: 4, marginBottom: 8 }}
        ellipsis={{ rows: 2, expandable: true }}
      >
        {suggestion.description}
      </Paragraph>

      <Collapse
        ghost
        size="small"
        items={[
          {
            key: 'reasoning',
            label: (
              <Text type="secondary" style={{ fontSize: 12 }}>
                {t('sidekick.reasoning')}
              </Text>
            ),
            children: (
              <div style={{ fontSize: 12 }}>
                <Paragraph type="secondary" style={{ marginBottom: 4 }}>
                  {suggestion.reasoning}
                </Paragraph>
                <Tag color="blue" style={{ fontSize: 11 }}>
                  {t(`sidekick.source.${suggestion.source}`)}
                </Tag>
              </div>
            ),
          },
        ]}
      />

      <Flex gap={8} style={{ marginTop: 8 }}>
        {showAccept && (
          <Button
            type="primary"
            size="small"
            icon={<CheckOutlined />}
            onClick={onAccept}
          >
            {t('sidekick.accept')}
          </Button>
        )}
        <Button size="small" icon={<EditOutlined />} onClick={onEdit}>
          {t('sidekick.edit')}
        </Button>
        <Button
          size="small"
          type="text"
          icon={<CloseOutlined />}
          onClick={onIgnore}
        >
          {t('sidekick.ignore')}
        </Button>
      </Flex>
    </Card>
  );
}
