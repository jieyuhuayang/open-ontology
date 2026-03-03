import { Alert, Flex, Select, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import { useCreateWizardStore } from '@/stores/create-wizard-store';

const { Text } = Typography;

// For MVP: only one default project
const PROJECT_OPTIONS = [
  { value: 'ri.ontology.space.default', label: 'Default Project' },
];

export default function WizardStepSaveLocation() {
  const { t } = useTranslation();
  const { projectRid, setProjectRid } = useCreateWizardStore();

  return (
    <Flex vertical gap={16}>
      <div>
        <Text strong style={{ display: 'block', marginBottom: 8 }}>
          {t('objectType.saveLocation.project')}
        </Text>
        <Select
          value={projectRid}
          onChange={setProjectRid}
          options={PROJECT_OPTIONS}
          style={{ width: '100%' }}
          placeholder={t('objectType.saveLocation.selectProject')}
        />
      </div>
      <Alert
        type="info"
        message={t('objectType.saveLocation.createNote')}
        showIcon
      />
    </Flex>
  );
}
