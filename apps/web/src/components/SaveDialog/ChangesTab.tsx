import { Badge, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import ChangeItem from './ChangeItem';
import type { Change } from '@/api/types';

const { Text } = Typography;

const RESOURCE_TYPE_LABEL_KEYS: Record<string, string> = {
  ObjectType: 'changeManagement.objectTypes',
  Property: 'changeManagement.properties',
  LinkType: 'changeManagement.linkTypes',
};

const RESOURCE_TYPE_ORDER = ['ObjectType', 'Property', 'LinkType'];

interface ChangesTabProps {
  changes: Change[];
  onDiscardChange: (changeId: string) => void;
}

export default function ChangesTab({ changes, onDiscardChange }: ChangesTabProps) {
  const { t } = useTranslation();

  const grouped = new Map<string, Change[]>();
  for (const change of changes) {
    const type = change.resourceType;
    if (!grouped.has(type)) grouped.set(type, []);
    grouped.get(type)!.push(change);
  }

  return (
    <div>
      {RESOURCE_TYPE_ORDER.filter((rt) => grouped.has(rt)).map((rt) => {
        const items = grouped.get(rt)!;
        return (
          <div key={rt} style={{ marginBottom: 16 }}>
            <div style={{ marginBottom: 8 }}>
              <Text strong>{t(RESOURCE_TYPE_LABEL_KEYS[rt] ?? rt)}</Text>{' '}
              <Badge count={items.length} style={{ backgroundColor: '#999' }} />
            </div>
            {items.map((change) => (
              <ChangeItem key={change.id} change={change} onDiscard={onDiscardChange} />
            ))}
          </div>
        );
      })}
    </div>
  );
}
