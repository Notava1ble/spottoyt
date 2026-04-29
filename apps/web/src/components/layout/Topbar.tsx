export function Topbar() {
  return (
    <header className="flex h-16 items-center justify-between border-stone-800 border-b bg-stone-950/80 px-6 backdrop-blur">
      <div>
        <p className="font-medium text-stone-100">Conversion workspace</p>
        <p className="text-sm text-stone-500">Mock mode</p>
      </div>
      <p className="text-sm text-stone-500">Services offline</p>
    </header>
  );
}
