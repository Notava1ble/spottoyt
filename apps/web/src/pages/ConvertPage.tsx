import type { ConversionJob } from "@spottoyt/shared";
import { Badge } from "@spottoyt/ui/components/badge";
import { Card, CardContent } from "@spottoyt/ui/components/card";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Cable, Radio } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { AccountConnectionCard } from "../components/auth/AccountConnectionCard";
import { MatchProgressDialog } from "../components/conversion/MatchProgressDialog";
import { MatchReviewTable } from "../components/conversion/MatchReviewTable";
import { PlaylistImportPanel } from "../components/conversion/PlaylistImportPanel";
import {
  getAccountStatus,
  getEventsUrl,
  getLatestImport,
  matchConversion,
  resetImport,
} from "../lib/apiClient";
import { logClientEvent } from "../lib/logger";

export function ConvertPage() {
  const [liveConversion, setLiveConversion] = useState<ConversionJob | null>(
    null,
  );
  const [matchDialog, setMatchDialog] = useState<{
    errorMessage: string | null;
    matchedConversion: ConversionJob | null;
    open: boolean;
    sourceConversion: ConversionJob | null;
  }>({
    errorMessage: null,
    matchedConversion: null,
    open: false,
    sourceConversion: null,
  });
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
  const finishMatchingDialog = useCallback(
    (nextConversion: ConversionJob) => {
      setLiveConversion(nextConversion);
      void queryClient.invalidateQueries({ queryKey: ["imports-latest"] });
    },
    [queryClient],
  );
  const match = useMutation({
    mutationFn: (id: string) => matchConversion(id),
    onMutate: (id) => {
      logClientEvent("info", "web.conversion.match.clicked", {
        conversionId: id,
      });
      setMatchDialog({
        errorMessage: null,
        matchedConversion: null,
        open: true,
        sourceConversion: conversion,
      });
    },
    onSuccess: (response) => {
      logClientEvent("info", "web.conversion.match.completed", {
        conversionId: response.conversion.id,
        status: response.conversion.status,
        matchCount: response.conversion.matches.length,
      });
      setMatchDialog((current) => ({
        ...current,
        matchedConversion: response.conversion,
      }));
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : String(error);
      logClientEvent("error", "web.conversion.match.failed", {
        message,
      });
      setMatchDialog((current) => ({
        ...current,
        errorMessage: message,
      }));
    },
  });
  const reset = useMutation({
    mutationFn: resetImport,
    onMutate: () => {
      logClientEvent("info", "web.import.reset.clicked", {
        conversionId: conversion?.id,
      });
    },
    onSuccess: () => {
      logClientEvent("info", "web.import.reset.completed", {
        conversionId: conversion?.id,
      });
      setLiveConversion(null);
      void queryClient.invalidateQueries({ queryKey: ["imports-latest"] });
    },
    onError: (error) => {
      logClientEvent("error", "web.import.reset.failed", {
        message: error instanceof Error ? error.message : String(error),
      });
    },
  });
  const locked = conversion
    ? conversion.status !== "imported" && conversion.status !== "importing"
    : false;

  useEffect(() => {
    if (accountStatus.error) {
      logClientEvent("error", "web.query.account_status.failed", {
        message: accountStatus.error.message,
      });
    }
  }, [accountStatus.error]);

  useEffect(() => {
    if (latestImport.error) {
      logClientEvent("error", "web.query.latest_import.failed", {
        message: latestImport.error.message,
      });
    }
  }, [latestImport.error]);

  useEffect(() => {
    if (!("EventSource" in window)) {
      logClientEvent("warn", "web.sse.unavailable");
      return;
    }

    const eventsUrl = getEventsUrl();
    logClientEvent("info", "web.sse.opening", { url: eventsUrl });
    const events = new EventSource(eventsUrl);
    events.onopen = () => {
      logClientEvent("info", "web.sse.connected");
    };
    events.onerror = () => {
      logClientEvent("warn", "web.sse.error");
    };
    events.addEventListener("spicetify-imported", () => {
      logClientEvent("info", "web.sse.spicetify_imported");
      void queryClient.invalidateQueries({ queryKey: ["imports-latest"] });
      void getLatestImport().then((response) => {
        logClientEvent("info", "web.import.live_conversion.loaded", {
          conversionId: response.conversion?.id,
          status: response.conversion?.status,
        });
        setLiveConversion(response.conversion);
      });
    });

    return () => {
      logClientEvent("info", "web.sse.closed");
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

      <MatchProgressDialog
        errorMessage={matchDialog.errorMessage}
        matchedConversion={matchDialog.matchedConversion}
        onFinished={finishMatchingDialog}
        onOpenChange={(open) =>
          setMatchDialog((current) => ({ ...current, open }))
        }
        open={matchDialog.open}
        sourceConversion={matchDialog.sourceConversion}
      />

      {conversion ? (
        <MatchReviewTable
          conversion={conversion}
          onConversionChange={setLiveConversion}
        />
      ) : null}
    </section>
  );
}
