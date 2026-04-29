import { SidebarInset, SidebarProvider } from "@spottoyt/ui/components/sidebar";
import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

export function AppShell() {
  return (
    <SidebarProvider>
      <Sidebar />
      <SidebarInset>
        <Topbar />
        <main className="min-w-0 flex-1 bg-background p-6">
          <div className="mx-auto max-w-6xl">
            <Outlet />
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
