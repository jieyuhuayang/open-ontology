import type { CSSProperties } from 'react';

interface MessageBubbleProps {
  role: 'user' | 'assistant' | 'system';
  content: string;
  isStreaming?: boolean;
}

const baseStyle: CSSProperties = {
  maxWidth: '85%',
  padding: '10px 14px',
  borderRadius: 12,
  fontSize: 14,
  lineHeight: 1.6,
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
};

const userStyle: CSSProperties = {
  ...baseStyle,
  alignSelf: 'flex-end',
  background: 'rgba(79, 142, 255, 0.2)',
  border: '1px solid rgba(79, 142, 255, 0.3)',
  color: 'rgba(255,255,255,0.9)',
};

const assistantStyle: CSSProperties = {
  ...baseStyle,
  alignSelf: 'flex-start',
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.08)',
  color: 'rgba(255,255,255,0.87)',
};

export default function MessageBubble({
  role,
  content,
  isStreaming,
}: MessageBubbleProps) {
  const style = role === 'user' ? userStyle : assistantStyle;

  return (
    <div style={style} data-testid={`message-${role}`}>
      {content}
      {isStreaming && (
        <span
          style={{
            display: 'inline-block',
            width: 6,
            height: 16,
            marginLeft: 2,
            background: 'rgba(79, 142, 255, 0.8)',
            animation: 'blink 1s infinite',
            verticalAlign: 'text-bottom',
          }}
        />
      )}
    </div>
  );
}
