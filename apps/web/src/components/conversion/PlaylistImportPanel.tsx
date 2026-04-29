import type { SpotifyPlaylistSummary } from "@spottoyt/shared";
import { Button } from "@spottoyt/ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@spottoyt/ui/components/card";
import { Input } from "@spottoyt/ui/components/input";
import { ListMusic, Search } from "lucide-react";
import { shellConversion } from "../../lib/mockData";
import { SpotifyPlaylistPicker } from "./SpotifyPlaylistPicker";

type PlaylistImportPanelProps = {
  onImport?: () => void;
  playlists?: SpotifyPlaylistSummary[];
  playlistsLoading?: boolean;
  showPlaylistPicker?: boolean;
};

export function PlaylistImportPanel({
  onImport,
  playlists = [],
  playlistsLoading,
  showPlaylistPicker,
}: PlaylistImportPanelProps) {
  return (
    <div className="grid gap-5">
      {showPlaylistPicker ? (
        <SpotifyPlaylistPicker
          isLoading={playlistsLoading}
          onImport={onImport}
          playlists={playlists}
        />
      ) : null}
      <div
        className={
          showPlaylistPicker
            ? "grid gap-5"
            : "grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]"
        }
      >
        <Card>
          <CardHeader>
            <CardTitle>Spotify playlist link</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <label className="flex flex-col gap-2" htmlFor="playlist-url">
              <span className="text-sm font-medium text-foreground">
                Playlist URL
              </span>
              <Input
                id="playlist-url"
                defaultValue="https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M"
              />
            </label>
            <Button onClick={onImport} type="button">
              <Search data-icon="inline-start" aria-hidden="true" />
              Import playlist link
            </Button>
          </CardContent>
        </Card>
        {!showPlaylistPicker ? (
          <Card>
            <CardHeader>
              <CardTitle>Demo preview</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <div className="flex size-11 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <ListMusic aria-hidden="true" />
                </div>
                <div>
                  <p className="font-medium text-foreground">
                    {shellConversion.sourcePlaylistName}
                  </p>
                  <p className="text-muted-foreground text-sm">
                    {shellConversion.tracks.length} demo tracks
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
