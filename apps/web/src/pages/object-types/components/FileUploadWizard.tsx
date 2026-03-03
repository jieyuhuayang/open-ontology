import { useState } from 'react';
import {
  Modal,
  Steps,
  Upload,
  Select,
  Switch,
  Button,
  Checkbox,
  Table,
  Flex,
  Typography,
  Alert,
  Spin,
  Input,
  message,
} from 'antd';
import { InboxOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useFileUploadPreview, useFileImportConfirm, useImportTask } from '@/api/imports';
import { datasetKeys } from '@/api/datasets';
import { useQueryClient } from '@tanstack/react-query';
import type { UploadPreviewResponse, UploadPreviewColumn } from '@/api/imports';
import type { RcFile } from 'antd/es/upload';

const { Dragger } = Upload;
const { Text, Title } = Typography;

const MAX_FILE_SIZE_MB = 50;
const ACCEPTED_EXTENSIONS = ['.xlsx', '.xls', '.csv'];

interface FileUploadWizardProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (datasetRid: string) => void;
}

export default function FileUploadWizard({ open, onClose, onSuccess }: FileUploadWizardProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [currentStep, setCurrentStep] = useState(0);
  const [previewData, setPreviewData] = useState<UploadPreviewResponse | null>(null);
  const [selectedSheet, setSelectedSheet] = useState<string | undefined>();
  const [hasHeader, setHasHeader] = useState(true);
  const [selectedColumns, setSelectedColumns] = useState<string[]>([]);
  const [datasetName, setDatasetName] = useState('');
  const [taskId, setTaskId] = useState<string | undefined>();
  const [uploadError, setUploadError] = useState('');

  const uploadPreview = useFileUploadPreview();
  const importConfirm = useFileImportConfirm();
  const { data: importTask } = useImportTask(taskId);

  const handleClose = () => {
    setCurrentStep(0);
    setPreviewData(null);
    setSelectedSheet(undefined);
    setHasHeader(true);
    setSelectedColumns([]);
    setDatasetName('');
    setTaskId(undefined);
    setUploadError('');
    onClose();
  };

  const handleBeforeUpload = async (file: RcFile) => {
    setUploadError('');
    const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    if (!ACCEPTED_EXTENSIONS.includes(ext)) {
      setUploadError(t('import.fileUpload.unsupportedFormat'));
      return false;
    }
    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      setUploadError(t('import.fileUpload.tooLarge'));
      return false;
    }

    try {
      const data = await uploadPreview.mutateAsync(file as File);
      setPreviewData(data);
      setDatasetName(file.name.replace(/\.[^.]+$/, ''));
      const cols = data.preview.columns.map((c: UploadPreviewColumn) => c.name);
      setSelectedColumns(cols);
      if (data.sheets && data.sheets.length > 0) {
        setSelectedSheet(data.defaultSheet ?? data.sheets[0]);
      }
    } catch {
      setUploadError(t('error.somethingWentWrong'));
    }

    return false; // prevent default upload
  };

  const handleConfirmImport = async () => {
    if (!previewData) return;
    try {
      const task = await importConfirm.mutateAsync({
        fileToken: previewData.fileToken,
        datasetName,
        sheetName: selectedSheet ?? null,
        hasHeader,
        selectedColumns: selectedColumns.length > 0 ? selectedColumns : null,
      });
      setTaskId(task.taskId);
      setCurrentStep(2);
    } catch {
      message.error(t('mysqlConnection.importFailed'));
    }
  };

  const handleUseDataset = () => {
    if (importTask?.datasetRid) {
      queryClient.invalidateQueries({ queryKey: datasetKeys.lists() });
      onSuccess(importTask.datasetRid);
      handleClose();
    }
  };

  const previewColumns = previewData?.preview.columns.map((col) => ({
    title: col.name,
    dataIndex: col.name,
    key: col.name,
    width: 120,
    ellipsis: true,
  })) ?? [];

  return (
    <Modal
      title={t('import.fileUpload.title')}
      open={open}
      onCancel={handleClose}
      width={720}
      destroyOnClose
      footer={
        currentStep < 2 ? (
          <Flex justify="space-between">
            <Button onClick={currentStep === 0 ? handleClose : () => setCurrentStep(0)}>
              {currentStep === 0 ? t('common.cancel') : t('wizard.back')}
            </Button>
            <Button
              type="primary"
              disabled={
                (currentStep === 0 && !previewData) ||
                (currentStep === 1 && (!datasetName || selectedColumns.length === 0))
              }
              loading={importConfirm.isPending}
              onClick={currentStep === 0 ? () => setCurrentStep(1) : handleConfirmImport}
            >
              {currentStep === 0 ? t('wizard.next') : t('import.fileUpload.confirmImport')}
            </Button>
          </Flex>
        ) : null
      }
    >
      <Steps
        current={currentStep}
        size="small"
        style={{ marginBottom: 24 }}
        items={[
          { title: t('import.fileUpload.steps.upload') },
          { title: t('import.fileUpload.steps.preview') },
          { title: t('import.fileUpload.steps.result') },
        ]}
      />

      {currentStep === 0 && (
        <Flex vertical gap={16}>
          <Dragger
            multiple={false}
            showUploadList={false}
            beforeUpload={handleBeforeUpload}
            accept=".xlsx,.xls,.csv"
          >
            <p className="ant-upload-drag-icon">
              <InboxOutlined />
            </p>
            <p className="ant-upload-text">{t('import.fileUpload.dragHint')}</p>
            <p className="ant-upload-hint">{t('import.fileUpload.formatHint')}</p>
          </Dragger>

          {uploadError && <Alert type="error" message={uploadError} showIcon />}

          {uploadPreview.isPending && (
            <Flex justify="center">
              <Spin />
            </Flex>
          )}

          {previewData && (
            <Alert
              type="success"
              message={`${previewData.filename} (${(previewData.fileSize / 1024).toFixed(1)} KB)`}
              showIcon
            />
          )}

          {previewData?.sheets && previewData.sheets.length > 1 && (
            <div>
              <Text strong style={{ display: 'block', marginBottom: 4 }}>
                {t('import.fileUpload.selectSheet')}
              </Text>
              <Select
                value={selectedSheet}
                onChange={setSelectedSheet}
                options={previewData.sheets.map((s) => ({ value: s, label: s }))}
                style={{ width: '100%' }}
              />
            </div>
          )}
        </Flex>
      )}

      {currentStep === 1 && previewData && (
        <Flex vertical gap={16}>
          <div>
            <Text strong style={{ display: 'block', marginBottom: 4 }}>
              {t('mysqlConnection.datasetName')}
            </Text>
            <Input value={datasetName} onChange={(e) => setDatasetName(e.target.value)} />
          </div>

          <Flex align="center" gap={8}>
            <Text strong>{t('import.fileUpload.hasHeader')}</Text>
            <Switch checked={hasHeader} onChange={setHasHeader} />
          </Flex>

          <div>
            <Text strong style={{ display: 'block', marginBottom: 8 }}>
              {t('mysqlConnection.selectColumns')}
            </Text>
            <Checkbox.Group
              value={selectedColumns}
              onChange={(vals) => setSelectedColumns(vals.map(String))}
              style={{ display: 'flex', flexDirection: 'column', gap: 6 }}
            >
              {previewData.preview.columns.map((col) => (
                <Checkbox key={col.name} value={col.name}>
                  {col.name} ({col.inferredType})
                </Checkbox>
              ))}
            </Checkbox.Group>
          </div>

          {previewData.preview.rows.length > 0 && (
            <div>
              <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
                Preview (first 10 rows)
              </Text>
              <Table
                dataSource={previewData.preview.rows.slice(0, 10)}
                columns={previewColumns}
                size="small"
                pagination={false}
                scroll={{ x: 'max-content' }}
                rowKey={(_, i) => String(i)}
              />
            </div>
          )}
        </Flex>
      )}

      {currentStep === 2 && (
        <Flex vertical align="center" gap={16} style={{ padding: '24px 0' }}>
          {!importTask || importTask.status === 'pending' || importTask.status === 'running' ? (
            <>
              <Spin size="large" />
              <Text>{t('import.status.running')}</Text>
            </>
          ) : importTask.status === 'completed' ? (
            <>
              <CheckCircleOutlined style={{ fontSize: 48, color: '#52c41a' }} />
              <Title level={4}>{t('mysqlConnection.importSuccess')}</Title>
              {importTask.rowCount && (
                <Text type="secondary">
                  {importTask.rowCount} {t('import.rows')} · {importTask.columnCount} {t('import.columns')}
                </Text>
              )}
              <Button type="primary" onClick={handleUseDataset}>
                {t('import.useDataset')}
              </Button>
            </>
          ) : (
            <>
              <CloseCircleOutlined style={{ fontSize: 48, color: '#ff4d4f' }} />
              <Title level={4}>{t('mysqlConnection.importFailed')}</Title>
              {importTask.errorMessage && (
                <Text type="danger">{importTask.errorMessage}</Text>
              )}
              <Flex gap={8}>
                <Button onClick={() => { setTaskId(undefined); setCurrentStep(1); }}>
                  {t('import.retry')}
                </Button>
                <Button onClick={handleClose}>{t('common.cancel')}</Button>
              </Flex>
            </>
          )}
        </Flex>
      )}
    </Modal>
  );
}
