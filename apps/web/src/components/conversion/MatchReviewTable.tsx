import { Check, CircleSlash, Search } from "lucide-react";
import { formatConfidence, formatDuration } from "../../lib/formatters";
import { shellConversion } from "../../lib/mockData";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card } from "../ui/card";

export function MatchReviewTable() {
  return (
    <Card className="overflow-hidden">
      <div className="grid min-w-[760px] grid-cols-[1.4fr_1.4fr_8rem_12rem] border-stone-800 border-b px-5 py-3 text-stone-400 text-xs uppercase tracking-wide">
        <span>Spotify track</span>
        <span>YouTube Music match</span>
        <span>Confidence</span>
        <span className="text-right">Decision</span>
      </div>
      <div className="overflow-x-auto">
        {shellConversion.matches.map((match) => {
          const track = shellConversion.tracks.find(
            (item) => item.id === match.trackId,
          );
          const tone = match.confidence > 0.9 ? "success" : "warning";

          return (
            <div
              className="grid min-w-[760px] grid-cols-[1.4fr_1.4fr_8rem_12rem] items-center gap-4 border-stone-800 border-b px-5 py-4 last:border-b-0"
              key={match.trackId}
            >
              <div>
                <p className="font-medium text-stone-100">{track?.title}</p>
                <p className="text-sm text-stone-400">
                  {track?.artists.join(", ")} ·{" "}
                  {track ? formatDuration(track.durationMs) : ""}
                </p>
              </div>
              <div>
                <p className="font-medium text-stone-100">
                  {match.candidate.title}
                </p>
                <p className="text-sm text-stone-400">
                  {match.candidate.artists.join(", ")} ·{" "}
                  {formatDuration(match.candidate.durationMs)}
                </p>
              </div>
              <Badge tone={tone}>{formatConfidence(match.confidence)}</Badge>
              <div className="flex justify-end gap-2">
                <Button
                  size="icon"
                  variant="secondary"
                  aria-label="Accept match"
                >
                  <Check className="h-4 w-4" aria-hidden="true" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label="Search replacement"
                >
                  <Search className="h-4 w-4" aria-hidden="true" />
                </Button>
                <Button size="icon" variant="ghost" aria-label="Skip track">
                  <CircleSlash className="h-4 w-4" aria-hidden="true" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
