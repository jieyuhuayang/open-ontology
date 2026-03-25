import { useTranslation } from 'react-i18next';
import { TagOutlined, LinkOutlined } from '@ant-design/icons';
import ConfidenceIndicator from './ConfidenceIndicator';

interface SuggestionCardProps {
  itemType: string;
  displayName: string;
  confidence: number;
  confidenceLevel: string;
  source?: string;
  onClick?: () => void;
}

const cardStyle: React.CSSProperties = {
  padding: '10px 14px',
  margin: '0 12px 8px',
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 8,
  cursor: 'pointer',
  transition: 'background 0.2s',
};

const SOURCE_KEYS: Record<string, string> = {
  field_analysis: 'source.field_analysis',
  pattern_matching: 'source.pattern_matching',
  semantic_inference: 'source.semantic_inference',
  best_practices: 'source.best_practices',
};

export default function SuggestionCard({
  itemType,
  displayName,
  confidence,
  confidenceLevel,
  source,
  onClick,
}: SuggestionCardProps) {
  const { t } = useTranslation();
  const isOT = itemType === 'object_type';

  return (
    <div
      style={cardStyle}
      onClick={onClick}
      data-testid="suggestion-card"
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.background =
          'rgba(255,255,255,0.08)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.background =
          'rgba(255,255,255,0.04)';
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 4,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {isOT ? (
            <TagOutlined style={{ color: '#4f8eff', fontSize: 13 }} />
          ) : (
            <LinkOutlined style={{ color: '#36cfc9', fontSize: 13 }} />
          )}
          <span
            style={{
              color: 'rgba(255,255,255,0.9)',
              fontSize: 13,
              fontWeight: 500,
            }}
          >
            {displayName}
          </span>
        </div>
        <ConfidenceIndicator
          confidence={confidence}
          confidenceLevel={
            confidenceLevel as 'high' | 'medium' | 'low'
          }
        />
      </div>
      {source && (
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
          {t(`workshop.${SOURCE_KEYS[source] ?? source}`)}
        </div>
      )}
    </div>
  );
}
