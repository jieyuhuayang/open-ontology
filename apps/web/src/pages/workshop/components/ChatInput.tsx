import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { SendOutlined, PaperClipOutlined } from '@ant-design/icons';

interface ChatInputProps {
  onSend: (content: string) => void;
  onUploadClick?: () => void;
  disabled?: boolean;
}

const containerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-end',
  gap: 8,
  padding: '12px 16px',
  borderTop: '1px solid rgba(255,255,255,0.08)',
};

const textareaStyle: React.CSSProperties = {
  flex: 1,
  minHeight: 40,
  maxHeight: 120,
  padding: '8px 12px',
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 8,
  color: 'rgba(255,255,255,0.87)',
  fontSize: 14,
  lineHeight: 1.5,
  resize: 'none',
  outline: 'none',
  fontFamily: 'inherit',
};

const btnStyle: React.CSSProperties = {
  width: 36,
  height: 36,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'rgba(79, 142, 255, 0.2)',
  border: '1px solid rgba(79, 142, 255, 0.3)',
  borderRadius: 8,
  color: 'rgba(79, 142, 255, 0.9)',
  cursor: 'pointer',
  fontSize: 16,
};

const disabledBtnStyle: React.CSSProperties = {
  ...btnStyle,
  opacity: 0.4,
  cursor: 'not-allowed',
};

export default function ChatInput({
  onSend,
  onUploadClick,
  disabled,
}: ChatInputProps) {
  const { t } = useTranslation();
  const [text, setText] = useState('');

  const handleSend = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setText('');
  }, [text, disabled, onSend]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  return (
    <div style={containerStyle} data-testid="chat-input">
      <button
        style={{ ...btnStyle, background: 'transparent', border: 'none' }}
        onClick={onUploadClick}
        title={t('workshop.upload.dropHint')}
        data-testid="upload-button"
      >
        <PaperClipOutlined />
      </button>
      <textarea
        style={textareaStyle}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={
          disabled
            ? t('workshop.chat.thinking')
            : t('workshop.chat.placeholder')
        }
        disabled={disabled}
        rows={1}
        data-testid="chat-textarea"
      />
      <button
        style={disabled ? disabledBtnStyle : btnStyle}
        onClick={handleSend}
        disabled={disabled || !text.trim()}
        data-testid="send-button"
      >
        <SendOutlined />
      </button>
    </div>
  );
}
