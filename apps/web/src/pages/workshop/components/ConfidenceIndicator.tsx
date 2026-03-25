interface ConfidenceIndicatorProps {
  confidence: number;
  confidenceLevel: 'high' | 'medium' | 'low';
}

const COLORS = {
  high: '#52c41a',
  medium: '#faad14',
  low: '#ff4d4f',
};

export default function ConfidenceIndicator({
  confidence,
  confidenceLevel,
}: ConfidenceIndicatorProps) {
  const color = COLORS[confidenceLevel] ?? COLORS.medium;
  const percentage = Math.round(confidence * 100);

  return (
    <span
      style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
      data-testid="confidence-indicator"
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: color,
          display: 'inline-block',
          boxShadow: `0 0 4px ${color}`,
        }}
      />
      <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>
        {percentage}%
      </span>
    </span>
  );
}
