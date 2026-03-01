import { Flex } from 'antd';
import { useParams } from 'react-router-dom';
import { useObjectType } from '@/api/object-types';
import MetadataSection from './components/MetadataSection';
import PlaceholderCard from '@/components/PlaceholderCard';

export default function ObjectTypeOverviewPage() {
  const { rid } = useParams<{ rid: string }>();
  const { data } = useObjectType(rid ?? '');

  if (!data) return null;

  return (
    <div>
      <MetadataSection data={data} />
      <Flex vertical gap={16}>
        <PlaceholderCard
          titleKey="objectType.placeholders.properties"
          emptyTextKey="objectType.placeholders.propertiesEmpty"
        />
        <PlaceholderCard
          titleKey="objectType.placeholders.actionTypes"
          emptyTextKey="objectType.placeholders.actionTypesEmpty"
        />
        <PlaceholderCard
          titleKey="objectType.placeholders.linkTypes"
          emptyTextKey="objectType.placeholders.linkTypesEmpty"
        />
        <PlaceholderCard
          titleKey="objectType.placeholders.data"
          emptyTextKey="objectType.placeholders.dataEmpty"
        />
      </Flex>
    </div>
  );
}
