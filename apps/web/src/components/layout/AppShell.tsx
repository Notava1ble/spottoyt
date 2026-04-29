import { Outlet } from "react-router-dom";
import { Topbar } from "./Topbar";

export function AppShell() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Topbar />
      <main className="min-w-0 p-6">
        <div className="mx-auto max-w-6xl">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
