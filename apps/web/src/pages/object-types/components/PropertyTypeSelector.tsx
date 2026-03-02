import { Select, Tag } from 'antd';
import { useTranslation } from 'react-i18next';

const AVAILABLE_TYPES = [
  'string',
  'integer',
  'long',
  'float',
  'double',
  'decimal',
  'boolean',
  'date',
  'timestamp',
  'byte',
  'short',
  'array',
  'struct',
  'geopoint',
  'cipher',
];

const COMING_SOON_TYPES = [
  'vector',
  'geoshape',
  'attachment',
  'time-series',
  'media-reference',
  'marking',
];

interface PropertyTypeSelectorProps {
  value?: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export default function PropertyTypeSelector({
  value,
  onChange,
  disabled,
  placeholder,
}: PropertyTypeSelectorProps) {
  const { t } = useTranslation();

  const options = [
    {
      label: t('property.filters.allTypes'),
      options: AVAILABLE_TYPES.map((type) => ({
        value: type,
        label: t(`property.baseTypes.${type}`, type),
        disabled: false,
      })),
    },
    {
      label: t('property.comingSoon'),
      options: COMING_SOON_TYPES.map((type) => ({
        value: type,
        label: (
          <span>
            {t(`property.baseTypes.${type}`, type)}{' '}
            <Tag color="default" style={{ fontSize: 11, marginLeft: 4 }}>
              {t('property.comingSoon')}
            </Tag>
          </span>
        ),
        disabled: true,
      })),
    },
  ];

  return (
    <Select
      value={value}
      onChange={onChange}
      disabled={disabled}
      placeholder={placeholder ?? t('property.fields.baseType')}
      options={options}
      style={{ width: '100%' }}
      showSearch
      filterOption={(input, option) => {
        if (!option || typeof option.label !== 'string') return true;
        return option.label.toLowerCase().includes(input.toLowerCase());
      }}
    />
  );
}
