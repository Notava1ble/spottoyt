import type { ConversionJob } from "@spottoyt/shared";
import { Button } from "@spottoyt/ui/components/button";
import { Cable, ListMusic } from "lucide-react";

type PlaylistImportPanelProps = {
  latestConversion?: ConversionJob | null;
  onImport?: () => void;
};

export function PlaylistImportPanel({
  latestConversion,
  onImport,
}: PlaylistImportPanelProps) {
  const trackCount = latestConversion?.tracks.length ?? 0;

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <div className="flex flex-col gap-3 rounded-md border bg-background p-4">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-md bg-secondary text-secondary-foreground">
            <Cable aria-hidden="true" />
          </div>
          <div>
            <p className="font-medium text-foreground">Spicetify bridge</p>
            <p className="text-muted-foreground text-sm">
              Open a Spotify playlist and press Send to SpottoYT.
            </p>
          </div>
        </div>
        <Button disabled={!latestConversion} onClick={onImport} type="button">
          <ListMusic data-icon="inline-start" aria-hidden="true" />
          Review latest import
        </Button>
      </div>
      <div className="flex flex-col justify-center gap-3 rounded-md border bg-background p-4">
        <div className="flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <ListMusic aria-hidden="true" />
          </div>
          <div>
            <p className="font-medium text-foreground">
              {latestConversion?.sourcePlaylistName ?? "Waiting for import"}
            </p>
            <p className="text-muted-foreground text-sm">
              {latestConversion
                ? `${trackCount} ${trackCount === 1 ? "track" : "tracks"} from Spicetify`
                : "Waiting for Spotify desktop"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
