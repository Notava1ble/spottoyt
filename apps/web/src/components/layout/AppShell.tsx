import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

export function AppShell() {
  return (
    <div className="flex min-h-screen bg-stone-950 text-stone-100">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main className="min-w-0 flex-1 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.12),transparent_32rem),radial-gradient(circle_at_bottom_right,rgba(239,68,68,0.1),transparent_28rem)] p-6">
          <div className="mx-auto max-w-6xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
