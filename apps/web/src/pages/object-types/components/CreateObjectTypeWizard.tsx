import { Button, Flex, Modal, Steps, message } from 'antd';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useCreateWizardStore } from '@/stores/create-wizard-store';
import { useCreateObjectType } from '@/api/object-types';
import WizardStepDatasource from './WizardStepDatasource';
import WizardStepMetadata from './WizardStepMetadata';
import WizardStepProperties from './WizardStepProperties';
import WizardStepActions from './WizardStepActions';
import WizardStepSaveLocation from './WizardStepSaveLocation';
import type { AxiosError } from 'axios';

interface ApiErrorResponse {
  error?: { code?: string; message?: string };
}

export default function CreateObjectTypeWizard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const {
    isOpen,
    currentStep,
    selectedDatasetRid,
    displayName,
    description,
    icon,
    objectTypeId,
    intendedActions,
    projectRid,
    nextStep,
    prevStep,
    close,
    reset,
  } = useCreateWizardStore();

  const createMutation = useCreateObjectType();

  const isNextDisabled = currentStep === 0 && !selectedDatasetRid;

  const handleClose = async () => {
    // Early exit: create incomplete OT with whatever data we have
    if (displayName && objectTypeId) {
      try {
        const result = await createMutation.mutateAsync({
          id: objectTypeId,
          apiName: displayName.replace(/[^a-zA-Z0-9]/g, ''),
          displayName,
          description: description || null,
          icon: icon ?? { name: 'AppstoreOutlined', color: '#1677ff' },
        });
        close();
        reset();
        navigate(`/object-types/${result.rid}`);
        return;
      } catch {
        // If creation fails, just close
      }
    }
    close();
    reset();
  };

  const handleCreate = async () => {
    if (!displayName || !objectTypeId) {
      message.warning(t('objectType.validation.displayNameRequired'));
      return;
    }
    try {
      const result = await createMutation.mutateAsync({
        id: objectTypeId,
        apiName: displayName.replace(/[^a-zA-Z0-9]/g, ''),
        displayName,
        description: description || null,
        icon: icon ?? { name: 'AppstoreOutlined', color: '#1677ff' },
      });
      message.success(t('objectType.createSuccess'));
      close();
      reset();
      navigate(`/object-types/${result.rid}`);
    } catch (err) {
      const axiosErr = err as AxiosError<ApiErrorResponse>;
      const serverMessage = axiosErr.response?.data?.error?.message;
      message.error(serverMessage ?? t('error.somethingWentWrong'));
    }
  };

  const handleNext = () => {
    if (currentStep < 4) {
      nextStep();
    }
  };

  const _ = { intendedActions, projectRid }; // referenced in create payload eventually

  return (
    <Modal
      title={t('wizard.title')}
      open={isOpen}
      onCancel={handleClose}
      width={800}
      destroyOnClose
      footer={
        <Flex justify="space-between">
          <Button onClick={handleClose}>{t('wizard.createLater')}</Button>
          <Flex gap={8}>
            {currentStep > 0 && (
              <Button onClick={prevStep}>{t('wizard.back')}</Button>
            )}
            {currentStep < 4 ? (
              <Button
                type="primary"
                onClick={handleNext}
                disabled={isNextDisabled}
              >
                {t('wizard.next')}
              </Button>
            ) : (
              <Button
                type="primary"
                onClick={handleCreate}
                loading={createMutation.isPending}
              >
                {t('wizard.create')}
              </Button>
            )}
          </Flex>
        </Flex>
      }
    >
      <Steps
        current={currentStep}
        size="small"
        style={{ marginBottom: 24 }}
        items={[
          { title: t('wizard.steps.datasource') },
          { title: t('wizard.steps.metadata') },
          { title: t('wizard.steps.properties') },
          { title: t('wizard.steps.actions') },
          { title: t('wizard.steps.saveLocation') },
        ]}
      />

      {currentStep === 0 && <WizardStepDatasource />}
      {currentStep === 1 && <WizardStepMetadata />}
      {currentStep === 2 && <WizardStepProperties />}
      {currentStep === 3 && <WizardStepActions />}
      {currentStep === 4 && <WizardStepSaveLocation />}
    </Modal>
  );
}
