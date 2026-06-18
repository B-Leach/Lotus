import { useChat } from "./hooks/useChat";
import { ClassicLayout } from "./layouts/classic/ClassicLayout";

function App() {
  const chat = useChat();
  return <ClassicLayout chat={chat} />;
}

export default App;
