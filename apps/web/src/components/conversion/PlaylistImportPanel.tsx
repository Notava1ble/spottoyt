import type { ConversionJob } from "@spottoyt/shared";
import { Badge } from "@spottoyt/ui/components/badge";
import { Button } from "@spottoyt/ui/components/button";
import { Input } from "@spottoyt/ui/components/input";
import {
  ExternalLink,
  ListMusic,
  MousePointerClick,
  Plus,
  RefreshCw,
  Search,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

type PlaylistImportPanelProps = {
  latestConversion?: ConversionJob | null;
  matching?: boolean;
  creating?: boolean;
  checkingYoutubeMusic?: boolean;
  createErrorMessage?: string | null;
  onMatch?: () => void;
  onCreate?: (targetPlaylistName: string) => void;
  onReset?: () => void;
  resetting?: boolean;
  youtubeMusicConnected?: boolean;
};

export function PlaylistImportPanel({
  latestConversion,
  checkingYoutubeMusic = false,
  createErrorMessage = null,
  creating = false,
  matching = false,
  onCreate,
  onMatch,
  onReset,
  resetting = false,
  youtubeMusicConnected = false,
}: PlaylistImportPanelProps) {
  const [playlistName, setPlaylistName] = useState("");
  const lastSyncedConversionId = useRef<string | null>(null);
  const trackCount = latestConversion?.tracks.length ?? 0;
  const matchedTrackCount = latestConversion?.matches.length ?? 0;
  const hasUnmatchedTracks = latestConversion
    ? matchedTrackCount < latestConversion.tracks.length
    : false;
  const canContinueMatching =
    latestConversion?.status === "reviewing" && hasUnmatchedTracks;
  const acceptedTrackCount =
    latestConversion?.matches.filter(
      (match) => match.status === "accepted" && match.candidate,
    ).length ?? 0;
  const statusLabel =
    latestConversion?.status === "reviewing"
      ? hasUnmatchedTracks
        ? "Matching stopped"
        : "Matches ready for review"
      : latestConversion
        ? "Imported"
        : "Waiting";
  const canCreate =
    latestConversion?.status === "reviewing" &&
    playlistName.trim().length > 0 &&
    acceptedTrackCount > 0 &&
    youtubeMusicConnected;
  const createBlockedMessage =
    latestConversion?.status === "reviewing"
      ? checkingYoutubeMusic
        ? "Checking YouTube Music connection."
        : !youtubeMusicConnected
          ? "Connect YouTube Music in Settings before creating."
          : acceptedTrackCount === 0
            ? "Select at least one YouTube Music match before creating."
            : null
      : null;

  useEffect(() => {
    const nextConversionId = latestConversion?.id ?? null;

    if (lastSyncedConversionId.current === nextConversionId) {
      return;
    }

    lastSyncedConversionId.current = nextConversionId;
    setPlaylistName(
      latestConversion?.targetPlaylistName ||
        latestConversion?.sourcePlaylistName ||
        "",
    );
  }, [latestConversion]);

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
        {latestConversion?.status === "reviewing" ? (
          <div className="grid gap-2">
            <label className="grid max-w-md gap-1" htmlFor="playlist-name">
              <span className="font-medium text-foreground text-sm">
                Playlist name
              </span>
              <Input
                disabled={creating}
                id="playlist-name"
                onChange={(event) => setPlaylistName(event.target.value)}
                value={playlistName}
              />
            </label>
            <p className="text-muted-foreground text-sm">
              {acceptedTrackCount} selected for creation.
            </p>
          </div>
        ) : null}
        {createErrorMessage ? (
          <p
            className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-destructive text-sm"
            role="alert"
          >
            {createErrorMessage}
          </p>
        ) : null}
        {latestConversion ? (
          <div className="flex flex-wrap gap-2">
            {latestConversion.status === "imported" || canContinueMatching ? (
              <Button disabled={matching} onClick={onMatch} type="button">
                <Search data-icon="inline-start" aria-hidden="true" />
                {matching
                  ? "Matching with YTMusic"
                  : canContinueMatching
                    ? "Continue matching"
                    : "Match with YTMusic"}
              </Button>
            ) : null}
            {latestConversion.status === "reviewing" ? (
              <Button
                disabled={creating || !canCreate}
                onClick={() => onCreate?.(playlistName.trim())}
                type="button"
              >
                <Plus data-icon="inline-start" aria-hidden="true" />
                {creating ? "Creating playlist" : "Create playlist"}
              </Button>
            ) : null}
            {latestConversion.playlist ? (
              <Button asChild type="button" variant="secondary">
                <a
                  href={latestConversion.playlist.playlistUrl}
                  rel="noreferrer"
                  target="_blank"
                >
                  <ExternalLink data-icon="inline-start" aria-hidden="true" />
                  Open YouTube Music playlist
                </a>
              </Button>
            ) : null}
            <Button
              disabled={matching || creating || resetting}
              onClick={onReset}
              type="button"
              variant="secondary"
            >
              <RefreshCw data-icon="inline-start" aria-hidden="true" />
              Reset import
            </Button>
          </div>
        ) : null}
        {createBlockedMessage ? (
          <p className="text-muted-foreground text-sm">
            {createBlockedMessage}
          </p>
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
