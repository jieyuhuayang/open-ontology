import type { CSSProperties, ReactNode } from 'react';

interface EntityAnchor {
  rid: string;
  displayName: string;
  startIndex: number;
  endIndex: number;
}

interface MessageBubbleProps {
  role: 'user' | 'assistant' | 'system';
  content: string;
  isStreaming?: boolean;
  entityAnchors?: EntityAnchor[];
  onAnchorHover?: (rid: string) => void;
  onAnchorLeave?: () => void;
  onAnchorClick?: (rid: string) => void;
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

const anchorStyle: CSSProperties = {
  color: '#4f8eff',
  cursor: 'pointer',
  borderBottom: '1px dashed rgba(79, 143, 255, 0.5)',
  transition: 'color 0.2s',
};

function renderContentWithAnchors(
  content: string,
  anchors: EntityAnchor[],
  onHover?: (rid: string) => void,
  onLeave?: () => void,
  onClick?: (rid: string) => void,
): ReactNode[] {
  if (anchors.length === 0) return [content];

  const parts: ReactNode[] = [];
  let lastIndex = 0;

  for (const anchor of anchors) {
    if (anchor.startIndex > lastIndex) {
      parts.push(content.slice(lastIndex, anchor.startIndex));
    }
    parts.push(
      <span
        key={`${anchor.rid}-${anchor.startIndex}`}
        style={anchorStyle}
        onMouseEnter={() => onHover?.(anchor.rid)}
        onMouseLeave={() => onLeave?.()}
        onClick={(e) => {
          e.stopPropagation();
          onClick?.(anchor.rid);
        }}
        data-testid={`entity-anchor-${anchor.rid}`}
      >
        {content.slice(anchor.startIndex, anchor.endIndex)}
      </span>,
    );
    lastIndex = anchor.endIndex;
  }

  if (lastIndex < content.length) {
    parts.push(content.slice(lastIndex));
  }

  return parts;
}

export default function MessageBubble({
  role,
  content,
  isStreaming,
  entityAnchors = [],
  onAnchorHover,
  onAnchorLeave,
  onAnchorClick,
}: MessageBubbleProps) {
  const style = role === 'user' ? userStyle : assistantStyle;
  const renderedContent =
    role === 'assistant' && entityAnchors.length > 0
      ? renderContentWithAnchors(
          content,
          entityAnchors,
          onAnchorHover,
          onAnchorLeave,
          onAnchorClick,
        )
      : content;

  return (
    <div style={style} data-testid={`message-${role}`}>
      {renderedContent}
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
