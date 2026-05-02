import type { ConversionJob } from "@spottoyt/shared";
import { Badge } from "@spottoyt/ui/components/badge";
import { Button } from "@spottoyt/ui/components/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@spottoyt/ui/components/card";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink } from "lucide-react";
import { getConversionLibrary } from "../lib/apiClient";

export function HistoryPage() {
  const library = useQuery({
    queryKey: ["conversions"],
    queryFn: getConversionLibrary,
  });
  const conversions = library.data?.conversions ?? [];

  return (
    <section className="flex flex-col gap-6">
      <div>
        <h1 className="font-semibold text-3xl text-foreground">Library</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Converted playlists and future maintenance live here. Refreshes can
          compare Spotify changes against the local conversion snapshot.
        </p>
      </div>
      {library.isLoading ? (
        <Card>
          <CardContent>
            <p className="text-muted-foreground text-sm">Loading library</p>
          </CardContent>
        </Card>
      ) : conversions.length > 0 ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {conversions.map((conversion) => (
            <LibraryCard conversion={conversion} key={conversion.id} />
          ))}
        </div>
      ) : (
        <Card>
          <CardContent>
            <p className="font-medium text-foreground">No conversions yet</p>
            <p className="mt-1 text-muted-foreground text-sm">
              Imported and reviewed playlists will appear here after Spicetify
              sends a snapshot.
            </p>
          </CardContent>
        </Card>
      )}
    </section>
  );
}

function LibraryCard({ conversion }: { conversion: ConversionJob }) {
  const accepted = conversion.matches.filter(
    (match) => match.status === "accepted",
  ).length;
  const review = conversion.matches.filter(
    (match) => match.status === "review",
  ).length;
  const skipped = conversion.matches.filter(
    (match) => match.status === "skipped",
  ).length;

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-4">
        <div className="min-w-0">
          <CardTitle>{conversion.sourcePlaylistName}</CardTitle>
          <p className="mt-1 text-muted-foreground text-sm">
            Updated {formatLibraryDate(conversion.updatedAt)}
          </p>
        </div>
        <Badge
          variant={conversion.status === "complete" ? "default" : "secondary"}
        >
          {conversion.status}
        </Badge>
      </CardHeader>
      <CardContent className="grid gap-3">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Metric label="tracks" value={conversion.tracks.length} />
          <Metric label="accepted" value={accepted} />
          <Metric label="review" value={review} />
          <Metric label="skipped" value={skipped} />
        </div>
        {conversion.playlist ? (
          <p className="text-muted-foreground text-sm">
            Created {conversion.playlist.createdTrackCount} tracks, skipped{" "}
            {conversion.playlist.skippedTrackCount}.
          </p>
        ) : (
          <p className="text-muted-foreground text-sm">
            Target playlist: {conversion.targetPlaylistName}
          </p>
        )}
      </CardContent>
      {conversion.playlist ? (
        <CardFooter className="justify-end">
          <Button asChild size="sm" variant="secondary">
            <a
              href={conversion.playlist.playlistUrl}
              rel="noreferrer"
              target="_blank"
            >
              <ExternalLink aria-hidden="true" data-icon="inline-start" />
              Open YouTube Music playlist
            </a>
          </Button>
        </CardFooter>
      ) : null}
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border bg-background px-3 py-2">
      <p className="font-medium text-foreground">
        {value} {label}
      </p>
    </div>
  );
}

function formatLibraryDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
