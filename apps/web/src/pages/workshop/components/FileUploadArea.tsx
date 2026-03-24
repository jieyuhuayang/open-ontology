import { useState, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { message } from 'antd';
import { useUploadMaterial } from '@/api/materials';
import type { AgentMaterial } from '@/api/types';
import FileThumbnailCard from './FileThumbnailCard';

const ALLOWED_TYPES = new Set([
  'text/csv',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'application/sql',
  'text/sql',
  'application/pdf',
  'text/markdown',
  'text/x-markdown',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
]);

const ALLOWED_EXTENSIONS = new Set([
  '.csv',
  '.xlsx',
  '.xls',
  '.sql',
  '.pdf',
  '.md',
  '.docx',
  '.txt',
]);

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

interface FileUploadAreaProps {
  sessionRid: string;
  materials: AgentMaterial[];
}

const dropzoneStyle: React.CSSProperties = {
  padding: '8px 16px',
};

const dropActiveStyle: React.CSSProperties = {
  ...dropzoneStyle,
  border: '2px dashed rgba(79, 142, 255, 0.5)',
  borderRadius: 12,
  background: 'rgba(79, 142, 255, 0.08)',
};

function isFileAllowed(file: File): boolean {
  if (ALLOWED_TYPES.has(file.type)) return true;
  const ext = '.' + file.name.split('.').pop()?.toLowerCase();
  return ALLOWED_EXTENSIONS.has(ext);
}

export default function FileUploadArea({
  sessionRid,
  materials,
}: FileUploadAreaProps) {
  const { t } = useTranslation();
  const [isDragActive, setIsDragActive] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<
    Record<string, number>
  >({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadMaterial = useUploadMaterial();

  const handleFile = useCallback(
    async (file: File) => {
      if (!isFileAllowed(file)) {
        message.error(t('workshop.upload.invalidType'));
        return;
      }
      if (file.size > MAX_FILE_SIZE) {
        message.error(t('workshop.upload.tooLarge'));
        return;
      }

      const tempId = `uploading-${Date.now()}`;
      setUploadProgress((p) => ({ ...p, [tempId]: 0 }));

      // Simulate progress (actual progress not available via axios)
      const interval = setInterval(() => {
        setUploadProgress((p) => {
          const current = p[tempId] ?? 0;
          if (current >= 90) {
            clearInterval(interval);
            return p;
          }
          return { ...p, [tempId]: current + 10 };
        });
      }, 200);

      try {
        await uploadMaterial.mutateAsync({ file, sessionRid });
        clearInterval(interval);
        setUploadProgress((p) => {
          const next = { ...p };
          delete next[tempId];
          return next;
        });
      } catch {
        clearInterval(interval);
        setUploadProgress((p) => {
          const next = { ...p };
          delete next[tempId];
          return next;
        });
        message.error(t('workshop.upload.failed', { name: file.name, defaultValue: `Upload failed: ${file.name}` }));
      }
    },
    [sessionRid, uploadMaterial, t],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragActive(false);
      const files = Array.from(e.dataTransfer.files);
      files.forEach(handleFile);
    },
    [handleFile],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragActive(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragActive(false);
  }, []);

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? []);
      files.forEach(handleFile);
      if (fileInputRef.current) fileInputRef.current.value = '';
    },
    [handleFile],
  );

  return (
    <div
      style={isDragActive ? dropActiveStyle : dropzoneStyle}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      data-testid="file-upload-area"
    >
      {isDragActive && (
        <div
          style={{
            textAlign: 'center',
            padding: 16,
            color: 'rgba(79,142,255,0.9)',
            fontSize: 14,
          }}
        >
          {t('workshop.upload.dropHint')}
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        multiple
        style={{ display: 'none' }}
        onChange={handleFileInput}
        accept=".csv,.xlsx,.xls,.sql,.pdf,.md,.docx,.txt"
        data-testid="file-input"
      />

      {/* Uploaded files */}
      {materials.map((m) => (
        <FileThumbnailCard key={m.rid} material={m} />
      ))}

      {/* Uploading files */}
      {Object.entries(uploadProgress).map(([id, progress]) => (
        <FileThumbnailCard key={id} uploadProgress={progress} />
      ))}
    </div>
  );
}

// Export ref trigger for ChatInput's upload button
export function triggerFileInput(ref: React.RefObject<HTMLInputElement | null>) {
  ref.current?.click();
}
