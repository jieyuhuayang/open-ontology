import { useRef, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAgentSessions } from '@/api/agent';
import { useMaterials } from '@/api/materials';
import { useWorkshopStore } from '../stores/workshop-store';
import GuidanceCard from './GuidanceCard';
import FileUploadArea from './FileUploadArea';
import MessageList from './MessageList';
import ChatInput from './ChatInput';
import type { UseAgentChatReturn } from '../hooks/use-agent-chat';

interface ChatPanelProps {
  ontologyRid: string;
  agentChat: UseAgentChatReturn;
}

const headerStyle: React.CSSProperties = {
  padding: '16px 16px 8px',
  borderBottom: '1px solid rgba(255,255,255,0.06)',
  fontSize: 14,
  fontWeight: 500,
  color: 'rgba(255,255,255,0.8)',
};

export default function ChatPanel({ ontologyRid, agentChat }: ChatPanelProps) {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pageState = useWorkshopStore((s) => s.pageState);
  const currentSessionRid = useWorkshopStore((s) => s.currentSessionRid);
  const setCurrentSessionRid = useWorkshopStore(
    (s) => s.setCurrentSessionRid,
  );
  const setPageState = useWorkshopStore((s) => s.setPageState);

  const { data: sessionsData } = useAgentSessions(ontologyRid, 1, 1);

  const activeSession = useMemo(() => {
    if (currentSessionRid) return null;
    const sessions = sessionsData?.items ?? [];
    return sessions.find(
      (s) => s.status === 'active' || s.status === 'completed',
    );
  }, [currentSessionRid, sessionsData]);

  // Restore active session (moved out of render body into useEffect)
  useEffect(() => {
    if (activeSession && !currentSessionRid) {
      setCurrentSessionRid(activeSession.rid);
      setPageState('existing');
    }
  }, [activeSession, currentSessionRid, setCurrentSessionRid, setPageState]);

  const { messages, streamingText, isStreaming, send } = agentChat;

  const { data: materials } = useMaterials(currentSessionRid ?? '');

  return (
    <div
      style={{ display: 'flex', flexDirection: 'column', height: '100%' }}
      data-testid="chat-panel-content"
    >
      <div style={headerStyle}>{t('workshop.title')}</div>

      {pageState === 'empty' && !currentSessionRid && (
        <GuidanceCard ontologyRid={ontologyRid} />
      )}

      {currentSessionRid && (
        <>
          <FileUploadArea
            sessionRid={currentSessionRid}
            materials={materials ?? []}
          />
          <MessageList messages={messages} streamingText={streamingText} />
          <ChatInput
            onSend={send}
            onUploadClick={() => fileInputRef.current?.click()}
            disabled={isStreaming}
          />
        </>
      )}
    </div>
  );
}
