import { useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LeftOutlined, RightOutlined } from '@ant-design/icons';
import { useObjectTypes } from '@/api/object-types';
import { useBlueprints } from '@/api/blueprints';
import { useWorkshopStore } from './stores/workshop-store';
import { useAgentChat } from './hooks/use-agent-chat';
import { useWorkshopGraph } from './hooks/use-workshop-graph';
import ChatPanel from './components/ChatPanel';
import StarfieldWorkbench from './components/StarfieldWorkbench';
import SidekickPanel from './components/SidekickPanel';
import EntityPopover from './components/EntityPopover';
import EntityDrawer from './components/EntityDrawer';
import ConnectionBanner from './components/ConnectionBanner';
import styles from './styles/workshop.module.css';

const DEFAULT_ONTOLOGY_RID = 'ri.ontology.main.default';

export function Component() {
  const { t } = useTranslation();
  const isChatPanelExpanded = useWorkshopStore((s) => s.isChatPanelExpanded);
  const isSidekickOpen = useWorkshopStore((s) => s.isSidekickOpen);
  const toggleChatPanel = useWorkshopStore((s) => s.toggleChatPanel);
  const toggleSidekick = useWorkshopStore((s) => s.toggleSidekick);
  const pageState = useWorkshopStore((s) => s.pageState);
  const setPageState = useWorkshopStore((s) => s.setPageState);
  const currentSessionRid = useWorkshopStore((s) => s.currentSessionRid);
  const addCollapse = useWorkshopStore((s) => s.addCollapse);
  const setSelectedEntityRid = useWorkshopStore((s) => s.setSelectedEntityRid);
  const clearFocusLock = useWorkshopStore((s) => s.clearFocusLock);

  // Determine initial page state based on existing ObjectTypes
  const { data: otData } = useObjectTypes(1, 1);
  useEffect(() => {
    if (!currentSessionRid && pageState === 'empty') {
      const hasOT = (otData?.items?.length ?? 0) > 0;
      if (hasOT) {
        setPageState('existing');
      }
    }
  }, [otData, currentSessionRid, pageState, setPageState]);

  // Single instance of useAgentChat — shared by ChatPanel and ConnectionBanner
  const agentChat = useAgentChat(currentSessionRid);

  // Single instance of useWorkshopGraph — shared by StarfieldWorkbench, EntityPopover, EntityDrawer
  const { nodes, edges } = useWorkshopGraph(DEFAULT_ONTOLOGY_RID, null);

  // Reset store on unmount
  useEffect(() => {
    return () => {
      useWorkshopStore.getState().reset();
    };
  }, []);

  // F016: Drag-to-create-link → Agent chat
  const handleLinkCreate = useCallback(
    (sourceId: string, targetId: string) => {
      const sourceNode = nodes.find((n) => n.id === sourceId);
      const targetNode = nodes.find((n) => n.id === targetId);
      if (!sourceNode || !targetNode) return;
      agentChat.send(
        `请建议从 ${sourceNode.displayName} 到 ${targetNode.displayName} 的链接类型，包括基数关系和关系名称`,
      );
    },
    [nodes, agentChat],
  );

  // F016: Delete star entity
  const handleDeleteNode = useCallback(
    (nodeId: string) => {
      const node = nodes.find((n) => n.id === nodeId);
      if (!node) return;

      // Trigger collapse animation
      addCollapse({
        id: `collapse-${nodeId}-${Date.now()}`,
        position: { ...node.position },
        color: node.color,
        startTime: performance.now() / 1000,
      });

      // Clear selection and focus if this node was focused
      setSelectedEntityRid(null);
      clearFocusLock();

      // Note: actual removal from data layer (TanStack Query cache / blueprint API)
      // will be handled in F017 when backend integration is available
    },
    [nodes, addCollapse, setSelectedEntityRid, clearFocusLock],
  );

  return (
    <div className={styles.workshopPage}>
      <Link to="/" className={styles.backButton} data-testid="back-button">
        <LeftOutlined />
        <span>{t('workshop.backToManager')}</span>
      </Link>

      <div
        className={`${styles.chatPanel} ${!isChatPanelExpanded ? styles.chatPanelCollapsed : ''}`}
        data-testid="chat-panel"
      >
        {isChatPanelExpanded && (
          <ChatPanel
            ontologyRid={DEFAULT_ONTOLOGY_RID}
            agentChat={agentChat}
            nodes={nodes}
          />
        )}
        <div
          className={`${styles.panelToggle} ${styles.chatToggle}`}
          onClick={toggleChatPanel}
          data-testid="chat-toggle"
        >
          {isChatPanelExpanded ? <LeftOutlined /> : <RightOutlined />}
        </div>
      </div>

      <div className={styles.canvasArea} data-testid="canvas-area">
        <StarfieldWorkbench
          nodes={nodes}
          edges={edges}
          onLinkCreate={handleLinkCreate}
        />
        <EntityPopover nodes={nodes} />
        <ConnectionBanner onReconnect={agentChat.reconnect} />
      </div>

      <div
        className={`${styles.sidekickPanel} ${!isSidekickOpen ? styles.sidekickPanelClosed : ''}`}
        data-testid="sidekick-panel"
      >
        {isSidekickOpen && (
          <>
            <div
              className={`${styles.panelToggle} ${styles.sidekickToggle}`}
              onClick={toggleSidekick}
              data-testid="sidekick-toggle"
            >
              <RightOutlined />
            </div>
            <SidekickPanel />
          </>
        )}
      </div>
      {!isSidekickOpen && (
        <div
          className={`${styles.panelToggle} ${styles.sidekickToggle}`}
          onClick={toggleSidekick}
          style={{ position: 'fixed', right: 0 }}
          data-testid="sidekick-toggle"
        >
          <LeftOutlined />
        </div>
      )}

      <EntityDrawer
        nodes={nodes}
        edges={edges}
        onDeleteNode={handleDeleteNode}
      />
    </div>
  );
}
