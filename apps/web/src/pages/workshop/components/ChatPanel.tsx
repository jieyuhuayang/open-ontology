import { useRef, useMemo, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useAgentSessions } from '@/api/agent';
import { useMaterials } from '@/api/materials';
import { useWorkshopStore } from '../stores/workshop-store';
import { useFocusLock } from '../hooks/use-focus-lock';
import FileUploadArea from './FileUploadArea';
import MessageList from './MessageList';
import ChatInput from './ChatInput';
import FocusLockTag from './FocusLockTag';
import PromptBubbles from './PromptBubbles';
import type { UseAgentChatReturn } from '../hooks/use-agent-chat';
import type { WorkshopNode } from '../types';

interface ChatPanelProps {
  ontologyRid: string;
  agentChat: UseAgentChatReturn;
  nodes?: WorkshopNode[];
}

const headerStyle: React.CSSProperties = {
  padding: '16px 16px 8px',
  borderBottom: '1px solid rgba(255,255,255,0.06)',
  fontSize: 14,
  fontWeight: 500,
  color: 'rgba(255,255,255,0.8)',
};

export default function ChatPanel({ ontologyRid, agentChat, nodes = [] }: ChatPanelProps) {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pageState = useWorkshopStore((s) => s.pageState);
  const currentSessionRid = useWorkshopStore((s) => s.currentSessionRid);
  const setCurrentSessionRid = useWorkshopStore(
    (s) => s.setCurrentSessionRid,
  );
  const setPageState = useWorkshopStore((s) => s.setPageState);
  const selectedEntityRid = useWorkshopStore((s) => s.selectedEntityRid);

  const { data: sessionsData } = useAgentSessions(ontologyRid, 1, 1);

  const activeSession = useMemo(() => {
    if (currentSessionRid) return null;
    const sessions = sessionsData?.items ?? [];
    return sessions.find(
      (s) => s.status === 'active' || s.status === 'completed',
    );
  }, [currentSessionRid, sessionsData]);

  // Restore active session
  useEffect(() => {
    if (activeSession && !currentSessionRid) {
      setCurrentSessionRid(activeSession.rid);
      setPageState('existing');
    }
  }, [activeSession, currentSessionRid, setCurrentSessionRid, setPageState]);

  const { messages, streamingText, isStreaming, send } = agentChat;
  const { data: materials } = useMaterials(currentSessionRid ?? '');

  // Focus lock
  const { focusedEntity, unlockEntity, prefixMessage } = useFocusLock(nodes);

  // Selected node for prompt bubbles
  const selectedNode = useMemo(
    () => nodes.find((n) => n.id === selectedEntityRid) ?? null,
    [nodes, selectedEntityRid],
  );

  // Wrap send with focus lock prefix
  const handleSend = useCallback(
    (content: string) => {
      send(prefixMessage(content));
    },
    [send, prefixMessage],
  );

  return (
    <div
      style={{ display: 'flex', flexDirection: 'column', height: '100%' }}
      data-testid="chat-panel-content"
    >
      <div style={headerStyle}>{t('workshop.title')}</div>

      {/* Focus lock tag */}
      <FocusLockTag entity={focusedEntity} onUnlock={unlockEntity} />

      {currentSessionRid && (
        <>
          <FileUploadArea
            sessionRid={currentSessionRid}
            materials={materials ?? []}
          />
          <MessageList messages={messages} streamingText={streamingText} />
          <PromptBubbles selectedNode={selectedNode} onSend={handleSend} />
          <ChatInput
            onSend={handleSend}
            onUploadClick={() => fileInputRef.current?.click()}
            disabled={isStreaming}
          />
        </>
      )}
    </div>
  );
}
