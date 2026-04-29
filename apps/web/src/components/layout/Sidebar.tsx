import {
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  Sidebar as SidebarRoot,
} from "@spottoyt/ui/components/sidebar";
import {
  History,
  ListPlus,
  Music2,
  RotateCw,
  Settings,
  ShieldCheck,
} from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";

const items = [
  { to: "/", label: "Connect", Icon: ShieldCheck },
  { to: "/import", label: "Import", Icon: ListPlus },
  { to: "/review", label: "Review", Icon: RotateCw },
  { to: "/create", label: "Create", Icon: Music2 },
  { to: "/history", label: "History", Icon: History },
  { to: "/settings", label: "Settings", Icon: Settings },
];

export function Sidebar() {
  const { pathname } = useLocation();

  return (
    <SidebarRoot aria-label="Primary navigation">
      <SidebarHeader>
        <p className="font-semibold text-2xl text-sidebar-foreground">
          SpottoYT
        </p>
        <p className="text-muted-foreground text-sm">Playlist conversion</p>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Workflow</SidebarGroupLabel>
          <SidebarMenu>
            {items.map(({ Icon, label, to }) => (
              <SidebarMenuItem key={to}>
                <SidebarMenuButton
                  asChild
                  isActive={pathname === to}
                  aria-current={pathname === to ? "page" : undefined}
                >
                  <NavLink to={to}>
                    <Icon aria-hidden="true" />
                    <span>{label}</span>
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
    </SidebarRoot>
  );
}
