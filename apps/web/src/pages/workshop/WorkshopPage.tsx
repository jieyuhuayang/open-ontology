import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LeftOutlined, RightOutlined } from '@ant-design/icons';
import { useObjectTypes } from '@/api/object-types';
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
        <StarfieldWorkbench nodes={nodes} edges={edges} />
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

      <EntityDrawer nodes={nodes} edges={edges} />
    </div>
  );
}
