import { useEffect, useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { createPortal } from 'react-dom';
import { useWorkshopStore } from '../stores/workshop-store';
import ConfidenceIndicator from './ConfidenceIndicator';
import type { WorkshopNode } from '../types';

interface EntityPopoverProps {
  nodes: WorkshopNode[];
}

export default function EntityPopover({ nodes }: EntityPopoverProps) {
  const { t } = useTranslation();
  const hoveredEntityRid = useWorkshopStore((s) => s.hoveredEntityRid);
  const mousePosRef = useRef({ x: 0, y: 0 });
  const [visible, setVisible] = useState(false);
  const [renderPos, setRenderPos] = useState({ x: 0, y: 0 });

  const node = nodes.find((n) => n.id === hoveredEntityRid);

  // Only track mouse when hovered — avoids per-frame setState
  useEffect(() => {
    if (!hoveredEntityRid) return;

    const handler = (e: MouseEvent) => {
      mousePosRef.current = { x: e.clientX, y: e.clientY };
      setRenderPos({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener('mousemove', handler);
    return () => window.removeEventListener('mousemove', handler);
  }, [hoveredEntityRid]);

  // 200ms delay show, 100ms delay hide
  useEffect(() => {
    if (hoveredEntityRid) {
      const timer = setTimeout(() => setVisible(true), 200);
      return () => clearTimeout(timer);
    } else {
      const timer = setTimeout(() => setVisible(false), 100);
      return () => clearTimeout(timer);
    }
  }, [hoveredEntityRid]);

  if (!visible || !node) return null;

  const typeLabel =
    node.type === 'object_type'
      ? t('workshop.entity.objectType')
      : t('workshop.entity.linkType');

  const description = node.description
    ? node.description.length > 50
      ? node.description.slice(0, 50) + '...'
      : node.description
    : null;

  return createPortal(
    <div
      style={{
        position: 'fixed',
        left: renderPos.x + 12,
        top: renderPos.y + 12,
        padding: '10px 14px',
        background: 'rgba(20, 20, 40, 0.95)',
        border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: 8,
        maxWidth: 260,
        pointerEvents: 'none',
        zIndex: 9999,
        boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
      }}
      data-testid="entity-popover"
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          marginBottom: 4,
        }}
      >
        <span
          style={{
            color: 'rgba(255,255,255,0.9)',
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          {node.displayName}
        </span>
        <span
          style={{
            fontSize: 10,
            padding: '1px 6px',
            background: 'rgba(79,142,255,0.2)',
            borderRadius: 4,
            color: '#4f8eff',
          }}
        >
          {typeLabel}
        </span>
      </div>
      {description && (
        <div
          style={{
            fontSize: 12,
            color: 'rgba(255,255,255,0.5)',
            marginBottom: 4,
          }}
        >
          {description}
        </div>
      )}
      {node.status === 'pending' &&
        node.confidence != null &&
        node.confidenceLevel && (
          <ConfidenceIndicator
            confidence={node.confidence}
            confidenceLevel={node.confidenceLevel}
          />
        )}
    </div>,
    document.body,
  );
}
