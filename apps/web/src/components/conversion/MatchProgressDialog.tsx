import type { ConversionJob, MatchDecision } from "@spottoyt/shared";
import { Badge } from "@spottoyt/ui/components/badge";
import { Button } from "@spottoyt/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@spottoyt/ui/components/dialog";
import { Progress } from "@spottoyt/ui/components/progress";
import { CheckCircle2, CircleAlert, CircleDotDashed } from "lucide-react";
import { useMemo } from "react";
import { formatConfidence, formatDuration } from "../../lib/formatters";

type MatchProgressDialogProps = {
  completedConversion?: ConversionJob | null;
  errorMessage?: string | null;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  processedTracks?: number;
  progressConversion?: ConversionJob | null;
  sourceConversion?: ConversionJob | null;
  totalTracks?: number;
};

type LogEntry = {
  id: string;
  detail?: string;
  message: string;
  tone: "active" | "done" | "error";
};

type DialogPhase = "matching" | "done" | "failed";

export function MatchProgressDialog({
  completedConversion,
  errorMessage,
  onOpenChange,
  open,
  processedTracks,
  progressConversion,
  sourceConversion,
  totalTracks,
}: MatchProgressDialogProps) {
  const activeConversion =
    completedConversion ?? progressConversion ?? sourceConversion ?? null;
  const visibleTotalTracks =
    totalTracks ??
    sourceConversion?.tracks.length ??
    activeConversion?.tracks.length ??
    0;
  const visibleProcessedTracks =
    processedTracks ??
    completedConversion?.matches.length ??
    progressConversion?.matches.length ??
    0;
  const phase: DialogPhase = errorMessage
    ? "failed"
    : completedConversion
      ? "done"
      : "matching";
  const logs = useMemo(
    () =>
      buildLogs({
        activeConversion,
        completedConversion,
        errorMessage,
        sourceConversion,
      }),
    [activeConversion, completedConversion, errorMessage, sourceConversion],
  );
  const canClose = phase !== "matching";
  const progressValue =
    phase === "done"
      ? 100
      : visibleTotalTracks > 0
        ? Math.round((visibleProcessedTracks / visibleTotalTracks) * 100)
        : 0;

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (nextOpen || canClose) {
          onOpenChange(nextOpen);
        }
      }}
    >
      <DialogContent
        onEscapeKeyDown={(event) => {
          if (!canClose) {
            event.preventDefault();
          }
        }}
        onInteractOutside={(event) => {
          if (!canClose) {
            event.preventDefault();
          }
        }}
      >
        <DialogHeader>
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-col gap-1.5">
              <DialogTitle>Matching with YouTube Music</DialogTitle>
              <DialogDescription>
                {phase === "done"
                  ? "Done. Close this dialog to review and adjust the matches."
                  : phase === "failed"
                    ? "The match did not finish. Check the log below before trying again."
                    : "Searching YouTube Music and preparing review decisions."}
              </DialogDescription>
            </div>
            <Badge variant={phase === "done" ? "default" : "secondary"}>
              {visibleProcessedTracks}/{visibleTotalTracks}
            </Badge>
          </div>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <Progress value={progressValue} />
          <div className="flex items-center justify-between gap-3 text-muted-foreground text-sm">
            <span>
              {phase === "done"
                ? "Ready for review"
                : phase === "failed"
                  ? "Stopped"
                  : "Matching songs"}
            </span>
            <span>{progressValue}%</span>
          </div>
        </div>

        <div className="max-h-80 overflow-y-auto rounded-md border bg-background">
          <div className="flex flex-col">
            {logs.map((log) => (
              <div
                className="flex gap-3 border-b px-4 py-3 last:border-b-0"
                key={log.id}
              >
                <LogIcon tone={log.tone} />
                <div className="min-w-0">
                  <p className="font-medium text-foreground text-sm">
                    {log.message}
                  </p>
                  {log.detail ? (
                    <p className="text-muted-foreground text-sm">
                      {log.detail}
                    </p>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </div>

        {phase === "done" ? (
          <div className="rounded-md border bg-background p-4">
            <p className="font-medium text-foreground">Done</p>
            <p className="mt-1 text-muted-foreground text-sm">
              Matches are loaded into the review table. Close this dialog to
              inspect confidence, accept good matches, or search replacements.
            </p>
          </div>
        ) : null}

        <DialogFooter>
          <Button disabled={!canClose} onClick={() => onOpenChange(false)}>
            {phase === "done" ? "View results" : "Close"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function buildLogs({
  activeConversion,
  completedConversion,
  errorMessage,
  sourceConversion,
}: {
  activeConversion?: ConversionJob | null;
  completedConversion?: ConversionJob | null;
  errorMessage?: string | null;
  sourceConversion?: ConversionJob | null;
}) {
  const entries: LogEntry[] = [];

  if (sourceConversion) {
    entries.push(
      {
        id: "start",
        message: "Starting YouTube Music match.",
        tone: "active",
      },
      {
        id: "queued",
        detail: sourceConversion.sourcePlaylistName,
        message: `${sourceConversion.tracks.length} ${
          sourceConversion.tracks.length === 1 ? "song" : "songs"
        } queued.`,
        tone: "active",
      },
    );
  }

  if (activeConversion) {
    entries.push(
      ...activeConversion.matches.map((match, index) => {
        const track = activeConversion.tracks.find(
          (item) => item.id === match.trackId,
        );

        return buildTrackLogEntry(match, track, index);
      }),
    );
  }

  if (errorMessage) {
    entries.push({
      id: "failed",
      detail: errorMessage,
      message: "Matching failed.",
      tone: "error",
    });
  } else if (completedConversion) {
    entries.push({
      id: "complete",
      detail: `${completedConversion.matches.length} ${
        completedConversion.matches.length === 1 ? "match" : "matches"
      } ready for review.`,
      message: "Matching complete.",
      tone: "done",
    });
  }

  return entries;
}

function LogIcon({ tone }: { tone: LogEntry["tone"] }) {
  if (tone === "done") {
    return <CheckCircle2 className="mt-0.5 text-primary" aria-hidden="true" />;
  }

  if (tone === "error") {
    return (
      <CircleAlert className="mt-0.5 text-destructive" aria-hidden="true" />
    );
  }

  return (
    <CircleDotDashed
      className="mt-0.5 text-muted-foreground"
      aria-hidden="true"
    />
  );
}

function buildTrackLogEntry(
  match: MatchDecision,
  track: ConversionJob["tracks"][number] | undefined,
  index: number,
): LogEntry {
  if (!match.candidate) {
    return {
      id: `${match.trackId}-${index}`,
      detail: `${
        track?.artists.join(", ") ?? "Unknown artist"
      } - no safe YouTube Music candidate`,
      message: `Skipped ${track?.title ?? match.trackId}.`,
      tone: "done",
    };
  }

  return {
    id: `${match.trackId}-${index}`,
    detail: `${match.candidate.title} by ${match.candidate.artists.join(
      ", ",
    )} - ${formatConfidence(match.confidence)} confidence - ${
      match.status
    } - ${formatDuration(match.candidate.durationMs)}`,
    message: `Matched ${track?.title ?? match.trackId}.`,
    tone: "done",
  };
}
