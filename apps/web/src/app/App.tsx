import {
  BrowserRouter,
  MemoryRouter,
  Navigate,
  Route,
  Routes,
} from "react-router-dom";
import { AppShell } from "../components/layout/AppShell";
import { ConvertPage } from "../pages/ConvertPage";
import { HistoryPage } from "../pages/HistoryPage";
import { SettingsPage } from "../pages/SettingsPage";
import { Providers } from "./providers";

type AppProps = {
  initialEntries?: string[];
};

function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<ConvertPage />} />
        <Route path="library" element={<HistoryPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="import" element={<Navigate to="/" replace />} />
        <Route path="review" element={<Navigate to="/" replace />} />
        <Route path="create" element={<Navigate to="/" replace />} />
        <Route path="history" element={<Navigate to="/library" replace />} />
      </Route>
    </Routes>
  );
}

export default function App({ initialEntries }: AppProps) {
  const content = (
    <Providers>
      <AppRoutes />
    </Providers>
  );

  if (initialEntries) {
    return (
      <MemoryRouter initialEntries={initialEntries}>{content}</MemoryRouter>
    );
  }

  return <BrowserRouter>{content}</BrowserRouter>;
}
