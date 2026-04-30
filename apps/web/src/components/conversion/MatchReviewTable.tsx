import type { ConversionJob } from "@spottoyt/shared";
import { Badge } from "@spottoyt/ui/components/badge";
import { Button } from "@spottoyt/ui/components/button";
import { Card } from "@spottoyt/ui/components/card";
import { Check, CircleSlash, Search } from "lucide-react";
import { formatConfidence, formatDuration } from "../../lib/formatters";
import { shellConversion } from "../../lib/mockData";

type MatchReviewTableProps = {
  conversion?: ConversionJob | null;
};

export function MatchReviewTable({ conversion }: MatchReviewTableProps) {
  const activeConversion = conversion ?? shellConversion;

  return (
    <Card className="overflow-hidden">
      <div className="grid min-w-[760px] grid-cols-[1.4fr_1.4fr_8rem_12rem] border-b px-5 py-3 text-muted-foreground text-xs uppercase tracking-wide">
        <span>Spotify track</span>
        <span>YouTube Music match</span>
        <span>Confidence</span>
        <span className="text-right">Decision</span>
      </div>
      <div className="overflow-x-auto">
        {activeConversion.tracks.map((track) => {
          const match = activeConversion.matches.find(
            (item) => item.trackId === track.id,
          );
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
                  {track.artists.join(", ")} - {formatDuration(track.durationMs)}
                </p>
              </div>
              <div>
                {match ? (
                  <>
                    <p className="font-medium text-foreground">
                      {match.candidate.title}
                    </p>
                    <p className="text-muted-foreground text-sm">
                      {match.candidate.artists.join(", ")} -{" "}
                      {formatDuration(match.candidate.durationMs)}
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
                  size="icon"
                  variant="secondary"
                >
                  <Check data-icon="inline-start" aria-hidden="true" />
                </Button>
                <Button
                  aria-label="Search replacement"
                  disabled={!match}
                  size="icon"
                  variant="ghost"
                >
                  <Search data-icon="inline-start" aria-hidden="true" />
                </Button>
                <Button
                  aria-label="Skip track"
                  disabled={!match}
                  size="icon"
                  variant="ghost"
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
