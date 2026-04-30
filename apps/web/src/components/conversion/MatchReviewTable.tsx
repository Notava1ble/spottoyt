import type { ConversionJob, MatchDecision } from "@spottoyt/shared";
import { Badge } from "@spottoyt/ui/components/badge";
import { Button } from "@spottoyt/ui/components/button";
import { Card } from "@spottoyt/ui/components/card";
import { Check, CircleSlash, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { formatConfidence, formatDuration } from "../../lib/formatters";
import { logClientEvent } from "../../lib/logger";

type MatchReviewTableProps = {
  conversion?: ConversionJob | null;
};

export function MatchReviewTable({ conversion }: MatchReviewTableProps) {
  const [matches, setMatches] = useState<MatchDecision[]>(
    () => conversion?.matches ?? [],
  );

  useEffect(() => {
    setMatches(conversion?.matches ?? []);
  }, [conversion]);

  if (!conversion) {
    return null;
  }

  const conversionId = conversion.id;

  function updateDecision(trackId: string, status: MatchDecision["status"]) {
    logClientEvent("info", "web.decision.changed", {
      conversionId,
      trackId,
      status,
    });
    setMatches((current) =>
      current.map((match) =>
        match.trackId === trackId ? { ...match, status } : match,
      ),
    );
  }

  return (
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
                  aria-label="Accept match"
                  disabled={!match}
                  onClick={() => updateDecision(track.id, "accepted")}
                  size="icon"
                  variant={
                    match?.status === "accepted" ? "default" : "secondary"
                  }
                >
                  <Check data-icon="inline-start" aria-hidden="true" />
                </Button>
                <Button
                  aria-label="Search replacement"
                  disabled={!match}
                  onClick={() => updateDecision(track.id, "review")}
                  size="icon"
                  variant="ghost"
                >
                  <Search data-icon="inline-start" aria-hidden="true" />
                </Button>
                <Button
                  aria-label="Skip track"
                  disabled={!match}
                  onClick={() => updateDecision(track.id, "skipped")}
                  size="icon"
                  variant={match?.status === "skipped" ? "secondary" : "ghost"}
                >
                  <CircleSlash data-icon="inline-start" aria-hidden="true" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
