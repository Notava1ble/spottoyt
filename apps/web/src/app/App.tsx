import { BrowserRouter, MemoryRouter, Route, Routes } from "react-router-dom";
import { AppShell } from "../components/layout/AppShell";
import { ConnectPage } from "../pages/ConnectPage";
import { CreatePage } from "../pages/CreatePage";
import { HistoryPage } from "../pages/HistoryPage";
import { ImportPage } from "../pages/ImportPage";
import { ReviewPage } from "../pages/ReviewPage";
import { SettingsPage } from "../pages/SettingsPage";
import { Providers } from "./providers";

type AppProps = {
  initialEntries?: string[];
};

function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<ConnectPage />} />
        <Route path="import" element={<ImportPage />} />
        <Route path="review" element={<ReviewPage />} />
        <Route path="create" element={<CreatePage />} />
        <Route path="history" element={<HistoryPage />} />
        <Route path="settings" element={<SettingsPage />} />
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
