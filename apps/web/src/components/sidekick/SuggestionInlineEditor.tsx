import { useState } from 'react';
import { Button, Flex, Input, Select } from 'antd';
import { useTranslation } from 'react-i18next';
import type { Suggestion } from '@/api/sidekick';

const { TextArea } = Input;

interface SuggestionInlineEditorProps {
  suggestion: Suggestion;
  onConfirm: (payload: Record<string, unknown>) => void;
  onCancel: () => void;
}

export default function SuggestionInlineEditor({
  suggestion,
  onConfirm,
  onCancel,
}: SuggestionInlineEditorProps) {
  const { t } = useTranslation();
  const [textValue, setTextValue] = useState('');
  const [selectValue, setSelectValue] = useState<string | undefined>(undefined);

  const isTextType = [
    'missing_description',
    'description_enhancement',
    'naming_improvement',
  ].includes(suggestion.suggestionType);

  const isCardinalityType = suggestion.suggestionType === 'cardinality_review';

  const handleConfirm = () => {
    if (isTextType) {
      onConfirm({ description: textValue });
    } else if (isCardinalityType) {
      onConfirm({ cardinality: selectValue });
    } else {
      onConfirm({ value: textValue });
    }
  };

  return (
    <div style={{ padding: '8px 0' }}>
      {isTextType && (
        <TextArea
          rows={3}
          value={textValue}
          onChange={(e) => setTextValue(e.target.value)}
          placeholder={suggestion.description}
          style={{ marginBottom: 8 }}
        />
      )}

      {isCardinalityType && (
        <Select
          value={selectValue}
          onChange={setSelectValue}
          style={{ width: '100%', marginBottom: 8 }}
          options={[
            { label: t('linkType.cardinality.oneToOne', 'One to One'), value: 'one-to-one' },
            { label: t('linkType.cardinality.oneToMany', 'One to Many'), value: 'one-to-many' },
            { label: t('linkType.cardinality.manyToMany', 'Many to Many'), value: 'many-to-many' },
          ]}
          placeholder={t('sidekick.selectCardinality', 'Select cardinality')}
        />
      )}

      {!isTextType && !isCardinalityType && (
        <TextArea
          rows={2}
          value={textValue}
          onChange={(e) => setTextValue(e.target.value)}
          placeholder={suggestion.description}
          style={{ marginBottom: 8 }}
        />
      )}

      <Flex gap={8}>
        <Button type="primary" size="small" onClick={handleConfirm}>
          {t('sidekick.confirm')}
        </Button>
        <Button size="small" onClick={onCancel}>
          {t('sidekick.cancel')}
        </Button>
      </Flex>
    </div>
  );
}
