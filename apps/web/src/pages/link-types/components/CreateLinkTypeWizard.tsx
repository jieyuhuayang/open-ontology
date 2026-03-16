import { useState, useEffect, useMemo } from 'react';
import {
  Modal,
  Steps,
  Card,
  Flex,
  Select,
  Form,
  Input,
  Radio,
  Typography,
  message,
  Divider,
} from 'antd';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useCreateLinkTypeModalStore } from '@/stores/create-link-type-modal-store';
import { useCreateLinkType } from '@/api/link-types';
import { useObjectTypes } from '@/api/object-types';
import { useDatasets, useDataset } from '@/api/datasets';
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

interface CardinalityOption {
  value: Cardinality;
  group: 'fk' | 'jt' | 'bo';
  disabled?: boolean;
}

const CARDINALITY_OPTIONS: CardinalityOption[] = [
  { value: 'one-to-one', group: 'fk' },
  { value: 'one-to-many', group: 'fk' },
  { value: 'many-to-one', group: 'fk' },
  { value: 'many-to-many', group: 'jt' },
];

export default function CreateLinkTypeWizard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isOpen, prefilledSideA, close } = useCreateLinkTypeModalStore();
  const createMutation = useCreateLinkType();
  const { data: objectTypesData } = useObjectTypes(1, 100);
  const { data: datasetsData } = useDatasets();
  const [form] = Form.useForm<FormValues>();

  const [currentStep, setCurrentStep] = useState(0);
  const [cardinality, setCardinality] = useState<Cardinality | null>(null);
  const [sideARid, setSideARid] = useState<string | undefined>(undefined);
  const [sideBRid, setSideBRid] = useState<string | undefined>(undefined);
  const [joinTableDatasetRid, setJoinTableDatasetRid] = useState<string | undefined>(undefined);
  const [sideAJtColumn, setSideAJtColumn] = useState<string | undefined>(undefined);
  const [sideBJtColumn, setSideBJtColumn] = useState<string | undefined>(undefined);
  const [sideAFkPropId, setSideAFkPropId] = useState<string | undefined>(undefined);

  const isJoinTable = cardinality === 'many-to-many';

  // Load dataset columns when a JT dataset is selected
  const { data: selectedDataset } = useDataset(joinTableDatasetRid ?? '');

  const objectTypeOptions = useMemo(() => {
    if (!objectTypesData?.items) return [];
    return objectTypesData.items
      .filter((ot) => ot.changeState !== 'deleted')
      .map((ot) => ({
        value: ot.rid,
        label: ot.displayName,
      }));
  }, [objectTypesData?.items]);

  const datasetOptions = useMemo(() => {
    if (!datasetsData?.items) return [];
    return datasetsData.items.map((ds) => ({
      value: ds.rid,
      label: ds.name,
    }));
  }, [datasetsData?.items]);

  const datasetColumnOptions = useMemo(() => {
    if (!selectedDataset?.columns) return [];
    return selectedDataset.columns.map((col) => ({
      value: col.name,
      label: `${col.name} (${col.inferredType})`,
    }));
  }, [selectedDataset?.columns]);

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
    setJoinTableDatasetRid(undefined);
    setSideAJtColumn(undefined);
    setSideBJtColumn(undefined);
    setSideAFkPropId(undefined);
    form.resetFields();
    close();
  };

  const handleNext = () => {
    if (currentStep === 0 && !cardinality) return;
    if (currentStep === 1) {
      if (!sideARid || !sideBRid) return;
      if (isJoinTable && !joinTableDatasetRid) return;

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
          ...(sideAFkPropId ? { foreignKeyPropertyId: sideAFkPropId } : {}),
          ...(sideAJtColumn ? { joinTableColumn: sideAJtColumn } : {}),
        },
        sideB: {
          objectTypeRid: sideBRid!,
          displayName: values.sideBDisplayName,
          apiName: values.sideBApiName,
          visibility: values.sideBVisibility as 'prominent' | 'normal' | 'hidden',
          ...(sideBJtColumn ? { joinTableColumn: sideBJtColumn } : {}),
        },
        cardinality: cardinality!,
        ...(isJoinTable && joinTableDatasetRid
          ? { joinTableDatasetRid: joinTableDatasetRid }
          : {}),
        status: values.status as 'active' | 'experimental' | 'deprecated',
      });
      message.success(t('linkType.createSuccess'));
      handleClose();
      navigate(`/link-types/${result.rid}`);
    } catch (err) {
      const axiosErr = err as AxiosError<ApiErrorResponse>;
      const code = axiosErr.response?.data?.error?.code;
      if (code === 'LINK_TYPE_ID_CONFLICT') {
        form.setFields([{ name: 'id', errors: [t('linkType.validation.idConflict')] }]);
      } else if (code === 'LINK_TYPE_API_NAME_CONFLICT') {
        message.error(t('linkType.validation.apiNameConflict'));
      } else if (code === 'LINK_TYPE_JOIN_TABLE_REQUIRED') {
        message.error(t('linkType.validation.joinTableRequired'));
      } else if (code) {
        const serverMessage = axiosErr.response?.data?.error?.message;
        message.error(serverMessage ?? t('error.somethingWentWrong'));
      }
    }
  };

  const totalSteps = 3; // Step 0: Cardinality, Step 1: Resources, Step 2: Details
  const isNextDisabled =
    (currentStep === 0 && !cardinality) ||
    (currentStep === 1 &&
      (!sideARid || !sideBRid || (isJoinTable && !joinTableDatasetRid)));

  const fkOptions = CARDINALITY_OPTIONS.filter((o) => o.group === 'fk');
  const jtOptions = CARDINALITY_OPTIONS.filter((o) => o.group === 'jt');

  return (
    <Modal
      title={t('linkType.createTitle')}
      open={isOpen}
      onCancel={handleClose}
      okText={currentStep === totalSteps - 1 ? t('common.create') : t('linkType.wizard.next')}
      cancelText={currentStep === 0 ? t('common.cancel') : t('linkType.wizard.back')}
      onOk={currentStep === totalSteps - 1 ? handleSubmit : handleNext}
      okButtonProps={{ disabled: isNextDisabled }}
      cancelButtonProps={currentStep === 0 ? undefined : { onClick: handlePrev }}
      confirmLoading={createMutation.isPending}
      destroyOnClose
      width={720}
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

      {/* Step 0: Cardinality & Join Method */}
      {currentStep === 0 && (
        <Flex vertical gap={16}>
          <div>
            <Text strong style={{ display: 'block', marginBottom: 8 }}>
              {t('linkType.wizard.fkGroup')}
            </Text>
            <Flex gap={12}>
              {fkOptions.map((opt) => (
                <Card
                  key={opt.value}
                  hoverable
                  style={{
                    flex: 1,
                    cursor: 'pointer',
                    border: cardinality === opt.value ? '2px solid #1677ff' : undefined,
                  }}
                  onClick={() => setCardinality(opt.value)}
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
          </div>

          <div>
            <Text strong style={{ display: 'block', marginBottom: 8 }}>
              {t('linkType.wizard.jtGroup')}
            </Text>
            <Flex gap={12}>
              {jtOptions.map((opt) => (
                <Card
                  key={opt.value}
                  hoverable
                  style={{
                    flex: 1,
                    cursor: 'pointer',
                    border: cardinality === opt.value ? '2px solid #1677ff' : undefined,
                  }}
                  onClick={() => setCardinality(opt.value)}
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
          </div>
        </Flex>
      )}

      {/* Step 1: Object Types + FK/JT Config */}
      {currentStep === 1 && (
        <Flex vertical gap={16}>
          <Flex gap={16}>
            <div style={{ flex: 1 }}>
              <Text strong>{t('linkType.wizard.sideA')}</Text>
              <Select
                showSearch
                filterOption={(input, option) =>
                  (option?.label as string)?.toLowerCase().includes(input.toLowerCase())
                }
                placeholder={t('linkType.wizard.selectObjectType')}
                value={sideARid}
                onChange={setSideARid}
                options={objectTypeOptions}
                style={{ width: '100%', marginTop: 8 }}
                disabled={!!prefilledSideA}
              />
            </div>
            <div style={{ flex: 1 }}>
              <Text strong>{t('linkType.wizard.sideB')}</Text>
              <Select
                showSearch
                filterOption={(input, option) =>
                  (option?.label as string)?.toLowerCase().includes(input.toLowerCase())
                }
                placeholder={t('linkType.wizard.selectObjectType')}
                value={sideBRid}
                onChange={setSideBRid}
                options={objectTypeOptions}
                style={{ width: '100%', marginTop: 8 }}
              />
            </div>
          </Flex>

          {isJoinTable && (
            <>
              <Divider style={{ margin: '8px 0' }} />
              <div>
                <Text strong>{t('linkType.wizard.selectDataset')}</Text>
                <Select
                  showSearch
                  filterOption={(input, option) =>
                    (option?.label as string)?.toLowerCase().includes(input.toLowerCase())
                  }
                  placeholder={t('linkType.wizard.selectDataset')}
                  value={joinTableDatasetRid}
                  onChange={(val) => {
                    setJoinTableDatasetRid(val);
                    setSideAJtColumn(undefined);
                    setSideBJtColumn(undefined);
                  }}
                  options={datasetOptions}
                  style={{ width: '100%', marginTop: 8 }}
                />
              </div>
              {joinTableDatasetRid && datasetColumnOptions.length > 0 && (
                <Flex gap={16}>
                  <div style={{ flex: 1 }}>
                    <Text type="secondary">{t('linkType.wizard.sideA')} → {t('linkType.detail.jtColumn')}</Text>
                    <Select
                      placeholder={t('linkType.wizard.columnMapping')}
                      value={sideAJtColumn}
                      onChange={setSideAJtColumn}
                      options={datasetColumnOptions}
                      style={{ width: '100%', marginTop: 4 }}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <Text type="secondary">{t('linkType.wizard.sideB')} → {t('linkType.detail.jtColumn')}</Text>
                    <Select
                      placeholder={t('linkType.wizard.columnMapping')}
                      value={sideBJtColumn}
                      onChange={setSideBJtColumn}
                      options={datasetColumnOptions}
                      style={{ width: '100%', marginTop: 4 }}
                    />
                  </div>
                </Flex>
              )}
            </>
          )}
        </Flex>
      )}

      {/* Step 2: Details (Names, API Names, Status) */}
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
