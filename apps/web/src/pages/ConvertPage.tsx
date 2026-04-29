import type { ConversionJob } from "@spottoyt/shared";
import { Badge } from "@spottoyt/ui/components/badge";
import { Button } from "@spottoyt/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@spottoyt/ui/components/card";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Cable, Radio, RotateCcw } from "lucide-react";
import { useEffect, useState } from "react";
import { AccountConnectionCard } from "../components/auth/AccountConnectionCard";
import { MatchReviewTable } from "../components/conversion/MatchReviewTable";
import { PlaylistImportPanel } from "../components/conversion/PlaylistImportPanel";
import {
  getAccountStatus,
  getEventsUrl,
  getLatestImport,
} from "../lib/apiClient";

const stages = ["Setup", "Choose playlist", "Review", "Confirm", "Create"];
const activeStageByMode = {
  choose: "Choose playlist",
  review: "Review",
};

type ConvertMode = keyof typeof activeStageByMode;

export function ConvertPage() {
  const [mode, setMode] = useState<ConvertMode>("choose");
  const [liveConversion, setLiveConversion] = useState<ConversionJob | null>(
    null,
  );
  const queryClient = useQueryClient();
  const activeStage = activeStageByMode[mode];
  const accountStatus = useQuery({
    queryKey: ["auth-status"],
    queryFn: getAccountStatus,
  });
  const youtubeMusic = accountStatus.data?.youtubeMusic;
  const latestImport = useQuery({
    queryKey: ["imports-latest"],
    queryFn: getLatestImport,
  });
  const latestConversion =
    liveConversion ?? latestImport.data?.conversion ?? null;

  useEffect(() => {
    if (!("EventSource" in window)) {
      return;
    }

    const events = new EventSource(getEventsUrl());
    events.addEventListener("spicetify-imported", () => {
      void queryClient.invalidateQueries({ queryKey: ["imports-latest"] });
      void getLatestImport().then((response) => {
        setLiveConversion(response.conversion);
      });
      setMode("review");
    });

    return () => {
      events.close();
    };
  }, [queryClient]);

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
              Icon={Cable}
              name="Spotify Desktop"
              status={latestConversion ? "connected" : "not-connected"}
              actionLabel="Waiting"
              detail={
                latestConversion
                  ? `${latestConversion.sourcePlaylistName} is ready for review.`
                  : "Waiting for Spotify desktop. Use the Spicetify button to send the current playlist here."
              }
              disabled
            />
            <AccountConnectionCard
              Icon={Radio}
              name="YouTube Music"
              status={youtubeMusic?.connected ? "connected" : "not-connected"}
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Choose playlist</CardTitle>
              <CardDescription>
                Use the Spicetify extension inside Spotify desktop to push the
                current playlist into SpottoYT.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <PlaylistImportPanel
                onImport={() => setMode("review")}
                latestConversion={latestConversion}
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
              {latestConversion ? (
                <p className="mt-1 font-medium text-foreground">
                  {latestConversion.sourcePlaylistName}
                </p>
              ) : null}
              <p className="mt-2 max-w-2xl text-muted-foreground">
                {latestConversion
                  ? `Reviewing ${latestConversion.sourcePlaylistName}: ${latestConversion.tracks.length} ${
                      latestConversion.tracks.length === 1 ? "track" : "tracks"
                    } from Spicetify.`
                  : "Review proposed YouTube Music matches before creating the playlist. Reset if the source playlist needs to change."}
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
          <MatchReviewTable conversion={latestConversion} />
        </section>
      )}
    </section>
  );
}
