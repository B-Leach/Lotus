import { Sidebar } from "./components/Sidebar";
import { ChatArea } from "./components/ChatArea";
import { useChat } from "./hooks/useChat";
import "./App.css";

function App() {
  const chat = useChat();
  return (
    <div className="app">
      <Sidebar
        conversations={chat.conversations}
        activeId={chat.activeConversationId}
        onSelect={chat.handleSelectConversation}
        onNew={chat.createNewConversation}
        onDelete={chat.handleDeleteRequest}
        onRename={chat.handleRenameConversation}
        isOpen={chat.sidebarOpen}
        onClose={() => chat.setSidebarOpen(false)}
        theme={chat.theme}
        onThemeChange={chat.setTheme}
      />
      <ChatArea
        messages={chat.activeConversation?.messages || []}
        isLoading={chat.isLoading}
        streamingContent={chat.streamingContent}
        onSendMessage={chat.handleSendMessage}
        onMenuClick={() => chat.setSidebarOpen(true)}
        hasConversations={chat.conversations.length > 0}
        onNewChat={chat.createNewConversation}
        onRegenerate={chat.handleRegenerate}
        onReaction={chat.handleReaction}
        onEditMessage={chat.handleEditMessage}
      />
      {chat.deleteConfirmId && (
        <div className="modal-overlay" onClick={chat.handleDeleteCancel}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Delete conversation?</h3>
            <p>This action cannot be undone.</p>
            <div className="modal-actions">
              <button className="modal-cancel" onClick={chat.handleDeleteCancel}>
                Cancel
              </button>
              <button className="modal-confirm" onClick={chat.handleDeleteConfirm}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
