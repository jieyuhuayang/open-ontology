import { useState, useEffect, useMemo } from 'react';
import { Modal, Steps, Card, Flex, Select, Form, Input, Radio, Typography, message } from 'antd';
import { useTranslation } from 'react-i18next';
import { useCreateLinkTypeModalStore } from '@/stores/create-link-type-modal-store';
import { useCreateLinkType } from '@/api/link-types';
import { useObjectTypes } from '@/api/object-types';
import type { Cardinality } from '@/api/types';
import type { AxiosError } from 'axios';

const { Text } = Typography;

interface ApiErrorResponse {
  error?: { code?: string; message?: string };
}

interface FormValues {
  id: string;
  sideADisplayName: string;
  sideAApiName: string;
  sideAVisibility: string;
  sideBDisplayName: string;
  sideBApiName: string;
  sideBVisibility: string;
  status: string;
}

const LINK_SIDE_API_NAME_PATTERN = /^[a-z][a-zA-Z0-9]{0,99}$/;

function toCamelCase(str: string): string {
  return str
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map((word, i) =>
      i === 0 ? word.toLowerCase() : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase(),
    )
    .join('');
}

const CARDINALITY_OPTIONS: { value: Cardinality; disabled?: boolean }[] = [
  { value: 'one-to-one' },
  { value: 'one-to-many' },
  { value: 'many-to-one' },
];

export default function CreateLinkTypeWizard() {
  const { t } = useTranslation();
  const { isOpen, prefilledSideA, close } = useCreateLinkTypeModalStore();
  const createMutation = useCreateLinkType();
  const { data: objectTypesData } = useObjectTypes(1, 100);
  const [form] = Form.useForm<FormValues>();

  const [currentStep, setCurrentStep] = useState(0);
  const [cardinality, setCardinality] = useState<Cardinality | null>(null);
  const [sideARid, setSideARid] = useState<string | undefined>(undefined);
  const [sideBRid, setSideBRid] = useState<string | undefined>(undefined);
  const [sameTypeError, setSameTypeError] = useState(false);

  const objectTypeOptions = useMemo(() => {
    if (!objectTypesData?.items) return [];
    return objectTypesData.items
      .filter((ot) => ot.changeState !== 'deleted')
      .map((ot) => ({
        value: ot.rid,
        label: ot.displayName,
      }));
  }, [objectTypesData?.items]);

  useEffect(() => {
    if (isOpen && prefilledSideA) {
      setSideARid(prefilledSideA);
    }
  }, [isOpen, prefilledSideA]);

  const handleClose = () => {
    setCurrentStep(0);
    setCardinality(null);
    setSideARid(undefined);
    setSideBRid(undefined);
    setSameTypeError(false);
    form.resetFields();
    close();
  };

  const handleNext = () => {
    if (currentStep === 0 && !cardinality) return;
    if (currentStep === 1) {
      if (!sideARid || !sideBRid) return;
      if (sideARid === sideBRid) {
        setSameTypeError(true);
        return;
      }
      setSameTypeError(false);
      // Auto-populate form defaults based on selected OTs
      const sideAOt = objectTypesData?.items.find((ot) => ot.rid === sideARid);
      const sideBOt = objectTypesData?.items.find((ot) => ot.rid === sideBRid);
      if (sideAOt && sideBOt) {
        const sideAName = sideBOt.displayName;
        const sideBName = sideAOt.displayName;
        form.setFieldsValue({
          sideADisplayName: sideAName,
          sideAApiName: toCamelCase(sideAName),
          sideBDisplayName: sideBName,
          sideBApiName: toCamelCase(sideBName),
          id: `${sideAOt.id}-${sideBOt.id}`,
          status: 'experimental',
          sideAVisibility: 'normal',
          sideBVisibility: 'normal',
        });
      }
    }
    setCurrentStep((s) => s + 1);
  };

  const handlePrev = () => {
    setCurrentStep((s) => s - 1);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const result = await createMutation.mutateAsync({
        id: values.id,
        sideA: {
          objectTypeRid: sideARid!,
          displayName: values.sideADisplayName,
          apiName: values.sideAApiName,
          visibility: values.sideAVisibility as 'prominent' | 'normal' | 'hidden',
        },
        sideB: {
          objectTypeRid: sideBRid!,
          displayName: values.sideBDisplayName,
          apiName: values.sideBApiName,
          visibility: values.sideBVisibility as 'prominent' | 'normal' | 'hidden',
        },
        cardinality: cardinality!,
        status: values.status as 'active' | 'experimental' | 'deprecated',
      });
      message.success(t('linkType.createSuccess'));
      handleClose();
      // Open the drawer for the new link type via URL
      const params = new URLSearchParams(window.location.search);
      params.set('selected', result.rid);
      window.history.replaceState(null, '', `${window.location.pathname}?${params.toString()}`);
      window.dispatchEvent(new PopStateEvent('popstate'));
    } catch (err) {
      const axiosErr = err as AxiosError<ApiErrorResponse>;
      const code = axiosErr.response?.data?.error?.code;
      if (code === 'LINK_TYPE_ID_CONFLICT') {
        form.setFields([{ name: 'id', errors: [t('linkType.validation.idConflict')] }]);
      } else if (code === 'LINK_TYPE_API_NAME_CONFLICT') {
        message.error(t('linkType.validation.apiNameConflict'));
      } else if (code === 'LINK_TYPE_SELF_LINK_NOT_ALLOWED') {
        message.error(t('linkType.validation.selfLinkNotAllowed'));
      } else if (code) {
        const serverMessage = axiosErr.response?.data?.error?.message;
        message.error(serverMessage ?? t('error.somethingWentWrong'));
      }
    }
  };

  const handleSideAChange = (val: string) => {
    setSideARid(val);
    if (val === sideBRid) {
      setSameTypeError(true);
    } else {
      setSameTypeError(false);
    }
  };

  const handleSideBChange = (val: string) => {
    setSideBRid(val);
    if (val === sideARid) {
      setSameTypeError(true);
    } else {
      setSameTypeError(false);
    }
  };

  const isNextDisabled =
    (currentStep === 0 && !cardinality) || (currentStep === 1 && (!sideARid || !sideBRid));

  return (
    <Modal
      title={t('linkType.createTitle')}
      open={isOpen}
      onCancel={handleClose}
      okText={currentStep === 2 ? t('common.create') : t('linkType.wizard.next')}
      cancelText={currentStep === 0 ? t('common.cancel') : t('linkType.wizard.back')}
      onOk={currentStep === 2 ? handleSubmit : handleNext}
      okButtonProps={{ disabled: isNextDisabled }}
      cancelButtonProps={currentStep === 0 ? undefined : { onClick: handlePrev }}
      confirmLoading={createMutation.isPending}
      destroyOnClose
      width={640}
    >
      <Steps
        current={currentStep}
        size="small"
        style={{ marginBottom: 24 }}
        items={[
          { title: t('linkType.wizard.step1') },
          { title: t('linkType.wizard.step2') },
          { title: t('linkType.wizard.step3') },
        ]}
      />

      {currentStep === 0 && (
        <Flex gap={12}>
          {CARDINALITY_OPTIONS.map((opt) => (
            <Card
              key={opt.value}
              hoverable={!opt.disabled}
              style={{
                flex: 1,
                cursor: opt.disabled ? 'not-allowed' : 'pointer',
                opacity: opt.disabled ? 0.5 : 1,
                border: cardinality === opt.value ? '2px solid #1677ff' : undefined,
              }}
              onClick={() => !opt.disabled && setCardinality(opt.value)}
            >
              <Flex vertical align="center" gap={4}>
                <Text strong>{t(`linkType.cardinality.${opt.value}`)}</Text>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {t(`linkType.cardinalityDesc.${opt.value}`)}
                </Text>
              </Flex>
            </Card>
          ))}
        </Flex>
      )}

      {currentStep === 1 && (
        <Flex vertical gap={16}>
          <div>
            <Text strong>{t('linkType.wizard.sideA')}</Text>
            <Select
              showSearch
              filterOption={(input, option) =>
                (option?.label as string)?.toLowerCase().includes(input.toLowerCase())
              }
              placeholder={t('linkType.wizard.selectObjectType')}
              value={sideARid}
              onChange={handleSideAChange}
              options={objectTypeOptions}
              style={{ width: '100%', marginTop: 8 }}
              disabled={!!prefilledSideA}
            />
          </div>
          <div>
            <Text strong>{t('linkType.wizard.sideB')}</Text>
            <Select
              showSearch
              filterOption={(input, option) =>
                (option?.label as string)?.toLowerCase().includes(input.toLowerCase())
              }
              placeholder={t('linkType.wizard.selectObjectType')}
              value={sideBRid}
              onChange={handleSideBChange}
              options={objectTypeOptions}
              style={{ width: '100%', marginTop: 8 }}
            />
          </div>
          {sameTypeError && (
            <Text type="danger">{t('linkType.validation.selfLinkNotAllowed')}</Text>
          )}
        </Flex>
      )}

      {currentStep === 2 && (
        <Form form={form} layout="vertical">
          <Form.Item
            name="id"
            label={t('linkType.fields.id')}
            rules={[
              { required: true, message: t('linkType.validation.required') },
              {
                pattern: /^[a-z][a-z0-9-]*$/,
                message: t('linkType.validation.idFormat'),
              },
            ]}
          >
            <Input placeholder="e.g. employee-company" />
          </Form.Item>

          <Text strong style={{ display: 'block', marginBottom: 8 }}>
            {t('linkType.wizard.sideA')}
          </Text>
          <Flex gap={12}>
            <Form.Item
              name="sideADisplayName"
              label={t('linkType.fields.displayName')}
              rules={[{ required: true, message: t('linkType.validation.required') }]}
              style={{ flex: 1 }}
            >
              <Input />
            </Form.Item>
            <Form.Item
              name="sideAApiName"
              label={t('linkType.fields.apiName')}
              rules={[
                { required: true, message: t('linkType.validation.required') },
                {
                  pattern: LINK_SIDE_API_NAME_PATTERN,
                  message: t('linkType.validation.apiNameFormat'),
                },
              ]}
              style={{ flex: 1 }}
            >
              <Input placeholder="e.g. employer" />
            </Form.Item>
          </Flex>
          <Form.Item name="sideAVisibility" label={t('linkType.fields.visibility')}>
            <Radio.Group>
              <Radio value="prominent">{t('objectType.visibility.prominent')}</Radio>
              <Radio value="normal">{t('objectType.visibility.normal')}</Radio>
              <Radio value="hidden">{t('objectType.visibility.hidden')}</Radio>
            </Radio.Group>
          </Form.Item>

          <Text strong style={{ display: 'block', marginBottom: 8 }}>
            {t('linkType.wizard.sideB')}
          </Text>
          <Flex gap={12}>
            <Form.Item
              name="sideBDisplayName"
              label={t('linkType.fields.displayName')}
              rules={[{ required: true, message: t('linkType.validation.required') }]}
              style={{ flex: 1 }}
            >
              <Input />
            </Form.Item>
            <Form.Item
              name="sideBApiName"
              label={t('linkType.fields.apiName')}
              rules={[
                { required: true, message: t('linkType.validation.required') },
                {
                  pattern: LINK_SIDE_API_NAME_PATTERN,
                  message: t('linkType.validation.apiNameFormat'),
                },
              ]}
              style={{ flex: 1 }}
            >
              <Input placeholder="e.g. employee" />
            </Form.Item>
          </Flex>
          <Form.Item name="sideBVisibility" label={t('linkType.fields.visibility')}>
            <Radio.Group>
              <Radio value="prominent">{t('objectType.visibility.prominent')}</Radio>
              <Radio value="normal">{t('objectType.visibility.normal')}</Radio>
              <Radio value="hidden">{t('objectType.visibility.hidden')}</Radio>
            </Radio.Group>
          </Form.Item>

          <Form.Item name="status" label={t('linkType.fields.status')}>
            <Radio.Group>
              <Radio value="experimental">{t('objectType.status.experimental')}</Radio>
              <Radio value="active">{t('objectType.status.active')}</Radio>
              <Radio value="deprecated">{t('objectType.status.deprecated')}</Radio>
            </Radio.Group>
          </Form.Item>
        </Form>
      )}
    </Modal>
  );
}
