import {
  History,
  ListPlus,
  Music2,
  RotateCw,
  Settings,
  ShieldCheck,
} from "lucide-react";
import { NavLink } from "react-router-dom";
import { cn } from "../../lib/utils";

const items = [
  { to: "/", label: "Connect", Icon: ShieldCheck },
  { to: "/import", label: "Import", Icon: ListPlus },
  { to: "/review", label: "Review", Icon: RotateCw },
  { to: "/create", label: "Create", Icon: Music2 },
  { to: "/history", label: "History", Icon: History },
  { to: "/settings", label: "Settings", Icon: Settings },
];

export function Sidebar() {
  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-stone-800 border-r bg-stone-950 px-4 py-5">
      <div className="mb-8">
        <p className="font-semibold text-2xl text-stone-50">SpottoYT</p>
        <p className="text-sm text-stone-500">Local converter shell</p>
      </div>
      <nav className="grid gap-1" aria-label="Primary">
        {items.map(({ Icon, label, to }) => (
          <NavLink
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors",
                isActive
                  ? "bg-stone-800 text-stone-50"
                  : "text-stone-400 hover:bg-stone-900 hover:text-stone-100",
              )
            }
            key={to}
            to={to}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
            {label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
