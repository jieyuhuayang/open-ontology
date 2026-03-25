import { useEffect, useRef, useState } from 'react';
import { Button, List, Modal, Progress, Space, Tag, Typography } from 'antd';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  MinusCircleOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import {
  usePreApplyCheck,
  useApplyBlueprint,
  useRetryItem,
} from '@/api/blueprints';
import type { BlueprintApplyResult, ConflictCheckResult } from '@/api/types';
import ConflictWarningAlert from './ConflictWarningAlert';

const { Text } = Typography;

interface ApplyProgressModalProps {
  blueprintRid: string;
  open: boolean;
  onClose: () => void;
}

type Stage = 'precheck' | 'conflicts' | 'applying' | 'result';

export default function ApplyProgressModal({
  blueprintRid,
  open,
  onClose,
}: ApplyProgressModalProps) {
  const { t } = useTranslation();
  const [stage, setStage] = useState<Stage>('precheck');
  const [conflicts, setConflicts] = useState<ConflictCheckResult[]>([]);
  const [applyResult, setApplyResult] = useState<BlueprintApplyResult | null>(
    null,
  );
  const [skippedItems, setSkippedItems] = useState<Set<string>>(new Set());

  const preCheckMutation = usePreApplyCheck(blueprintRid);
  const applyMutation = useApplyBlueprint(blueprintRid);
  const retryMutation = useRetryItem(blueprintRid);

  const runPreCheck = () => {
    setStage('precheck');
    preCheckMutation.mutate(undefined, {
      onSuccess: (data) => {
        if (data.conflicts.length > 0) {
          setConflicts(data.conflicts);
          setStage('conflicts');
        } else {
          runApply();
        }
      },
    });
  };

  const runApply = () => {
    setStage('applying');
    applyMutation.mutate(undefined, {
      onSuccess: (data) => {
        setApplyResult(data);
        setStage('result');
      },
    });
  };

  // Run pre-check on first open (in useEffect to avoid render-time side effects)
  const hasStarted = useRef(false);
  useEffect(() => {
    if (open && stage === 'precheck' && !hasStarted.current) {
      hasStarted.current = true;
      runPreCheck();
    }
    if (!open) {
      hasStarted.current = false;
    }
  }, [open, stage]);

  const handleRetry = (itemRid: string) => {
    retryMutation.mutate(
      { itemRid },
      {
        onSuccess: (data) => {
          if (data.status === 'success' && applyResult) {
            setApplyResult({
              ...applyResult,
              succeeded: applyResult.succeeded + 1,
              failed: applyResult.failed - 1,
              results: applyResult.results.map((r) =>
                r.itemRid === itemRid
                  ? {
                      ...r,
                      status: 'success',
                      createdEntityRid: data.createdEntityRid,
                      error: null,
                    }
                  : r,
              ),
            });
          }
        },
      },
    );
  };

  const handleSkip = (itemRid: string) => {
    setSkippedItems((prev) => new Set([...prev, itemRid]));
  };

  const statusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircleOutlined style={{ color: '#52c41a' }} />;
      case 'failed':
        return <CloseCircleOutlined style={{ color: '#ff4d4f' }} />;
      case 'skipped':
        return <MinusCircleOutlined style={{ color: '#8c8c8c' }} />;
      default:
        return null;
    }
  };

  return (
    <Modal
      title={t('workshop.review.applyBlueprint')}
      open={open}
      onCancel={onClose}
      footer={
        stage === 'result' ? (
          <Button type="primary" onClick={onClose}>
            OK
          </Button>
        ) : null
      }
      closable={stage === 'result' || stage === 'conflicts'}
      maskClosable={false}
      width={520}
    >
      {stage === 'precheck' && (
        <div style={{ textAlign: 'center', padding: 24 }}>
          <Progress type="circle" percent={30} status="active" />
          <div style={{ marginTop: 12 }}>
            {t('workshop.review.applyProgress')}
          </div>
        </div>
      )}

      {stage === 'conflicts' && (
        <ConflictWarningAlert
          conflicts={conflicts}
          onIgnore={runApply}
          onGoBack={onClose}
        />
      )}

      {stage === 'applying' && (
        <div style={{ textAlign: 'center', padding: 24 }}>
          <Progress type="circle" percent={60} status="active" />
          <div style={{ marginTop: 12 }}>
            {t('workshop.review.applyProgress')}
          </div>
        </div>
      )}

      {stage === 'result' && applyResult && (
        <div>
          <Space style={{ marginBottom: 16 }}>
            <Tag color="green">
              {t('workshop.review.succeeded')}: {applyResult.succeeded}
            </Tag>
            <Tag color="red">
              {t('workshop.review.failed')}: {applyResult.failed}
            </Tag>
            <Tag>
              {t('workshop.review.skipped')}: {applyResult.skipped}
            </Tag>
          </Space>
          <List
            size="small"
            dataSource={applyResult.results}
            renderItem={(item) => {
              const isSkipped = skippedItems.has(item.itemRid);
              const displayStatus = isSkipped ? 'skipped' : item.status;
              return (
                <List.Item
                  actions={
                    item.status === 'failed' && !isSkipped
                      ? [
                          <Button
                            key="retry"
                            size="small"
                            onClick={() => handleRetry(item.itemRid)}
                            loading={retryMutation.isPending}
                          >
                            {t('workshop.review.retryItem')}
                          </Button>,
                          <Button
                            key="skip"
                            size="small"
                            onClick={() => handleSkip(item.itemRid)}
                          >
                            {t('workshop.review.skipItem')}
                          </Button>,
                        ]
                      : undefined
                  }
                >
                  <Space>
                    {statusIcon(displayStatus)}
                    <Text
                      style={{
                        textDecoration: isSkipped ? 'line-through' : undefined,
                      }}
                    >
                      {item.itemRid.split('.').pop()?.slice(0, 8)}
                    </Text>
                    {item.error && (
                      <Text type="danger" style={{ fontSize: 12 }}>
                        {item.error}
                      </Text>
                    )}
                  </Space>
                </List.Item>
              );
            }}
          />
        </div>
      )}
    </Modal>
  );
}
