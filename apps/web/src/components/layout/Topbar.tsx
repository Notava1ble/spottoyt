import { Badge } from "../ui/badge";

export function Topbar() {
  return (
    <header className="flex h-16 items-center justify-between border-stone-800 border-b bg-stone-950/80 px-6 backdrop-blur">
      <div>
        <p className="font-medium text-stone-100">Conversion workspace</p>
        <p className="text-sm text-stone-500">Mock mode</p>
      </div>
      <div className="flex gap-2">
        <Badge tone="warning">Spotify offline</Badge>
        <Badge tone="warning">YouTube Music offline</Badge>
      </div>
    </header>
  );
}
