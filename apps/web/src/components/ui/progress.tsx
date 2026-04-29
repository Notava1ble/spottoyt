import { cn } from "../../lib/utils";

type ProgressProps = {
  value: number;
  className?: string;
};

export function Progress({ className, value }: ProgressProps) {
  const width = `${Math.min(Math.max(value, 0), 100)}%`;

  return (
    <div
      className={cn("h-2 overflow-hidden rounded-full bg-stone-800", className)}
    >
      <div className="h-full rounded-full bg-emerald-400" style={{ width }} />
    </div>
  );
}
