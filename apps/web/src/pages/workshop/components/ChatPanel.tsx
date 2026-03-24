import { useRef, useMemo } from 'react';
import { useAgentSessions } from '@/api/agent';
import { useMaterials } from '@/api/materials';
import { useWorkshopStore } from '../stores/workshop-store';
import { useAgentChat } from '../hooks/use-agent-chat';
import GuidanceCard from './GuidanceCard';
import FileUploadArea from './FileUploadArea';
import MessageList from './MessageList';
import ChatInput from './ChatInput';

interface ChatPanelProps {
  ontologyRid: string;
}

const headerStyle: React.CSSProperties = {
  padding: '16px 16px 8px',
  borderBottom: '1px solid rgba(255,255,255,0.06)',
  fontSize: 14,
  fontWeight: 500,
  color: 'rgba(255,255,255,0.8)',
};

export default function ChatPanel({ ontologyRid }: ChatPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pageState = useWorkshopStore((s) => s.pageState);
  const currentSessionRid = useWorkshopStore((s) => s.currentSessionRid);
  const setCurrentSessionRid = useWorkshopStore(
    (s) => s.setCurrentSessionRid,
  );
  const setPageState = useWorkshopStore((s) => s.setPageState);

  // Auto-restore active session on mount
  const { data: sessionsData } = useAgentSessions(ontologyRid, 1, 1);

  // If we don't have a current session, try to restore the latest active one
  const activeSession = useMemo(() => {
    if (currentSessionRid) return null;
    const sessions = sessionsData?.items ?? [];
    return sessions.find(
      (s) => s.status === 'active' || s.status === 'completed',
    );
  }, [currentSessionRid, sessionsData]);

  if (activeSession && !currentSessionRid) {
    setCurrentSessionRid(activeSession.rid);
    setPageState('existing');
  }

  const { messages, streamingText, isStreaming, send } =
    useAgentChat(currentSessionRid);

  const { data: materials } = useMaterials(currentSessionRid ?? '');

  return (
    <div
      style={{ display: 'flex', flexDirection: 'column', height: '100%' }}
      data-testid="chat-panel-content"
    >
      <div style={headerStyle}>Workshop</div>

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
