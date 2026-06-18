import { useChat } from "./hooks/useChat";
import { useLayoutSelection } from "./layouts/useLayoutSelection";

function App() {
  const chat = useChat();
  const { entry } = useLayoutSelection();
  const Layout = entry.component;
  return <Layout chat={chat} />;
}

export default App;
