import { useEffect, useRef } from 'react';
import MessageBubble from './MessageBubble';

interface Message {
  rid: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface MessageListProps {
  messages: Message[];
  streamingText?: string;
}

const containerStyle: React.CSSProperties = {
  flex: 1,
  overflowY: 'auto',
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
  padding: '12px 16px',
};

export default function MessageList({
  messages,
  streamingText,
}: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, streamingText]);

  return (
    <div style={containerStyle} data-testid="message-list">
      {messages.map((msg) => (
        <MessageBubble key={msg.rid} role={msg.role} content={msg.content} />
      ))}
      {streamingText && (
        <MessageBubble role="assistant" content={streamingText} isStreaming />
      )}
      <div ref={bottomRef} />
    </div>
  );
}
