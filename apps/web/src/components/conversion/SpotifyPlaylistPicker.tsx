import type { SpotifyPlaylistSummary } from "@spottoyt/shared";
import { Button } from "@spottoyt/ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@spottoyt/ui/components/card";
import { ListMusic } from "lucide-react";

type SpotifyPlaylistPickerProps = {
  isLoading?: boolean;
  playlists: SpotifyPlaylistSummary[];
  onImport?: () => void;
};

export function SpotifyPlaylistPicker({
  isLoading,
  onImport,
  playlists,
}: SpotifyPlaylistPickerProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Your Spotify playlists</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3">
        {isLoading ? (
          <p className="text-muted-foreground text-sm">Loading playlists...</p>
        ) : null}
        {!isLoading && playlists.length === 0 ? (
          <p className="text-muted-foreground text-sm">No playlists found.</p>
        ) : null}
        {playlists.map((playlist) => (
          <div
            className="flex flex-col gap-3 rounded-lg border bg-background p-4 sm:flex-row sm:items-center sm:justify-between"
            key={playlist.id}
          >
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
                <ListMusic aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <p className="truncate font-medium text-foreground">
                  {playlist.name}
                </p>
                <p className="text-muted-foreground text-sm">
                  {playlist.trackCount} tracks
                </p>
              </div>
            </div>
            <Button
              aria-label={`Use playlist ${playlist.name}`}
              onClick={onImport}
              size="sm"
              type="button"
            >
              Use playlist
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
