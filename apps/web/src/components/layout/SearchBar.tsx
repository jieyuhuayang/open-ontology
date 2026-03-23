import { useCallback, useEffect, useRef } from 'react';
import { Input, type InputRef } from 'antd';
import { CloseCircleFilled, SearchOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useSearchStore } from '@/stores/search-store';

export default function SearchBar() {
  const { t } = useTranslation();
  const inputRef = useRef<InputRef>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const { inputValue, setInputValue, setQuery, enterSearchMode, exitSearchMode } = useSearchStore();

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value.slice(0, 200);
      setInputValue(value);

      if (debounceRef.current) clearTimeout(debounceRef.current);

      if (value.trim()) {
        debounceRef.current = setTimeout(() => {
          setQuery(value);
          enterSearchMode();
        }, 300);
      } else {
        exitSearchMode();
      }
    },
    [setInputValue, setQuery, enterSearchMode, exitSearchMode],
  );

  const handleClear = useCallback(() => {
    exitSearchMode();
    inputRef.current?.focus();
  }, [exitSearchMode]);

  const handleFocus = useCallback(() => {
    if (inputValue.trim()) {
      enterSearchMode();
    }
  }, [inputValue, enterSearchMode]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
      if (e.key === 'Escape') {
        exitSearchMode();
        inputRef.current?.blur();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [exitSearchMode]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return (
    <Input
      ref={inputRef}
      prefix={<SearchOutlined />}
      placeholder={t('topBar.searchPlaceholder')}
      value={inputValue}
      onChange={handleChange}
      onFocus={handleFocus}
      suffix={
        inputValue ? (
          <CloseCircleFilled
            style={{ color: '#999', cursor: 'pointer' }}
            onClick={handleClear}
          />
        ) : (
          <span style={{ color: '#bbb', fontSize: 12 }}>⌘K</span>
        )
      }
      style={{ maxWidth: 400 }}
      allowClear={false}
    />
  );
}
