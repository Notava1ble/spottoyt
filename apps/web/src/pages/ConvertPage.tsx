import { Badge } from "@spottoyt/ui/components/badge";
import { Button } from "@spottoyt/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@spottoyt/ui/components/card";
import { Music2, Radio, RotateCcw } from "lucide-react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AccountConnectionCard } from "../components/auth/AccountConnectionCard";
import { MatchReviewTable } from "../components/conversion/MatchReviewTable";
import { PlaylistImportPanel } from "../components/conversion/PlaylistImportPanel";
import {
  getAccountStatus,
  getSpotifyLoginUrl,
  getSpotifyPlaylists,
} from "../lib/apiClient";

const stages = ["Setup", "Choose playlist", "Review", "Confirm", "Create"];
const activeStageByMode = {
  choose: "Choose playlist",
  review: "Review",
};

type ConvertMode = keyof typeof activeStageByMode;

export function ConvertPage() {
  const [mode, setMode] = useState<ConvertMode>("choose");
  const activeStage = activeStageByMode[mode];
  const accountStatus = useQuery({
    queryKey: ["auth-status"],
    queryFn: getAccountStatus,
  });
  const spotify = accountStatus.data?.spotify;
  const spotifyConnected = Boolean(spotify?.connected);
  const spotifyPlaylists = useQuery({
    queryKey: ["spotify-playlists"],
    queryFn: getSpotifyPlaylists,
    enabled: spotifyConnected,
  });

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="font-semibold text-3xl text-foreground">Convert</h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Start a new Spotify to YouTube Music conversion. Account readiness,
            playlist selection, review, and creation live in one linear flow.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {stages.map((stage) => (
            <Badge
              key={stage}
              variant={stage === activeStage ? "default" : "secondary"}
            >
              {stage}
            </Badge>
          ))}
        </div>
      </div>

      {mode === "choose" ? (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            <AccountConnectionCard
              Icon={Music2}
              name="Spotify"
              status={spotifyConnected ? "connected" : "not-connected"}
              actionLabel={spotifyConnected ? "Connected" : "Connect"}
              detail={
                spotifyConnected
                  ? `Signed in${spotify?.displayName ? ` as ${spotify.displayName}` : ""}.`
                  : spotify?.configured === false
                    ? "Add Spotify credentials to the API .env file."
                    : "Connect with your local Spotify app credentials."
              }
              disabled={spotifyConnected || spotify?.configured === false}
              onAction={() => {
                window.location.assign(getSpotifyLoginUrl());
              }}
            />
            <AccountConnectionCard
              Icon={Radio}
              name="YouTube Music"
              status="not-connected"
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Choose playlist</CardTitle>
              <CardDescription>
                Paste a Spotify playlist link now. Authenticated playlist
                picking can sit beside this once the Spotify connection is
                wired.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <PlaylistImportPanel
                onImport={() => setMode("review")}
                playlists={spotifyPlaylists.data?.playlists}
                playlistsLoading={spotifyPlaylists.isLoading}
                showPlaylistPicker={spotifyConnected}
              />
            </CardContent>
          </Card>
        </>
      ) : (
        <section className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="font-semibold text-2xl text-foreground">
                Matching Review
              </h2>
              <p className="mt-2 max-w-2xl text-muted-foreground">
                Review proposed YouTube Music matches before creating the
                playlist. Reset if the source playlist needs to change.
              </p>
            </div>
            <Button
              onClick={() => setMode("choose")}
              type="button"
              variant="secondary"
            >
              <RotateCcw data-icon="inline-start" aria-hidden="true" />
              Reset conversion
            </Button>
          </div>
          <MatchReviewTable />
        </section>
      )}
    </section>
  );
}
