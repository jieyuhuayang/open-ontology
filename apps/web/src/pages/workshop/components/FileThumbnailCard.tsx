import { useTranslation } from 'react-i18next';
import {
  FileTextOutlined,
  FileExcelOutlined,
  FilePdfOutlined,
  DatabaseOutlined,
  CheckCircleFilled,
} from '@ant-design/icons';
import type { AgentMaterial } from '@/api/types';

interface FileThumbnailCardProps {
  material?: AgentMaterial;
  uploadProgress?: number;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(fileType?: string) {
  switch (fileType) {
    case 'csv':
    case 'xlsx':
      return <FileExcelOutlined style={{ color: '#52c41a' }} />;
    case 'pdf':
      return <FilePdfOutlined style={{ color: '#f5222d' }} />;
    case 'sql':
      return <DatabaseOutlined style={{ color: '#1890ff' }} />;
    default:
      return <FileTextOutlined style={{ color: '#8c8c8c' }} />;
  }
}

const cardStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: '8px 12px',
  margin: '4px 0',
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 8,
  fontSize: 13,
};

export default function FileThumbnailCard({
  material,
  uploadProgress,
}: FileThumbnailCardProps) {
  const { t } = useTranslation();
  const isUploading = uploadProgress !== undefined && !material;

  return (
    <div style={cardStyle} data-testid="file-thumbnail">
      <span style={{ fontSize: 18 }}>
        {material ? getFileIcon(material.fileType) : <FileTextOutlined />}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            color: 'rgba(255,255,255,0.87)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {material?.fileName ?? 'Uploading...'}
        </div>
        {material && (
          <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12 }}>
            {formatFileSize(material.fileSize)}
          </div>
        )}
        {isUploading && (
          <div
            style={{
              height: 3,
              marginTop: 4,
              background: 'rgba(255,255,255,0.1)',
              borderRadius: 2,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${uploadProgress}%`,
                background: '#4f8eff',
                borderRadius: 2,
                transition: 'width 0.3s',
              }}
            />
          </div>
        )}
      </div>
      {material && !isUploading && (
        <CheckCircleFilled
          style={{ color: '#52c41a', fontSize: 14 }}
          title={t('workshop.upload.uploaded')}
        />
      )}
    </div>
  );
}
