import { cn } from "@spottoyt/ui/lib/utils";
import { Library, RefreshCw, Settings } from "lucide-react";
import { NavLink } from "react-router-dom";

const navItems = [
  { to: "/", label: "Convert", Icon: RefreshCw },
  { to: "/library", label: "Library", Icon: Library },
  { to: "/settings", label: "Settings", Icon: Settings },
];

export function Topbar() {
  return (
    <header className="border-b bg-background/95">
      <div className="mx-auto flex min-h-16 max-w-6xl flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-semibold text-foreground text-xl">SpottoYT</p>
          <p className="text-muted-foreground text-sm">
            Local playlist conversion
          </p>
        </div>
        <nav
          aria-label="Primary navigation"
          className="flex flex-wrap items-center gap-1"
        >
          {navItems.map(({ Icon, label, to }) => (
            <NavLink
              className={({ isActive }) =>
                cn(
                  "inline-flex h-9 items-center gap-2 rounded-md px-3 text-sm font-medium text-muted-foreground outline-none transition-colors hover:bg-secondary hover:text-secondary-foreground focus-visible:ring-3 focus-visible:ring-ring/50",
                  isActive && "bg-secondary text-secondary-foreground",
                )
              }
              end={to === "/"}
              key={to}
              to={to}
            >
              <Icon aria-hidden="true" />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
      </div>
    </header>
  );
}
