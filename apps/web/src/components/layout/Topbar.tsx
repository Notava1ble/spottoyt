export function Topbar() {
  return (
    <header className="flex h-16 items-center justify-between border-b bg-background/80 px-6 backdrop-blur">
      <div>
        <p className="font-medium text-foreground">Conversion workspace</p>
        <p className="text-muted-foreground text-sm">Mock mode</p>
      </div>
      <p className="text-muted-foreground text-sm">Services offline</p>
    </header>
  );
}
