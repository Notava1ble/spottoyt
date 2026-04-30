import type { ConversionJob } from "@spottoyt/shared";
import { Badge } from "@spottoyt/ui/components/badge";
import { Card, CardContent } from "@spottoyt/ui/components/card";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Cable, Radio } from "lucide-react";
import { useEffect, useState } from "react";
import { AccountConnectionCard } from "../components/auth/AccountConnectionCard";
import { MatchReviewTable } from "../components/conversion/MatchReviewTable";
import { PlaylistImportPanel } from "../components/conversion/PlaylistImportPanel";
import {
  getAccountStatus,
  getEventsUrl,
  getLatestImport,
  matchConversion,
  resetImport,
} from "../lib/apiClient";

export function ConvertPage() {
  const [liveConversion, setLiveConversion] = useState<ConversionJob | null>(
    null,
  );
  const queryClient = useQueryClient();
  const accountStatus = useQuery({
    queryKey: ["auth-status"],
    queryFn: getAccountStatus,
  });
  const latestImport = useQuery({
    queryKey: ["imports-latest"],
    queryFn: getLatestImport,
  });
  const conversion = liveConversion ?? latestImport.data?.conversion ?? null;
  const youtubeMusic = accountStatus.data?.youtubeMusic;
  const match = useMutation({
    mutationFn: (id: string) => matchConversion(id),
    onSuccess: (response) => {
      setLiveConversion(response.conversion);
      void queryClient.invalidateQueries({ queryKey: ["imports-latest"] });
    },
  });
  const reset = useMutation({
    mutationFn: resetImport,
    onSuccess: () => {
      setLiveConversion(null);
      void queryClient.invalidateQueries({ queryKey: ["imports-latest"] });
    },
  });
  const locked = conversion
    ? conversion.status !== "imported" && conversion.status !== "importing"
    : false;

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
            Import from Spotify desktop with the Spicetify context menu, inspect
            the source songs, then match them with YouTube Music.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant={conversion ? "default" : "secondary"}>Import</Badge>
          <Badge
            variant={
              conversion?.status === "reviewing" ? "default" : "secondary"
            }
          >
            Match
          </Badge>
          <Badge variant={locked ? "default" : "secondary"}>Review</Badge>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <AccountConnectionCard
          Icon={Cable}
          name="Spotify Desktop"
          status={conversion ? "connected" : "not-connected"}
          actionLabel={conversion ? "Imported" : "Waiting"}
          detail={
            conversion
              ? `${conversion.sourcePlaylistName} is loaded from Spicetify.`
              : "Waiting for the Spicetify extension to send a playlist."
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
        <CardContent className="p-5">
          <PlaylistImportPanel
            latestConversion={conversion}
            matching={match.isPending}
            onMatch={() => {
              if (conversion) {
                match.mutate(conversion.id);
              }
            }}
            onReset={() => reset.mutate()}
            resetting={reset.isPending}
          />
        </CardContent>
      </Card>

      {conversion ? <MatchReviewTable conversion={conversion} /> : null}
    </section>
  );
}
