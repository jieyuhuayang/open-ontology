import { useState, useRef, useEffect } from 'react';
import { Input, Typography, Tooltip } from 'antd';
import type { InputRef } from 'antd';

const { Text } = Typography;

interface InlineEditTextProps {
  value: string;
  onSave: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  disabledTooltip?: string;
  required?: boolean;
  multiline?: boolean;
  style?: React.CSSProperties;
}

export default function InlineEditText({
  value,
  onSave,
  placeholder,
  disabled,
  disabledTooltip,
  required,
  multiline,
  style,
}: InlineEditTextProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<InputRef>(null);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
    }
  }, [isEditing]);

  const handleSave = () => {
    const trimmed = draft.trim();
    if (required && !trimmed) {
      setDraft(value);
      setIsEditing(false);
      return;
    }
    if (trimmed !== value) {
      onSave(trimmed);
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setDraft(value);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !multiline) {
      handleSave();
    }
    if (e.key === 'Escape') {
      handleCancel();
    }
  };

  if (isEditing) {
    if (multiline) {
      return (
        <Input.TextArea
          ref={inputRef as never}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          autoSize={{ minRows: 1, maxRows: 4 }}
          style={style}
        />
      );
    }
    return (
      <Input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={handleSave}
        onKeyDown={handleKeyDown}
        style={style}
      />
    );
  }

  const display = (
    <Text
      style={{
        cursor: disabled ? 'not-allowed' : 'pointer',
        padding: '4px 8px',
        borderRadius: 4,
        display: 'inline-block',
        minHeight: 32,
        lineHeight: '24px',
        color: value ? undefined : '#bfbfbf',
        ...(!disabled && {
          ':hover': { backgroundColor: '#f5f5f5' },
        }),
        ...style,
      }}
      onClick={disabled ? undefined : () => setIsEditing(true)}
    >
      {value || placeholder}
    </Text>
  );

  if (disabled && disabledTooltip) {
    return <Tooltip title={disabledTooltip}>{display}</Tooltip>;
  }
  return display;
}
