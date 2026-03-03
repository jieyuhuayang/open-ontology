import { useState } from 'react';
import { Button, Flex, Modal, Steps, message } from 'antd';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useCreateWizardStore } from '@/stores/create-wizard-store';
import { useCreateObjectType } from '@/api/object-types';
import { createPropertyDirect, updatePropertyDirect } from '@/api/properties';
import { toKebabCase, toCamelCase } from '@/utils/naming';
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
    properties,
    intendedActions,
    projectRid,
    nextStep,
    prevStep,
    close,
    reset,
  } = useCreateWizardStore();

  const createMutation = useCreateObjectType();
  const [isCreating, setIsCreating] = useState(false);

  const isNextDisabled = currentStep === 0 && !selectedDatasetRid;

  const buildCreateRequest = () => ({
    displayName,
    pluralDisplayName: pluralDisplayName || null,
    description: description || null,
    icon: icon ?? { name: 'AppstoreOutlined', color: '#1677ff' },
    backingDatasourceRid: selectedDatasetRid ?? null,
    intendedActions: intendedActions.length > 0 ? intendedActions : null,
    projectRid: projectRid || null,
  });

  const createPropertiesForObjectType = async (objectTypeRid: string) => {
    for (const prop of properties) {
      const id = toKebabCase(prop.displayName);
      const apiName = toCamelCase(prop.displayName);
      const created = await createPropertyDirect(objectTypeRid, {
        id,
        apiName,
        displayName: prop.displayName,
        baseType: prop.baseType,
        backingColumn: prop.columnName ?? null,
        status: 'experimental',
        visibility: 'normal',
      });

      if (prop.isPrimaryKey) {
        await updatePropertyDirect(objectTypeRid, created.rid, {
          isPrimaryKey: true,
        });
      }
      if (prop.isTitleKey) {
        await updatePropertyDirect(objectTypeRid, created.rid, {
          isTitleKey: true,
        });
      }
    }
  };

  const handleClose = async () => {
    if (displayName) {
      try {
        setIsCreating(true);
        const result = await createMutation.mutateAsync(buildCreateRequest());
        if (properties.length > 0) {
          await createPropertiesForObjectType(result.rid);
        }
        close();
        reset();
        navigate(`/object-types/${result.rid}`);
        return;
      } catch {
        // If creation fails, just close
      } finally {
        setIsCreating(false);
      }
    }
    close();
    reset();
  };

  const handleCreate = async () => {
    if (!displayName) {
      message.warning(t('objectType.validation.displayNameRequired'));
      return;
    }
    try {
      setIsCreating(true);
      const result = await createMutation.mutateAsync(buildCreateRequest());

      if (properties.length > 0) {
        await createPropertiesForObjectType(result.rid);
      }

      message.success(t('objectType.createSuccess'));
      close();
      reset();
      navigate(`/object-types/${result.rid}`);
    } catch (err) {
      const axiosErr = err as AxiosError<ApiErrorResponse>;
      const serverMessage = axiosErr.response?.data?.error?.message;
      message.error(serverMessage ?? t('error.somethingWentWrong'));
    } finally {
      setIsCreating(false);
    }
  };

  const handleNext = () => {
    if (currentStep < 4) {
      nextStep();
    }
  };

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
                loading={isCreating}
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
