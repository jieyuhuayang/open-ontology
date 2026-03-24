import { Link } from 'react-router-dom';
import { LeftOutlined, RightOutlined } from '@ant-design/icons';
import { useWorkshopStore } from './stores/workshop-store';
import styles from './styles/workshop.module.css';

export function Component() {
  const isChatPanelExpanded = useWorkshopStore((s) => s.isChatPanelExpanded);
  const isSidekickOpen = useWorkshopStore((s) => s.isSidekickOpen);
  const toggleChatPanel = useWorkshopStore((s) => s.toggleChatPanel);
  const toggleSidekick = useWorkshopStore((s) => s.toggleSidekick);

  return (
    <div className={styles.workshopPage}>
      {/* Back button */}
      <Link to="/" className={styles.backButton}>
        <LeftOutlined />
        <span>Back</span>
      </Link>

      {/* Left: Chat Panel */}
      <div
        className={`${styles.chatPanel} ${!isChatPanelExpanded ? styles.chatPanelCollapsed : ''}`}
        data-testid="chat-panel"
      >
        {isChatPanelExpanded && (
          <div className={styles.placeholder}>Chat Panel</div>
        )}
        <div
          className={`${styles.panelToggle} ${styles.chatToggle}`}
          onClick={toggleChatPanel}
          data-testid="chat-toggle"
        >
          {isChatPanelExpanded ? <LeftOutlined /> : <RightOutlined />}
        </div>
      </div>

      {/* Center: Canvas Area */}
      <div className={styles.canvasArea} data-testid="canvas-area">
        <div className={styles.placeholder}>3D Canvas</div>
      </div>

      {/* Right: Sidekick Panel */}
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
            <div className={styles.placeholder}>Sidekick</div>
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
    </div>
  );
}
