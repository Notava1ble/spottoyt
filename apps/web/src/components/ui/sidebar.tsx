import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";
import { cn } from "../../lib/utils";

export function SidebarProvider({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex min-h-screen w-full bg-stone-950 text-stone-100",
        className,
      )}
      {...props}
    />
  );
}

export function SidebarInset({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("flex min-w-0 flex-1 flex-col", className)} {...props} />
  );
}

export function Sidebar({
  className,
  ...props
}: React.HTMLAttributes<HTMLElement>) {
  return (
    <aside
      className={cn(
        "flex h-screen w-64 shrink-0 flex-col border-stone-800 border-r bg-stone-950",
        className,
      )}
      {...props}
    />
  );
}

export function SidebarHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("px-4 py-5", className)} {...props} />;
}

export function SidebarContent({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("flex min-h-0 flex-1 flex-col gap-4 px-3", className)}
      {...props}
    />
  );
}

export function SidebarGroup({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("grid gap-2", className)} {...props} />;
}

export function SidebarGroupLabel({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={cn(
        "px-3 font-medium text-stone-500 text-xs uppercase tracking-wide",
        className,
      )}
      {...props}
    />
  );
}

export function SidebarMenu({
  className,
  ...props
}: React.HTMLAttributes<HTMLUListElement>) {
  return <ul className={cn("grid gap-1", className)} {...props} />;
}

export function SidebarMenuItem({
  className,
  ...props
}: React.LiHTMLAttributes<HTMLLIElement>) {
  return <li className={cn("min-w-0", className)} {...props} />;
}

const sidebarMenuButtonVariants = cva(
  "flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-emerald-300 [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      isActive: {
        true: "bg-stone-800 text-stone-50",
        false: "text-stone-400 hover:bg-stone-900 hover:text-stone-100",
      },
    },
    defaultVariants: {
      isActive: false,
    },
  },
);

type SidebarMenuButtonProps = React.AnchorHTMLAttributes<HTMLAnchorElement> &
  VariantProps<typeof sidebarMenuButtonVariants> & {
    asChild?: boolean;
  };

export function SidebarMenuButton({
  asChild,
  className,
  isActive,
  ...props
}: SidebarMenuButtonProps) {
  const Comp = asChild ? Slot : "a";

  return (
    <Comp
      className={cn(sidebarMenuButtonVariants({ isActive, className }))}
      data-active={isActive ? "true" : undefined}
      {...props}
    />
  );
}
