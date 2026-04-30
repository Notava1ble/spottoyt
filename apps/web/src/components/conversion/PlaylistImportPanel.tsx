import type { ConversionJob } from "@spottoyt/shared";
import { Badge } from "@spottoyt/ui/components/badge";
import { Button } from "@spottoyt/ui/components/button";
import { ListMusic, MousePointerClick, RefreshCw, Search } from "lucide-react";

type PlaylistImportPanelProps = {
  latestConversion?: ConversionJob | null;
  matching?: boolean;
  onMatch?: () => void;
  onReset?: () => void;
  resetting?: boolean;
};

export function PlaylistImportPanel({
  latestConversion,
  matching = false,
  onMatch,
  onReset,
  resetting = false,
}: PlaylistImportPanelProps) {
  const trackCount = latestConversion?.tracks.length ?? 0;
  const statusLabel =
    latestConversion?.status === "reviewing"
      ? "Matches ready for review"
      : latestConversion
        ? "Imported"
        : "Waiting";

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <div className="flex flex-col gap-3 rounded-md border bg-background p-4">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-md bg-secondary text-secondary-foreground">
            <MousePointerClick aria-hidden="true" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-medium text-foreground">Spicetify bridge</p>
              <Badge variant="secondary">Primary import</Badge>
            </div>
            <p className="text-muted-foreground text-sm">
              Right-click a playlist in Spotify desktop and choose Extract to
              SpottoYT.
            </p>
          </div>
        </div>
        {latestConversion ? (
          <div className="flex flex-wrap gap-2">
            {latestConversion.status === "imported" ? (
              <Button disabled={matching} onClick={onMatch} type="button">
                <Search data-icon="inline-start" aria-hidden="true" />
                {matching ? "Matching with YTMusic" : "Match with YTMusic"}
              </Button>
            ) : null}
            <Button
              disabled={matching || resetting}
              onClick={onReset}
              type="button"
              variant="secondary"
            >
              <RefreshCw data-icon="inline-start" aria-hidden="true" />
              Reset import
            </Button>
          </div>
        ) : null}
      </div>
      <div className="flex flex-col justify-center gap-3 rounded-md border bg-background p-4">
        <div className="flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <ListMusic aria-hidden="true" />
          </div>
          <div>
            <p className="font-medium text-foreground">
              {latestConversion?.sourcePlaylistName ?? "No playlist imported"}
            </p>
            <p className="text-muted-foreground text-sm">
              {latestConversion
                ? `${trackCount} ${trackCount === 1 ? "track" : "tracks"} from Spicetify`
                : "Use the desktop bridge to send a playlist here."}
            </p>
          </div>
        </div>
        <Badge variant={latestConversion ? "default" : "secondary"}>
          {statusLabel}
        </Badge>
      </div>
    </div>
  );
}
