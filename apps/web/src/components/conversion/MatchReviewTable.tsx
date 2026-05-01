import type { ConversionJob, MatchDecision } from "@spottoyt/shared";
import { Badge } from "@spottoyt/ui/components/badge";
import { Button } from "@spottoyt/ui/components/button";
import { Card } from "@spottoyt/ui/components/card";
import { useMutation } from "@tanstack/react-query";
import { Check, CircleSlash, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { updateMatchStatus } from "../../lib/apiClient";
import { formatConfidence, formatDuration } from "../../lib/formatters";
import { logClientEvent } from "../../lib/logger";
import { ManualMatchDialog } from "./ManualMatchDialog";

type MatchReviewTableProps = {
  conversion?: ConversionJob | null;
  onConversionChange?: (conversion: ConversionJob) => void;
};

export function MatchReviewTable({
  conversion,
  onConversionChange,
}: MatchReviewTableProps) {
  const [matches, setMatches] = useState<MatchDecision[]>(
    () => conversion?.matches ?? [],
  );
  const [manualTrackId, setManualTrackId] = useState<string | null>(null);
  const conversionId = conversion?.id ?? "";
  const updateStatus = useMutation({
    mutationFn: ({
      status,
      trackId,
    }: {
      status: MatchDecision["status"];
      trackId: string;
    }) => updateMatchStatus(conversionId, trackId, status),
    onSuccess: (response) => {
      setMatches(response.conversion.matches);
      onConversionChange?.(response.conversion);
    },
    onError: (error) => {
      logClientEvent("error", "web.decision.change.failed", {
        conversionId,
        message: error instanceof Error ? error.message : String(error),
      });
    },
  });

  useEffect(() => {
    setMatches(conversion?.matches ?? []);
  }, [conversion]);

  if (!conversion) {
    return null;
  }

  function syncConversion(nextConversion: ConversionJob) {
    setMatches(nextConversion.matches);
    onConversionChange?.(nextConversion);
  }

  function updateDecision(trackId: string, status: MatchDecision["status"]) {
    logClientEvent("info", "web.decision.changed", {
      conversionId,
      trackId,
      status,
    });
    updateStatus.mutate({ status, trackId });
  }

  function toggleAccepted(trackId: string, match?: MatchDecision) {
    updateDecision(
      trackId,
      match?.status === "accepted" ? "review" : "accepted",
    );
  }

  function searchReplacement(trackId: string) {
    logClientEvent("info", "web.decision.search.clicked", {
      conversionId,
      trackId,
    });
    setManualTrackId(trackId);
  }

  const manualTrack =
    conversion.tracks.find((track) => track.id === manualTrackId) ?? null;

  return (
    <>
      <Card className="overflow-hidden">
        <div className="grid min-w-[760px] grid-cols-[1.4fr_1.4fr_8rem_12rem] border-b px-5 py-3 text-muted-foreground text-xs uppercase tracking-wide">
          <span>Spotify track</span>
          <span>YouTube Music match</span>
          <span>Confidence</span>
          <span className="text-right">Decision</span>
        </div>
        <div className="overflow-x-auto">
          {conversion.tracks.map((track) => {
            const match = matches.find((item) => item.trackId === track.id);
            const variant =
              match && match.confidence > 0.9 ? "default" : "secondary";

            return (
              <div
                className="grid min-w-[760px] grid-cols-[1.4fr_1.4fr_8rem_12rem] items-center gap-4 border-b px-5 py-4 last:border-b-0"
                key={track.id}
              >
                <div>
                  <p className="font-medium text-foreground">{track.title}</p>
                  <p className="text-muted-foreground text-sm">
                    {track.artists.join(", ")} -{" "}
                    {formatDuration(track.durationMs)}
                  </p>
                </div>
                <div>
                  {match?.candidate ? (
                    <>
                      <p className="font-medium text-foreground">
                        {match.candidate.title}
                      </p>
                      <p className="text-muted-foreground text-sm">
                        {match.candidate.artists.join(", ")} -{" "}
                        {formatDuration(match.candidate.durationMs)}
                      </p>
                    </>
                  ) : match?.status === "skipped" ? (
                    <>
                      <p className="font-medium text-muted-foreground">
                        No safe match
                      </p>
                      <p className="text-muted-foreground text-sm">
                        This track needs a manual search later.
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="font-medium text-muted-foreground">
                        Awaiting match
                      </p>
                      <p className="text-muted-foreground text-sm">
                        This imported track has no candidate yet.
                      </p>
                    </>
                  )}
                </div>
                <Badge variant={variant}>
                  {match ? formatConfidence(match.confidence) : "Pending"}
                </Badge>
                <div className="flex justify-end gap-2">
                  <Button
                    aria-label={
                      match?.status === "accepted"
                        ? "Unselect match"
                        : "Accept match"
                    }
                    disabled={!match?.candidate || updateStatus.isPending}
                    onClick={() => toggleAccepted(track.id, match)}
                    size="icon"
                    variant={
                      match?.status === "accepted" ? "default" : "secondary"
                    }
                  >
                    <Check data-icon="inline-start" aria-hidden="true" />
                  </Button>
                  <Button
                    aria-label="Search replacement"
                    onClick={() => searchReplacement(track.id)}
                    size="icon"
                    variant="ghost"
                  >
                    <Search data-icon="inline-start" aria-hidden="true" />
                  </Button>
                  <Button
                    aria-label="Skip track"
                    disabled={updateStatus.isPending}
                    onClick={() => updateDecision(track.id, "skipped")}
                    size="icon"
                    variant={
                      match?.status === "skipped" ? "secondary" : "ghost"
                    }
                  >
                    <CircleSlash data-icon="inline-start" aria-hidden="true" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </Card>
      <ManualMatchDialog
        conversionId={conversionId}
        onConversionChange={syncConversion}
        onOpenChange={(open) => {
          if (!open) {
            setManualTrackId(null);
          }
        }}
        open={manualTrack !== null}
        track={manualTrack}
      />
    </>
  );
}
