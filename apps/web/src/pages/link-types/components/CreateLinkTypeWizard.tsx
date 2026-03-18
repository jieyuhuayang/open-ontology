import { useState, useEffect, useMemo, useCallback } from 'react';
import { Modal, Steps, Flex, Select, Form, Input, Radio, Typography, message, Divider, Alert, Card } from 'antd';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useCreateLinkTypeModalStore } from '@/stores/create-link-type-modal-store';
import { useCreateLinkType, useEligibleSideLinks } from '@/api/link-types';
import { useObjectTypes } from '@/api/object-types';
import { useProperties } from '@/api/properties';
import { useDatasets, useDataset } from '@/api/datasets';
import { toCamelCase } from '@/utils/naming';
import type { Cardinality } from '@/api/types';
import type { AxiosError } from 'axios';
import RelationshipCard from './RelationshipCard';
import NNSubSelector from './NNSubSelector';

const { Text } = Typography;

interface ApiErrorResponse {
  error?: { code?: string; message?: string };
}

interface FormValues {
  id: string;
  sideADisplayName: string;
  sideAApiName: string;
  sideBDisplayName: string;
  sideBApiName: string;
  status: string;
}

const LINK_SIDE_API_NAME_PATTERN = /^[a-z][a-zA-Z0-9]{0,99}$/;

const CARDINALITY_CHOICES: Cardinality[] = ['one-to-one', 'one-to-many', 'many-to-one', 'many-to-many'];

const CARDINALITY_HELP_KEYS: Record<Cardinality, string> = {
  'one-to-one': 'oneToOne',
  'one-to-many': 'oneToMany',
  'many-to-one': 'manyToOne',
  'many-to-many': 'manyToMany',
};

const CARDINALITY_DIAGRAM_TYPES: Record<Cardinality, 'one-to-one' | 'one-to-many' | 'many-to-one' | 'many-to-many'> = {
  'one-to-one': 'one-to-one',
  'one-to-many': 'one-to-many',
  'many-to-one': 'many-to-one',
  'many-to-many': 'many-to-many',
};

/** Determine which side holds the FK for FK-based cardinalities */
function getFkSide(cardinality: Cardinality | null): 'A' | 'B' | null {
  if (cardinality === 'one-to-one' || cardinality === 'many-to-one') return 'A';
  if (cardinality === 'one-to-many') return 'B';
  return null;
}

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
  const [isBackingObject, setIsBackingObject] = useState(false);
  const [sideARid, setSideARid] = useState<string | undefined>(undefined);
  const [sideBRid, setSideBRid] = useState<string | undefined>(undefined);
  const [joinTableDatasetRid, setJoinTableDatasetRid] = useState<string | undefined>(undefined);
  const [sideAJtColumn, setSideAJtColumn] = useState<string | undefined>(undefined);
  const [sideBJtColumn, setSideBJtColumn] = useState<string | undefined>(undefined);
  const [fkPropId, setFkPropId] = useState<string | undefined>(undefined);

  // Track whether user manually edited API names
  const [sideAApiNameManual, setSideAApiNameManual] = useState(false);
  const [sideBApiNameManual, setSideBApiNameManual] = useState(false);

  // BO-specific state
  const [backingOtRid, setBackingOtRid] = useState<string | undefined>(undefined);
  const [sideALinkRid, setSideALinkRid] = useState<string | undefined>(undefined);
  const [sideBLinkRid, setSideBLinkRid] = useState<string | undefined>(undefined);

  const isJoinTable = cardinality === 'many-to-many' && !isBackingObject;
  const fkSide = getFkSide(cardinality);
  const isFkBased = fkSide !== null;
  const fkOtRid = fkSide === 'A' ? sideARid : fkSide === 'B' ? sideBRid : undefined;

  // Load FK-side properties
  const { data: fkPropertiesData } = useProperties(fkOtRid ?? '');

  // Load dataset columns when a JT dataset is selected
  const { data: selectedDataset } = useDataset(joinTableDatasetRid ?? '');

  // Load eligible side links for BO mode
  const { data: sideALinks } = useEligibleSideLinks(sideARid, backingOtRid);
  const { data: sideBLinks } = useEligibleSideLinks(sideBRid, backingOtRid);

  // Auto-select when only one link is available
  useEffect(() => {
    if (sideALinks && sideALinks.length === 1) {
      setSideALinkRid(sideALinks[0]?.rid);
    }
  }, [sideALinks]);

  useEffect(() => {
    if (sideBLinks && sideBLinks.length === 1) {
      setSideBLinkRid(sideBLinks[0]?.rid);
    }
  }, [sideBLinks]);

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

  const fkPropertyOptions = useMemo(() => {
    if (!fkPropertiesData?.items) return [];
    return fkPropertiesData.items.map((p) => ({
      value: p.rid,
      label: `${p.displayName} (${p.apiName})`,
    }));
  }, [fkPropertiesData?.items]);

  // Resolve OT display names
  const sideAOt = useMemo(
    () => objectTypesData?.items.find((ot) => ot.rid === sideARid),
    [objectTypesData?.items, sideARid],
  );
  const sideBOt = useMemo(
    () => objectTypesData?.items.find((ot) => ot.rid === sideBRid),
    [objectTypesData?.items, sideBRid],
  );
  const fkOtName = fkSide === 'A' ? sideAOt?.displayName : sideBOt?.displayName;

  useEffect(() => {
    if (isOpen && prefilledSideA) {
      setSideARid(prefilledSideA);
    }
  }, [isOpen, prefilledSideA]);

  const handleClose = () => {
    setCurrentStep(0);
    setCardinality(null);
    setIsBackingObject(false);
    setSideARid(undefined);
    setSideBRid(undefined);
    setJoinTableDatasetRid(undefined);
    setSideAJtColumn(undefined);
    setSideBJtColumn(undefined);
    setFkPropId(undefined);
    setSideAApiNameManual(false);
    setSideBApiNameManual(false);
    setBackingOtRid(undefined);
    setSideALinkRid(undefined);
    setSideBLinkRid(undefined);
    form.resetFields();
    close();
  };

  const handleNext = () => {
    if (currentStep === 0 && !cardinality) return;
    if (currentStep === 1) {
      if (!sideARid || !sideBRid) return;
      if (isJoinTable && !joinTableDatasetRid) return;
      if (isBackingObject && (!backingOtRid || !sideALinkRid || !sideBLinkRid)) return;

      // Auto-populate form defaults based on selected OTs
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
        });
        setSideAApiNameManual(false);
        setSideBApiNameManual(false);
      }
    }
    setCurrentStep((s) => s + 1);
  };

  const handlePrev = () => {
    setCurrentStep((s) => s - 1);
  };

  // Auto-generate API name when display name changes (unless manually edited)
  const handleSideADisplayNameChange = useCallback(
    (value: string) => {
      form.setFieldValue('sideADisplayName', value);
      if (!sideAApiNameManual) {
        form.setFieldValue('sideAApiName', toCamelCase(value));
      }
    },
    [form, sideAApiNameManual],
  );

  const handleSideBDisplayNameChange = useCallback(
    (value: string) => {
      form.setFieldValue('sideBDisplayName', value);
      if (!sideBApiNameManual) {
        form.setFieldValue('sideBApiName', toCamelCase(value));
      }
    },
    [form, sideBApiNameManual],
  );

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const result = await createMutation.mutateAsync({
        id: values.id,
        sideA: {
          objectTypeRid: sideARid!,
          displayName: values.sideADisplayName,
          apiName: values.sideAApiName,
          visibility: 'normal',
          ...(isFkBased && fkSide === 'A' && fkPropId ? { foreignKeyPropertyId: fkPropId } : {}),
          ...(sideAJtColumn ? { joinTableColumn: sideAJtColumn } : {}),
        },
        sideB: {
          objectTypeRid: sideBRid!,
          displayName: values.sideBDisplayName,
          apiName: values.sideBApiName,
          visibility: 'normal',
          ...(isFkBased && fkSide === 'B' && fkPropId ? { foreignKeyPropertyId: fkPropId } : {}),
          ...(sideBJtColumn ? { joinTableColumn: sideBJtColumn } : {}),
        },
        cardinality: cardinality!,
        ...(isJoinTable && joinTableDatasetRid
          ? { joinTableDatasetRid: joinTableDatasetRid }
          : {}),
        ...(isBackingObject
          ? {
              backingObjectTypeRid: backingOtRid,
              sideALinkTypeRid: sideALinkRid,
              sideBLinkTypeRid: sideBLinkRid,
            }
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
      } else if (
        code === 'LINK_TYPE_SIDE_LINK_NOT_FOUND' ||
        code === 'LINK_TYPE_SIDE_LINK_INVALID' ||
        code === 'LINK_TYPE_BACKING_OT_NOT_FOUND' ||
        code === 'LINK_TYPE_BACKING_OT_REQUIRED'
      ) {
        const serverMessage = axiosErr.response?.data?.error?.message;
        message.error(serverMessage ?? t('linkType.bo.validationError'));
      } else if (code) {
        const serverMessage = axiosErr.response?.data?.error?.message;
        message.error(serverMessage ?? t('error.somethingWentWrong'));
      }
    }
  };

  const totalSteps = 3;
  const isNextDisabled =
    (currentStep === 0 && !cardinality) ||
    (currentStep === 1 &&
      (!sideARid ||
        !sideBRid ||
        (isJoinTable && !joinTableDatasetRid) ||
        (isBackingObject && (!backingOtRid || !sideALinkRid || !sideBLinkRid))));

  const handleCardinalitySelect = (value: Cardinality) => {
    setCardinality(value);
    setFkPropId(undefined);
    if (value !== 'many-to-many') {
      setIsBackingObject(false);
      setBackingOtRid(undefined);
      setSideALinkRid(undefined);
      setSideBLinkRid(undefined);
      setJoinTableDatasetRid(undefined);
      setSideAJtColumn(undefined);
      setSideBJtColumn(undefined);
    }
  };

  const handleNNSubChange = (bo: boolean) => {
    setIsBackingObject(bo);
    if (bo) {
      setJoinTableDatasetRid(undefined);
      setSideAJtColumn(undefined);
      setSideBJtColumn(undefined);
    } else {
      setBackingOtRid(undefined);
      setSideALinkRid(undefined);
      setSideBLinkRid(undefined);
    }
  };

  const sideALinkOptions = useMemo(() => {
    return (sideALinks ?? []).map((l) => ({
      value: l.rid,
      label: `${l.id} (${l.sideADisplayName} → ${l.sideBDisplayName})`,
    }));
  }, [sideALinks]);

  const sideBLinkOptions = useMemo(() => {
    return (sideBLinks ?? []).map((l) => ({
      value: l.rid,
      label: `${l.id} (${l.sideADisplayName} → ${l.sideBDisplayName})`,
    }));
  }, [sideBLinks]);

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

      {/* Step 0: Relationship Type Selection */}
      {currentStep === 0 && (
        <Flex vertical gap={8}>
          <Text type="secondary" style={{ marginBottom: 4 }}>
            {t('linkType.wizard.selectRelationType')}
          </Text>
          <Flex gap={12}>
            {CARDINALITY_CHOICES.map((c) => (
              <RelationshipCard
                key={c}
                diagramType={CARDINALITY_DIAGRAM_TYPES[c]}
                title={t(`linkType.cardinality.${c}`)}
                description={t(`linkType.relationCard.${CARDINALITY_HELP_KEYS[c]}.desc`)}
                example={t(`linkType.relationCard.${CARDINALITY_HELP_KEYS[c]}.example`)}
                helpKey={CARDINALITY_HELP_KEYS[c]}
                selected={cardinality === c}
                onClick={() => handleCardinalitySelect(c)}
              />
            ))}
          </Flex>
          <NNSubSelector
            visible={cardinality === 'many-to-many'}
            isBackingObject={isBackingObject}
            onChange={handleNNSubChange}
          />
        </Flex>
      )}

      {/* Step 1: Object Types + FK/JT/BO Config */}
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
                onChange={(val) => {
                  setSideARid(val);
                  setSideALinkRid(undefined);
                  if (fkSide === 'A') setFkPropId(undefined);
                }}
                options={objectTypeOptions}
                style={{ width: '100%', marginTop: 8 }}
                disabled={!!prefilledSideA}
              />
            </div>
            {isBackingObject && (
              <div style={{ flex: 1 }}>
                <Text strong>{t('linkType.bo.backingOt')}</Text>
                <Select
                  showSearch
                  filterOption={(input, option) =>
                    (option?.label as string)?.toLowerCase().includes(input.toLowerCase())
                  }
                  placeholder={t('linkType.bo.selectBackingOt')}
                  value={backingOtRid}
                  onChange={(val) => {
                    setBackingOtRid(val);
                    setSideALinkRid(undefined);
                    setSideBLinkRid(undefined);
                  }}
                  options={objectTypeOptions}
                  style={{ width: '100%', marginTop: 8 }}
                />
              </div>
            )}
            <div style={{ flex: 1 }}>
              <Text strong>{t('linkType.wizard.sideB')}</Text>
              <Select
                showSearch
                filterOption={(input, option) =>
                  (option?.label as string)?.toLowerCase().includes(input.toLowerCase())
                }
                placeholder={t('linkType.wizard.selectObjectType')}
                value={sideBRid}
                onChange={(val) => {
                  setSideBRid(val);
                  setSideBLinkRid(undefined);
                  if (fkSide === 'B') setFkPropId(undefined);
                }}
                options={objectTypeOptions}
                style={{ width: '100%', marginTop: 8 }}
              />
            </div>
          </Flex>

          {/* FK Property Selector (for FK-based cardinalities) */}
          {isFkBased && fkOtRid && sideARid && sideBRid && (
            <>
              <Divider style={{ margin: '8px 0' }} />
              <div>
                <Text type="secondary">
                  {t('linkType.wizard.fkPropertyOn', { objectType: fkOtName })}
                </Text>
                <Select
                  allowClear
                  showSearch
                  filterOption={(input, option) =>
                    (option?.label as string)?.toLowerCase().includes(input.toLowerCase())
                  }
                  placeholder={t('linkType.wizard.selectFkProperty')}
                  value={fkPropId}
                  onChange={setFkPropId}
                  options={fkPropertyOptions}
                  style={{ width: '100%', marginTop: 8 }}
                />
                <Text type="secondary" style={{ fontSize: 12, marginTop: 4, display: 'block' }}>
                  {t('linkType.wizard.fkPropertyOptional')}
                </Text>
              </div>
            </>
          )}

          {isBackingObject && backingOtRid && sideARid && sideBRid && (
            <>
              <Divider style={{ margin: '8px 0' }} />
              <Flex gap={16}>
                <div style={{ flex: 1 }}>
                  <Text type="secondary">
                    {t('linkType.wizard.sideA')} → {t('linkType.bo.backingOt')}
                  </Text>
                  {sideALinks && sideALinks.length === 0 ? (
                    <Alert
                      type="warning"
                      showIcon
                      message={t('linkType.bo.noSideLink', {
                        side: t('linkType.wizard.sideA'),
                      })}
                      style={{ marginTop: 8 }}
                    />
                  ) : (
                    <Select
                      placeholder={t('linkType.bo.selectSideLink')}
                      value={sideALinkRid}
                      onChange={setSideALinkRid}
                      options={sideALinkOptions}
                      style={{ width: '100%', marginTop: 4 }}
                    />
                  )}
                </div>
                <div style={{ flex: 1 }}>
                  <Text type="secondary">
                    {t('linkType.wizard.sideB')} → {t('linkType.bo.backingOt')}
                  </Text>
                  {sideBLinks && sideBLinks.length === 0 ? (
                    <Alert
                      type="warning"
                      showIcon
                      message={t('linkType.bo.noSideLink', {
                        side: t('linkType.wizard.sideB'),
                      })}
                      style={{ marginTop: 8 }}
                    />
                  ) : (
                    <Select
                      placeholder={t('linkType.bo.selectSideLink')}
                      value={sideBLinkRid}
                      onChange={setSideBLinkRid}
                      options={sideBLinkOptions}
                      style={{ width: '100%', marginTop: 4 }}
                    />
                  )}
                </div>
              </Flex>
            </>
          )}

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
                    <Text type="secondary">
                      {t('linkType.wizard.sideA')} → {t('linkType.detail.jtColumn')}
                    </Text>
                    <Select
                      placeholder={t('linkType.wizard.columnMapping')}
                      value={sideAJtColumn}
                      onChange={setSideAJtColumn}
                      options={datasetColumnOptions}
                      style={{ width: '100%', marginTop: 4 }}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <Text type="secondary">
                      {t('linkType.wizard.sideB')} → {t('linkType.detail.jtColumn')}
                    </Text>
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

      {/* Step 2: Card-style Link Names */}
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

          {/* Direction card: A → B */}
          <Card
            size="small"
            title={t('linkType.wizard.directionTitle', {
              source: sideAOt?.displayName ?? '',
              target: sideBOt?.displayName ?? '',
            })}
            style={{ marginBottom: 16 }}
          >
            <Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
              {t('linkType.wizard.linkNameGuide', {
                source: sideAOt?.displayName ?? '',
                target: sideBOt?.displayName ?? '',
              })}
            </Text>
            <Flex gap={12}>
              <Form.Item
                name="sideADisplayName"
                label={t('linkType.fields.displayName')}
                rules={[{ required: true, message: t('linkType.validation.required') }]}
                style={{ flex: 1 }}
              >
                <Input
                  onChange={(e) => handleSideADisplayNameChange(e.target.value)}
                />
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
                <Input
                  onChange={() => setSideAApiNameManual(true)}
                />
              </Form.Item>
            </Flex>
          </Card>

          {/* Direction card: B → A */}
          <Card
            size="small"
            title={t('linkType.wizard.directionTitle', {
              source: sideBOt?.displayName ?? '',
              target: sideAOt?.displayName ?? '',
            })}
            style={{ marginBottom: 16 }}
          >
            <Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
              {t('linkType.wizard.linkNameGuide', {
                source: sideBOt?.displayName ?? '',
                target: sideAOt?.displayName ?? '',
              })}
            </Text>
            <Flex gap={12}>
              <Form.Item
                name="sideBDisplayName"
                label={t('linkType.fields.displayName')}
                rules={[{ required: true, message: t('linkType.validation.required') }]}
                style={{ flex: 1 }}
              >
                <Input
                  onChange={(e) => handleSideBDisplayNameChange(e.target.value)}
                />
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
                <Input
                  onChange={() => setSideBApiNameManual(true)}
                />
              </Form.Item>
            </Flex>
          </Card>

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
