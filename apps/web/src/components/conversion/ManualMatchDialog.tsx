import type {
  ConversionJob,
  SpotifyTrack,
  YtmusicCandidate,
} from "@spottoyt/shared";
import { Badge } from "@spottoyt/ui/components/badge";
import { Button } from "@spottoyt/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@spottoyt/ui/components/dialog";
import { Input } from "@spottoyt/ui/components/input";
import { useMutation } from "@tanstack/react-query";
import { Link, Search } from "lucide-react";
import { useEffect, useState } from "react";
import {
  searchManualTrackCandidates,
  selectManualTrackMatch,
  selectManualTrackMatchFromLink,
} from "../../lib/apiClient";
import { formatDuration } from "../../lib/formatters";
import { logClientEvent } from "../../lib/logger";

type ManualMatchDialogProps = {
  conversionId: string;
  onConversionChange: (conversion: ConversionJob) => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  track: SpotifyTrack | null;
};

type SearchRequest = {
  query: string;
  trackId: string;
};

export function ManualMatchDialog({
  conversionId,
  onConversionChange,
  onOpenChange,
  open,
  track,
}: ManualMatchDialogProps) {
  const [query, setQuery] = useState("");
  const [candidates, setCandidates] = useState<YtmusicCandidate[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [youtubeLink, setYoutubeLink] = useState("");
  const searchCandidates = useMutation({
    mutationFn: ({ query, trackId }: SearchRequest) =>
      searchManualTrackCandidates(conversionId, trackId, query),
    onSuccess: (response) => {
      setCandidates(response.candidates);
      setQuery(response.query);
      setErrorMessage(null);
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : String(error);
      setErrorMessage("Search failed.");
      logClientEvent("error", "web.manual_search.failed", {
        conversionId,
        message,
        trackId: track?.id,
      });
    },
  });
  const selectCandidate = useMutation({
    mutationFn: (candidate: YtmusicCandidate) => {
      if (!track) {
        throw new Error("No track selected.");
      }

      return selectManualTrackMatch(conversionId, track.id, candidate);
    },
    onSuccess: (response) => {
      onConversionChange(response.conversion);
      onOpenChange(false);
      setErrorMessage(null);
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : String(error);
      setErrorMessage("Selection failed.");
      logClientEvent("error", "web.manual_select.failed", {
        conversionId,
        message,
        trackId: track?.id,
      });
    },
  });
  const selectLink = useMutation({
    mutationFn: (url: string) => {
      if (!track) {
        throw new Error("No track selected.");
      }

      return selectManualTrackMatchFromLink(conversionId, track.id, { url });
    },
    onSuccess: (response) => {
      onConversionChange(response.conversion);
      onOpenChange(false);
      setErrorMessage(null);
      setYoutubeLink("");
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : String(error);
      setErrorMessage("Link selection failed.");
      logClientEvent("error", "web.manual_link_select.failed", {
        conversionId,
        message,
        trackId: track?.id,
      });
    },
  });

  useEffect(() => {
    if (!open || !track) {
      return;
    }

    const nextQuery = defaultSearchQuery(track);
    setQuery(nextQuery);
    setCandidates([]);
    setErrorMessage(null);
    setYoutubeLink("");
    searchCandidates.mutate({ query: nextQuery, trackId: track.id });
  }, [open, track, searchCandidates.mutate]);

  function handleSearch() {
    const nextQuery = query.trim();

    if (!track || nextQuery.length === 0) {
      return;
    }

    logClientEvent("info", "web.manual_search.clicked", {
      conversionId,
      query: nextQuery,
      trackId: track.id,
    });
    searchCandidates.mutate({ query: nextQuery, trackId: track.id });
  }

  function handleUseLink() {
    const nextLink = youtubeLink.trim();

    if (!track || nextLink.length === 0) {
      return;
    }

    logClientEvent("info", "web.manual_link_select.clicked", {
      conversionId,
      trackId: track.id,
    });
    selectLink.mutate(nextLink);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Manual YouTube Music search</DialogTitle>
          <DialogDescription>
            {track
              ? `${track.title} by ${track.artists.join(", ")}`
              : "Choose a Spotify track."}
          </DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-2 sm:flex-row sm:items-end"
          onSubmit={(event) => {
            event.preventDefault();
            handleSearch();
          }}
        >
          <label className="grid flex-1 gap-1" htmlFor="manual-search-query">
            <span className="font-medium text-foreground text-sm">
              Search string
            </span>
            <Input
              disabled={!track || searchCandidates.isPending}
              id="manual-search-query"
              onChange={(event) => setQuery(event.target.value)}
              value={query}
            />
          </label>
          <Button
            disabled={
              !track ||
              query.trim().length === 0 ||
              searchCandidates.isPending ||
              selectCandidate.isPending
            }
            type="submit"
          >
            <Search data-icon="inline-start" aria-hidden="true" />
            {searchCandidates.isPending ? "Searching" : "Search YouTube Music"}
          </Button>
        </form>
        {errorMessage ? (
          <p className="text-destructive text-sm">{errorMessage}</p>
        ) : null}
        <form
          className="flex flex-col gap-2 rounded-md border bg-background p-3 sm:flex-row sm:items-end"
          onSubmit={(event) => {
            event.preventDefault();
            handleUseLink();
          }}
        >
          <label className="grid flex-1 gap-1" htmlFor="manual-youtube-link">
            <span className="font-medium text-foreground text-sm">
              YouTube Music link
            </span>
            <Input
              disabled={!track || selectLink.isPending}
              id="manual-youtube-link"
              onChange={(event) => setYoutubeLink(event.target.value)}
              placeholder="https://music.youtube.com/watch?v=..."
              value={youtubeLink}
            />
          </label>
          <Button
            disabled={
              !track ||
              youtubeLink.trim().length === 0 ||
              selectCandidate.isPending ||
              selectLink.isPending
            }
            type="submit"
            variant="secondary"
          >
            <Link data-icon="inline-start" aria-hidden="true" />
            {selectLink.isPending ? "Using link" : "Use link"}
          </Button>
        </form>
        <div className="max-h-80 overflow-y-auto rounded-md border">
          {candidates.length > 0 ? (
            candidates.map((candidate) => (
              <div
                className="flex flex-col gap-3 border-b p-3 last:border-b-0 sm:flex-row sm:items-center sm:justify-between"
                key={candidate.videoId}
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate font-medium text-foreground">
                      {candidate.title}
                    </p>
                    <Badge variant="secondary">{candidate.resultType}</Badge>
                  </div>
                  <p className="text-muted-foreground text-sm">
                    {candidate.artists.join(", ")} -{" "}
                    {formatDuration(candidate.durationMs)}
                  </p>
                </div>
                <Button
                  aria-label={`Select ${candidate.title}`}
                  disabled={selectCandidate.isPending}
                  onClick={() => selectCandidate.mutate(candidate)}
                  size="sm"
                  type="button"
                  variant="secondary"
                >
                  Select
                </Button>
              </div>
            ))
          ) : (
            <p className="p-3 text-muted-foreground text-sm">
              {searchCandidates.isPending ? "Searching" : "No results found"}
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function defaultSearchQuery(track: SpotifyTrack) {
  return [track.title, ...track.artists].join(" ").trim();
}
