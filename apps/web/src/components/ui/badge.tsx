import type * as React from "react";
import { cn } from "../../lib/utils";

type BadgeProps = React.HTMLAttributes<HTMLSpanElement> & {
  tone?: "neutral" | "success" | "warning" | "danger";
};

const tones = {
  neutral: "border-stone-700 bg-stone-800 text-stone-200",
  success: "border-emerald-500/40 bg-emerald-400/10 text-emerald-200",
  warning: "border-amber-500/40 bg-amber-400/10 text-amber-200",
  danger: "border-red-500/40 bg-red-400/10 text-red-200",
};

export function Badge({ className, tone = "neutral", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}
