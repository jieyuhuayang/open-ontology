import { Tag, Typography, Flex } from 'antd';
import { LinkOutlined, UnorderedListOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import type { SearchResultItem as SearchResultItemType } from '@/api/types';
import SearchHighlight from './SearchHighlight';
import DynamicIcon from '@/components/DynamicIcon';

const { Text } = Typography;

interface Props {
  item: SearchResultItemType;
  query: string;
}

const changeStateColors: Record<string, { color: string; label: string }> = {
  created: { color: 'green', label: 'New' },
  modified: { color: 'blue', label: 'Modified' },
  deleted: { color: 'red', label: 'Deleted' },
};

export default function SearchResultItemComponent({ item, query }: Props) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const handleClick = () => {
    if (item.resourceType === 'objectType') {
      navigate(`/object-types/${item.rid}/overview`);
    } else if (item.resourceType === 'linkType') {
      navigate(`/link-types/${item.rid}`);
    } else if (item.resourceType === 'property' && item.objectTypeRid) {
      navigate(`/object-types/${item.objectTypeRid}/properties`);
    }
  };

  const stateConfig = changeStateColors[item.changeState];

  return (
    <div
      onClick={handleClick}
      style={{
        padding: '8px 12px',
        cursor: 'pointer',
        borderRadius: 6,
        transition: 'background 0.2s',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = '#f5f5f5';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent';
      }}
    >
      <Flex align="center" gap={8}>
        <span style={{ fontSize: 16, flexShrink: 0 }}>
          {item.resourceType === 'objectType' && item.icon ? (
            <IconDisplay name={item.icon.name} color={item.icon.color} size={16} />
          ) : item.resourceType === 'linkType' ? (
            <LinkOutlined />
          ) : (
            <UnorderedListOutlined />
          )}
        </span>
        <Flex vertical style={{ flex: 1, minWidth: 0 }}>
          <Flex align="center" gap={6}>
            <Text strong ellipsis style={{ maxWidth: 300 }}>
              <SearchHighlight text={item.displayName} query={query} />
            </Text>
            {stateConfig && <Tag color={stateConfig.color}>{stateConfig.label}</Tag>}
          </Flex>
          {item.description && (
            <Text type="secondary" ellipsis style={{ fontSize: 12 }}>
              <SearchHighlight text={item.description} query={query} />
            </Text>
          )}
          <Flex gap={4} style={{ fontSize: 11, color: '#999' }}>
            {item.resourceType === 'property' && item.objectTypeDisplayName && (
              <Text type="secondary" style={{ fontSize: 11 }}>
                {item.objectTypeDisplayName} · {item.baseType}
              </Text>
            )}
            {item.resourceType === 'linkType' &&
              item.sideADisplayName &&
              item.sideBDisplayName && (
                <Text type="secondary" style={{ fontSize: 11 }}>
                  {item.sideADisplayName} ↔ {item.sideBDisplayName}
                </Text>
              )}
            {item.matchedFields.length > 0 && (
              <Text type="secondary" style={{ fontSize: 11 }}>
                {t('search.matchedFields', {
                  fields: item.matchedFields
                    .map((f) => t(`search.field${f.charAt(0).toUpperCase() + f.slice(1)}`))
                    .join(', '),
                })}
              </Text>
            )}
          </Flex>
        </Flex>
      </Flex>
    </div>
  );
}
