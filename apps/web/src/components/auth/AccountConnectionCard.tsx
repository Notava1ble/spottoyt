import { Badge } from "@spottoyt/ui/components/badge";
import { Button } from "@spottoyt/ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@spottoyt/ui/components/card";
import type { LucideIcon } from "lucide-react";

type AccountConnectionCardProps = {
  name: string;
  status: "connected" | "not-connected";
  Icon: LucideIcon;
  actionLabel?: string;
  detail?: string;
  disabled?: boolean;
  onAction?: () => void;
};

export function AccountConnectionCard({
  Icon,
  actionLabel,
  detail,
  disabled,
  name,
  onAction,
  status,
}: AccountConnectionCardProps) {
  const connected = status === "connected";

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
            <Icon aria-hidden="true" />
          </div>
          <CardTitle aria-level={2} role="heading">
            {name}
          </CardTitle>
        </div>
        <Badge variant={connected ? "default" : "secondary"}>
          {connected ? "Connected" : "Not connected"}
        </Badge>
      </CardHeader>
      <CardContent className="flex items-center justify-between gap-4">
        <p className="text-muted-foreground text-sm">
          {detail ??
            (connected
              ? "Credentials are available locally."
              : "OAuth setup is reserved.")}
        </p>
        <Button
          disabled={disabled}
          onClick={onAction}
          variant={connected ? "secondary" : "default"}
          size="sm"
        >
          {actionLabel ?? (connected ? "Refresh" : "Connect")}
        </Button>
      </CardContent>
    </Card>
  );
}
