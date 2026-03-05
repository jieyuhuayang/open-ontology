import { useState } from 'react';
import { Modal, Steps, Upload, Button, Form, Input, Table, Checkbox, Select, Result, Spin, App } from 'antd';
import { InboxOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useFileUploadPreview, useFileImportConfirm, useImportTask } from '@/api/imports';
import type { UploadPreviewResponse } from '@/api/imports';
import { useDataConnectionStore } from '@/stores/data-connection-store';

const { Dragger } = Upload;
const STEPS = ['upload', 'preview', 'result'] as const;
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

const COLUMN_TYPE_OPTIONS = [
  { label: 'String', value: 'string' },
  { label: 'Integer', value: 'integer' },
  { label: 'Double', value: 'double' },
  { label: 'Boolean', value: 'boolean' },
  { label: 'Date', value: 'date' },
  { label: 'Timestamp', value: 'timestamp' },
];

export default function FileUploadWizard() {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const openModal = useDataConnectionStore((s) => s.openModal);
  const setOpenModal = useDataConnectionStore((s) => s.setOpenModal);

  const [step, setStep] = useState(0);
  const [previewData, setPreviewData] = useState<UploadPreviewResponse | null>(null);
  const [datasetName, setDatasetName] = useState('');
  const [selectedSheet, setSelectedSheet] = useState<string | undefined>(undefined);
  const [selectedColumns, setSelectedColumns] = useState<string[]>([]);
  const [hasHeader, setHasHeader] = useState(true);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [columnTypeOverrides, setColumnTypeOverrides] = useState<Record<string, string>>({});

  const uploadPreview = useFileUploadPreview();
  const fileImportConfirm = useFileImportConfirm();
  const { data: taskData } = useImportTask(taskId ?? undefined);

  const open = openModal === 'fileUpload';

  const handleClose = () => {
    setOpenModal(null);
    setStep(0);
    setPreviewData(null);
    setDatasetName('');
    setSelectedSheet(undefined);
    setSelectedColumns([]);
    setHasHeader(true);
    setTaskId(null);
    setColumnTypeOverrides({});
  };

  const handleUpload = async (file: File) => {
    if (file.size > MAX_FILE_SIZE) {
      message.error(t('import.fileUpload.tooLarge'));
      return false;
    }
    try {
      const result = await uploadPreview.mutateAsync(file);
      setPreviewData(result);
      setDatasetName(file.name.replace(/\.[^.]+$/, ''));
      setHasHeader(result.preview.hasHeader);
      if (result.sheets && result.sheets.length > 0) {
        setSelectedSheet(result.defaultSheet ?? result.sheets[0]);
      }
      setStep(1);
    } catch {
      message.error(t('import.fileUpload.unsupportedFormat'));
    }
    return false; // prevent default upload
  };

  const handleConfirm = async () => {
    if (!previewData) return;
    // Build overrides only for changed types
    const overrides: Record<string, string> = {};
    for (const [colName, colType] of Object.entries(columnTypeOverrides)) {
      const original = previewData.preview.columns.find((c) => c.name === colName);
      if (original && original.inferredType !== colType) {
        overrides[colName] = colType;
      }
    }
    try {
      const task = await fileImportConfirm.mutateAsync({
        fileToken: previewData.fileToken,
        datasetName: datasetName || 'Untitled',
        sheetName: selectedSheet,
        hasHeader,
        selectedColumns: selectedColumns.length > 0 ? selectedColumns : undefined,
        columnTypeOverrides: Object.keys(overrides).length > 0 ? overrides : undefined,
      });
      setTaskId(task.taskId);
      setStep(2);
    } catch {
      message.error(t('mysqlConnection.importFailed'));
    }
  };

  const renderStep0 = () => (
    <Dragger
      accept=".csv,.xlsx,.xls"
      showUploadList={false}
      beforeUpload={(file) => {
        handleUpload(file);
        return false;
      }}
      disabled={uploadPreview.isPending}
    >
      <p className="ant-upload-drag-icon">
        <InboxOutlined />
      </p>
      <p className="ant-upload-text">{t('import.fileUpload.dragHint')}</p>
      <p className="ant-upload-hint">{t('import.fileUpload.formatHint')}</p>
    </Dragger>
  );

  const renderStep1 = () => {
    if (!previewData) return null;
    const previewColumns = previewData.preview.columns.map((col) => ({
      title: col.name,
      dataIndex: col.name,
      key: col.name,
      ellipsis: true,
    }));

    return (
      <div>
        <Form layout="vertical">
          <Form.Item label={t('mysqlConnection.datasetName')}>
            <Input value={datasetName} onChange={(e) => setDatasetName(e.target.value)} />
          </Form.Item>
          {previewData.sheets && previewData.sheets.length > 1 && (
            <Form.Item label={t('import.fileUpload.selectSheet')}>
              <Select
                value={selectedSheet}
                onChange={setSelectedSheet}
                options={previewData.sheets.map((s) => ({ label: s, value: s }))}
              />
            </Form.Item>
          )}
          <Form.Item label={t('import.fileUpload.hasHeader')}>
            <Checkbox checked={hasHeader} onChange={(e) => setHasHeader(e.target.checked)}>
              {t('import.fileUpload.hasHeader')}
            </Checkbox>
          </Form.Item>
          <Form.Item label={t('mysqlConnection.selectColumns')}>
            <Checkbox.Group
              value={selectedColumns}
              onChange={(vals) => setSelectedColumns(vals as string[])}
              style={{ display: 'flex', flexDirection: 'column', gap: 4 }}
            >
              {previewData.preview.columns.map((col) => (
                <div key={col.name} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Checkbox value={col.name}>{col.name}</Checkbox>
                  <Select
                    size="small"
                    value={columnTypeOverrides[col.name] ?? col.inferredType}
                    onChange={(val) =>
                      setColumnTypeOverrides((prev) => ({ ...prev, [col.name]: val }))
                    }
                    options={COLUMN_TYPE_OPTIONS}
                    style={{ width: 120 }}
                  />
                </div>
              ))}
            </Checkbox.Group>
          </Form.Item>
        </Form>

        <Table
          rowKey={(_, index) => String(index)}
          columns={previewColumns}
          dataSource={previewData.preview.rows}
          pagination={false}
          scroll={{ x: 'max-content' }}
          size="small"
          style={{ marginBottom: 16 }}
        />
        <Button
          type="primary"
          onClick={handleConfirm}
          loading={fileImportConfirm.isPending}
          disabled={selectedColumns.length === 0}
        >
          {t('import.fileUpload.confirmImport')}
        </Button>
        {selectedColumns.length === 0 && (
          <span style={{ marginLeft: 8, color: '#ff4d4f', fontSize: 12 }}>
            {t('import.fileUpload.atLeastOneColumn')}
          </span>
        )}
      </div>
    );
  };

  const renderStep2 = () => {
    if (!taskData) return <Spin />;
    if (taskData.status === 'pending' || taskData.status === 'running') {
      return <Result icon={<Spin size="large" />} title={t(`import.status.${taskData.status}`)} />;
    }
    if (taskData.status === 'completed') {
      return (
        <Result
          status="success"
          title={t('mysqlConnection.importSuccess')}
          subTitle={`${taskData.rowCount?.toLocaleString()} ${t('import.rows')}, ${taskData.columnCount} ${t('import.columns')}`}
          extra={<Button type="primary" onClick={handleClose}>{t('common.confirm')}</Button>}
        />
      );
    }
    return (
      <Result
        status="error"
        title={t('mysqlConnection.importFailed')}
        subTitle={taskData.errorMessage}
        extra={<Button onClick={handleClose}>{t('common.confirm')}</Button>}
      />
    );
  };

  return (
    <Modal
      open={open}
      title={t('import.fileUpload.title')}
      onCancel={handleClose}
      footer={null}
      width={720}
      destroyOnClose
    >
      <Steps
        current={step}
        items={STEPS.map((s) => ({ title: t(`import.fileUpload.steps.${s}`) }))}
        style={{ marginBottom: 24 }}
      />
      {step === 0 && renderStep0()}
      {step === 1 && renderStep1()}
      {step === 2 && renderStep2()}
    </Modal>
  );
}
