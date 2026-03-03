import { Checkbox, Flex, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import { useCreateWizardStore } from '@/stores/create-wizard-store';

const { Text } = Typography;

const ACTION_OPTIONS = [
  { key: 'create', descKey: 'createDesc' },
  { key: 'modify', descKey: 'modifyDesc' },
  { key: 'delete', descKey: 'deleteDesc' },
];

export default function WizardStepActions() {
  const { t } = useTranslation();
  const { intendedActions, displayName, setIntendedActions } = useCreateWizardStore();
  const name = displayName || '...';

  const handleChange = (action: string, checked: boolean) => {
    if (checked) {
      setIntendedActions([...intendedActions, action]);
    } else {
      setIntendedActions(intendedActions.filter((a) => a !== action));
    }
  };

  return (
    <Flex vertical gap={12}>
      {ACTION_OPTIONS.map((opt) => (
        <Flex
          key={opt.key}
          align="flex-start"
          gap={12}
          style={{
            padding: 12,
            border: '1px solid #f0f0f0',
            borderRadius: 8,
            cursor: 'pointer',
          }}
          onClick={() => handleChange(opt.key, !intendedActions.includes(opt.key))}
        >
          <Checkbox
            checked={intendedActions.includes(opt.key)}
            onChange={(e) => handleChange(opt.key, e.target.checked)}
            onClick={(e) => e.stopPropagation()}
          />
          <Flex vertical gap={2}>
            <Text strong>{t(`objectType.actions.${opt.key}`, { name })}</Text>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {t(`objectType.actions.${opt.descKey}`)}
            </Text>
          </Flex>
        </Flex>
      ))}
    </Flex>
  );
}
