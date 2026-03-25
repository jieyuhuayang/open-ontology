import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { WorkshopNode, PromptBubble } from '../types';

interface PromptBubblesProps {
  selectedNode: WorkshopNode | null;
  onSend: (message: string) => void;
}

/** Template keys match i18n keys under workshop.promptBubbles.templates.* */
const TEMPLATE_KEYS = [
  'checkOrphanKeys',
  'deriveStats',
  'splitSensitive',
  'suggestRelated',
  'checkNaming',
  'addMissingProps',
  'verifyCardinality',
  'checkReverse',
] as const;

interface TemplateConfig {
  entityTypes?: ('object_type' | 'link_type')[];
  entityStatuses?: ('confirmed' | 'pending')[];
  minProperties?: number;
}

const TEMPLATE_CONFIGS: Record<string, TemplateConfig> = {
  checkOrphanKeys: { entityTypes: ['object_type'], entityStatuses: ['confirmed', 'pending'] },
  deriveStats: { entityTypes: ['object_type'], entityStatuses: ['confirmed'] },
  splitSensitive: { entityTypes: ['object_type'], minProperties: 8 },
  suggestRelated: { entityTypes: ['object_type'], entityStatuses: ['pending'] },
  checkNaming: { entityTypes: ['object_type'], entityStatuses: ['pending'] },
  addMissingProps: { entityTypes: ['object_type'], entityStatuses: ['pending'] },
  verifyCardinality: { entityTypes: ['link_type'] },
  checkReverse: { entityTypes: ['link_type'] },
};

function getPromptTemplates(t: (key: string) => string): PromptBubble[] {
  return TEMPLATE_KEYS.map((key) => ({
    id: key,
    label: t(`workshop.promptBubbles.${key}`),
    template: t(`workshop.promptBubbles.templates.${key}`),
    ...TEMPLATE_CONFIGS[key],
  }));
}

function filterBubbles(
  templates: PromptBubble[],
  node: WorkshopNode,
): PromptBubble[] {
  return templates
    .filter((tpl) => {
      if (tpl.entityTypes && !tpl.entityTypes.includes(node.type)) return false;
      if (
        tpl.entityStatuses &&
        !tpl.entityStatuses.includes(node.status)
      )
        return false;
      if (
        tpl.minProperties !== undefined &&
        (node.properties?.length ?? 0) < tpl.minProperties
      )
        return false;
      return true;
    })
    .slice(0, 5);
}

const containerStyle: React.CSSProperties = {
  display: 'flex',
  gap: 6,
  padding: '6px 12px',
  overflowX: 'auto',
  scrollbarWidth: 'none',
};

const pillStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  padding: '4px 10px',
  background: 'rgba(79, 143, 255, 0.08)',
  border: '1px solid rgba(79, 143, 255, 0.25)',
  borderRadius: 14,
  color: 'rgba(255,255,255,0.75)',
  fontSize: 11,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  transition: 'background 0.2s, border-color 0.2s',
  flexShrink: 0,
};

export default function PromptBubbles({
  selectedNode,
  onSend,
}: PromptBubblesProps) {
  const { t } = useTranslation();

  const bubbles = useMemo(() => {
    if (!selectedNode) return [];
    const templates = getPromptTemplates(t);
    return filterBubbles(templates, selectedNode);
  }, [selectedNode, t]);

  if (!selectedNode || bubbles.length === 0) return null;

  return (
    <div style={containerStyle} data-testid="prompt-bubbles">
      {bubbles.map((bubble) => (
        <button
          key={bubble.id}
          style={pillStyle}
          onClick={() => onSend(bubble.template)}
          data-testid={`prompt-bubble-${bubble.id}`}
        >
          💡 {bubble.label}
        </button>
      ))}
    </div>
  );
}
