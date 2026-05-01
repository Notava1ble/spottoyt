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
import { useEffect, useMemo, useState } from "react";
import { formatConfidence, formatDuration } from "../../lib/formatters";

type MatchProgressDialogProps = {
  errorMessage?: string | null;
  matchedConversion?: ConversionJob | null;
  onFinished: (conversion: ConversionJob) => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  sourceConversion?: ConversionJob | null;
};

type LogEntry = {
  id: string;
  detail?: string;
  message: string;
  tone: "active" | "done" | "error";
};

type DialogPhase = "matching" | "done" | "failed";

const MATCH_LOG_DELAY_MS = 80;

export function MatchProgressDialog({
  errorMessage,
  matchedConversion,
  onFinished,
  onOpenChange,
  open,
  sourceConversion,
}: MatchProgressDialogProps) {
  const totalTracks = sourceConversion?.tracks.length ?? 0;
  const [phase, setPhase] = useState<DialogPhase>("matching");
  const [processedCount, setProcessedCount] = useState(0);
  const [logs, setLogs] = useState<LogEntry[]>([]);

  const matchLogEntries = useMemo(() => {
    if (!matchedConversion) {
      return [];
    }

    return matchedConversion.tracks.map((track, index) => {
      const match = matchedConversion.matches.find(
        (item) => item.trackId === track.id,
      );

      return buildTrackLogEntry(match, track, index);
    });
  }, [matchedConversion]);

  useEffect(() => {
    if (!open || !sourceConversion) {
      return;
    }

    setPhase("matching");
    setProcessedCount(0);
    setLogs([
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
    ]);
  }, [open, sourceConversion]);

  useEffect(() => {
    if (!(open && errorMessage)) {
      return;
    }

    setPhase("failed");
    setLogs((current) => [
      ...current,
      {
        id: "failed",
        detail: errorMessage,
        message: "Matching failed.",
        tone: "error",
      },
    ]);
  }, [errorMessage, open]);

  useEffect(() => {
    if (!(open && matchedConversion)) {
      return;
    }

    const completedConversion = matchedConversion;

    if (matchLogEntries.length === 0) {
      setLogs((current) => [
        ...current,
        {
          id: "complete",
          detail: "No songs needed matching.",
          message: "Matching complete.",
          tone: "done",
        },
      ]);
      setPhase("done");
      onFinished(completedConversion);
      return;
    }

    let cancelled = false;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    let index = 0;

    function pushNextLog() {
      if (cancelled) {
        return;
      }

      const nextLog = matchLogEntries[index];

      if (nextLog) {
        setLogs((current) => [...current, nextLog]);
        setProcessedCount(index + 1);
        index += 1;
        timeout = setTimeout(pushNextLog, MATCH_LOG_DELAY_MS);
        return;
      }

      setLogs((current) => [
        ...current,
        {
          id: "complete",
          detail: `${completedConversion.matches.length} ${
            completedConversion.matches.length === 1 ? "match" : "matches"
          } ready for review.`,
          message: "Matching complete.",
          tone: "done",
        },
      ]);
      setPhase("done");
      onFinished(completedConversion);
    }

    timeout = setTimeout(pushNextLog, MATCH_LOG_DELAY_MS);

    return () => {
      cancelled = true;
      if (timeout) {
        clearTimeout(timeout);
      }
    };
  }, [matchLogEntries, matchedConversion, onFinished, open]);

  const canClose = phase !== "matching";
  const progressValue =
    phase === "done"
      ? 100
      : totalTracks > 0
        ? Math.round((processedCount / totalTracks) * 100)
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
              {processedCount}/{totalTracks}
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
  match: MatchDecision | undefined,
  track: ConversionJob["tracks"][number],
  index: number,
): LogEntry {
  if (!match?.candidate) {
    return {
      id: `${track.id}-${index}`,
      detail: `${track.artists.join(", ")} - no safe YouTube Music candidate`,
      message: `Skipped ${track.title}.`,
      tone: "done",
    };
  }

  return {
    id: `${track.id}-${index}`,
    detail: `${match.candidate.title} by ${match.candidate.artists.join(
      ", ",
    )} - ${formatConfidence(match.confidence)} confidence - ${
      match.status
    } - ${formatDuration(match.candidate.durationMs)}`,
    message: `Matched ${track.title}.`,
    tone: "done",
  };
}
