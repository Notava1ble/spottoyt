import type { ConversionJob, ImportEvent } from "@spottoyt/shared";
import { Badge } from "@spottoyt/ui/components/badge";
import { Button } from "@spottoyt/ui/components/button";
import { Card, CardContent } from "@spottoyt/ui/components/card";
import { Progress } from "@spottoyt/ui/components/progress";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CircleDotDashed, CircleStop, PanelsTopLeft } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { MatchProgressDialog } from "../components/conversion/MatchProgressDialog";
import { MatchReviewTable } from "../components/conversion/MatchReviewTable";
import { PlaylistImportPanel } from "../components/conversion/PlaylistImportPanel";
import {
  cancelMatchConversion,
  createPlaylist,
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
    cancelledConversion: ConversionJob | null;
    completedConversion: ConversionJob | null;
    errorMessage: string | null;
    open: boolean;
    processedTracks: number;
    progressConversion: ConversionJob | null;
    sourceConversion: ConversionJob | null;
    totalTracks: number;
  }>({
    cancelledConversion: null,
    completedConversion: null,
    errorMessage: null,
    open: false,
    processedTracks: 0,
    progressConversion: null,
    sourceConversion: null,
    totalTracks: 0,
  });
  const queryClient = useQueryClient();
  const latestImport = useQuery({
    queryKey: ["imports-latest"],
    queryFn: getLatestImport,
  });
  const conversion = liveConversion ?? latestImport.data?.conversion ?? null;
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
        cancelledConversion: null,
        completedConversion: null,
        errorMessage: null,
        open: true,
        processedTracks: 0,
        progressConversion: null,
        sourceConversion: conversion,
        totalTracks: conversion?.tracks.length ?? 0,
      });
    },
    onSuccess: (response) => {
      logClientEvent("info", "web.conversion.match.completed", {
        conversionId: response.conversion.id,
        status: response.conversion.status,
        matchCount: response.conversion.matches.length,
        cancelled: response.cancelled === true,
      });
      finishMatchingDialog(response.conversion);
      setMatchDialog((current) => ({
        ...current,
        cancelledConversion:
          response.cancelled === true
            ? (current.cancelledConversion ?? response.conversion)
            : current.cancelledConversion,
        completedConversion:
          response.cancelled === true
            ? current.completedConversion
            : (current.completedConversion ?? response.conversion),
        processedTracks:
          current.processedTracks || response.conversion.matches.length,
        totalTracks: current.totalTracks || response.conversion.tracks.length,
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
  const cancelMatch = useMutation({
    mutationFn: (id: string) => cancelMatchConversion(id),
    onMutate: (id) => {
      logClientEvent("info", "web.conversion.match_cancel.clicked", {
        conversionId: id,
      });
    },
    onSuccess: (response) => {
      logClientEvent("info", "web.conversion.match_cancel.completed", {
        conversionId: response.conversion.id,
        status: response.conversion.status,
        matchCount: response.conversion.matches.length,
      });
      finishMatchingDialog(response.conversion);
      setMatchDialog((current) => ({
        ...current,
        cancelledConversion: response.conversion,
        processedTracks: response.conversion.matches.length,
        progressConversion: response.conversion,
        totalTracks: response.conversion.tracks.length,
      }));
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : String(error);
      logClientEvent("error", "web.conversion.match_cancel.failed", {
        message,
      });
      setMatchDialog((current) => ({
        ...current,
        errorMessage: message,
      }));
    },
  });
  const create = useMutation({
    mutationFn: ({
      id,
      targetPlaylistName,
    }: {
      id: string;
      targetPlaylistName: string;
    }) => createPlaylist(id, { targetPlaylistName }),
    onMutate: ({ id, targetPlaylistName }) => {
      logClientEvent("info", "web.conversion.create.clicked", {
        conversionId: id,
        targetPlaylistName,
      });
    },
    onSuccess: (nextConversion) => {
      logClientEvent("info", "web.conversion.create.completed", {
        conversionId: nextConversion.id,
        playlistId: nextConversion.playlist?.playlistId,
      });
      setLiveConversion(nextConversion);
      queryClient.setQueryData(["imports-latest"], {
        conversion: nextConversion,
      });
    },
    onError: (error) => {
      logClientEvent("error", "web.conversion.create.failed", {
        message: error instanceof Error ? error.message : String(error),
      });
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
  const matchingActive =
    match.isPending &&
    !matchDialog.cancelledConversion &&
    !matchDialog.completedConversion &&
    !matchDialog.errorMessage;
  const matchingInBackground = matchingActive && !matchDialog.open;

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
    events.addEventListener("conversion-match-progress", (event) => {
      const payload = parseConversionEvent(event);

      if (payload?.type !== "conversion-match-progress") {
        return;
      }

      logClientEvent("info", "web.sse.conversion_match_progress", {
        conversionId: payload.conversionId,
        processedTracks: payload.processedTracks,
        totalTracks: payload.totalTracks,
        trackId: payload.match.trackId,
      });
      setLiveConversion(payload.conversion);
      setMatchDialog((current) => ({
        ...current,
        open:
          current.open || current.sourceConversion?.id === payload.conversionId,
        processedTracks: payload.processedTracks,
        progressConversion: payload.conversion,
        totalTracks: payload.totalTracks,
      }));
    });
    events.addEventListener("conversion-match-completed", (event) => {
      const payload = parseConversionEvent(event);

      if (payload?.type !== "conversion-match-completed") {
        return;
      }

      logClientEvent("info", "web.sse.conversion_match_completed", {
        conversionId: payload.conversionId,
        processedTracks: payload.processedTracks,
        totalTracks: payload.totalTracks,
      });
      finishMatchingDialog(payload.conversion);
      setMatchDialog((current) => ({
        ...current,
        completedConversion: payload.conversion,
        open:
          current.open || current.sourceConversion?.id === payload.conversionId,
        processedTracks: payload.processedTracks,
        progressConversion: payload.conversion,
        totalTracks: payload.totalTracks,
      }));
    });
    events.addEventListener("conversion-match-cancelled", (event) => {
      const payload = parseConversionEvent(event);

      if (payload?.type !== "conversion-match-cancelled") {
        return;
      }

      logClientEvent("info", "web.sse.conversion_match_cancelled", {
        conversionId: payload.conversionId,
        processedTracks: payload.processedTracks,
        totalTracks: payload.totalTracks,
      });
      finishMatchingDialog(payload.conversion);
      setMatchDialog((current) => ({
        ...current,
        cancelledConversion: payload.conversion,
        open:
          current.open || current.sourceConversion?.id === payload.conversionId,
        processedTracks: payload.processedTracks,
        progressConversion: payload.conversion,
        totalTracks: payload.totalTracks,
      }));
    });
    events.addEventListener("conversion-match-failed", (event) => {
      const payload = parseConversionEvent(event);

      if (payload?.type !== "conversion-match-failed") {
        return;
      }

      logClientEvent("error", "web.sse.conversion_match_failed", {
        conversionId: payload.conversionId,
        message: payload.message,
      });
      setMatchDialog((current) => ({
        ...current,
        errorMessage: payload.message,
        open:
          current.open || current.sourceConversion?.id === payload.conversionId,
      }));
    });

    return () => {
      logClientEvent("info", "web.sse.closed");
      events.close();
    };
  }, [finishMatchingDialog, queryClient]);

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

      <Card>
        <CardContent className="p-5">
          <PlaylistImportPanel
            creating={create.isPending}
            latestConversion={conversion}
            matching={match.isPending}
            onCreate={(targetPlaylistName) => {
              if (conversion) {
                create.mutate({
                  id: conversion.id,
                  targetPlaylistName,
                });
              }
            }}
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

      {matchingInBackground ? (
        <BackgroundMatchIndicator
          cancelling={cancelMatch.isPending}
          onShow={() =>
            setMatchDialog((current) => ({ ...current, open: true }))
          }
          onStop={() => {
            const activeConversion =
              matchDialog.progressConversion ?? matchDialog.sourceConversion;

            if (activeConversion) {
              cancelMatch.mutate(activeConversion.id);
            }
          }}
          processedTracks={matchDialog.processedTracks}
          totalTracks={matchDialog.totalTracks}
        />
      ) : null}

      <MatchProgressDialog
        cancelledConversion={matchDialog.cancelledConversion}
        cancelling={cancelMatch.isPending}
        completedConversion={matchDialog.completedConversion}
        errorMessage={matchDialog.errorMessage}
        onCancel={(conversionId) => cancelMatch.mutate(conversionId)}
        onOpenChange={(open) =>
          setMatchDialog((current) => ({ ...current, open }))
        }
        open={matchDialog.open}
        processedTracks={matchDialog.processedTracks}
        progressConversion={matchDialog.progressConversion}
        sourceConversion={matchDialog.sourceConversion}
        totalTracks={matchDialog.totalTracks}
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

function BackgroundMatchIndicator({
  cancelling,
  onShow,
  onStop,
  processedTracks,
  totalTracks,
}: {
  cancelling: boolean;
  onShow: () => void;
  onStop: () => void;
  processedTracks: number;
  totalTracks: number;
}) {
  const progressValue =
    totalTracks > 0 ? Math.round((processedTracks / totalTracks) * 100) : 0;

  return (
    <div className="rounded-md border bg-background p-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <CircleDotDashed
              aria-hidden="true"
              className="size-4 text-muted-foreground"
            />
            <p className="font-medium text-foreground text-sm">
              Matching is running in the background
            </p>
          </div>
          <div className="mt-3 flex items-center gap-3">
            <Progress className="max-w-sm" value={progressValue} />
            <span className="shrink-0 text-muted-foreground text-sm">
              {processedTracks}/{totalTracks}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={onShow} variant="secondary">
            <PanelsTopLeft aria-hidden="true" />
            Show matching progress
          </Button>
          <Button disabled={cancelling} onClick={onStop} variant="destructive">
            <CircleStop aria-hidden="true" />
            {cancelling ? "Stopping" : "Stop matching"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function parseConversionEvent(event: MessageEvent<string>) {
  try {
    return JSON.parse(event.data) as ImportEvent;
  } catch {
    return null;
  }
}
