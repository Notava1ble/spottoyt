import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@spottoyt/ui/components/card";
import { Button } from "@spottoyt/ui/components/button";
import { Input } from "@spottoyt/ui/components/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@spottoyt/ui/components/dialog";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Cable, Radio } from "lucide-react";
import { useEffect, useState } from "react";
import { AccountConnectionCard } from "../components/auth/AccountConnectionCard";
import {
  disconnectYoutubeMusic,
  getAccountStatus,
  getLatestImport,
  getMatchingSettings,
  setupYoutubeMusicBrowserHeaders,
  updateMatchingSettings,
} from "../lib/apiClient";

const settings = [
  ["Spicetify API target", "http://127.0.0.1:4317/imports/spicetify"],
  ["Spicetify events", "http://127.0.0.1:4317/events"],
  ["SQLite database", "./data/spottoyt.sqlite"],
  ["YouTube Music auth", "./auth/ytmusic-oauth.json"],
];

export function SettingsPage() {
  const queryClient = useQueryClient();
  const matchingSettings = useQuery({
    queryKey: ["matching-settings"],
    queryFn: getMatchingSettings,
  });
  const accountStatus = useQuery({
    queryKey: ["auth-status"],
    queryFn: getAccountStatus,
  });
  const latestImport = useQuery({
    queryKey: ["imports-latest"],
    queryFn: getLatestImport,
  });
  const [draft, setDraft] = useState({
    autoAcceptThreshold: "",
    includeVideos: true,
    reviewThreshold: "",
    searchLimit: "",
  });
  const [authDialogOpen, setAuthDialogOpen] = useState(false);
  const [headersRaw, setHeadersRaw] = useState("");
  const saveMatchingSettings = useMutation({
    mutationFn: () =>
      updateMatchingSettings({
        autoAcceptThreshold: percentToRatio(draft.autoAcceptThreshold),
        includeVideos: draft.includeVideos,
        reviewThreshold: percentToRatio(draft.reviewThreshold),
        searchLimit: Number(draft.searchLimit),
      }),
    onSuccess: (response) => {
      queryClient.setQueryData(["matching-settings"], response);
      setDraft(toDraft(response.settings));
    },
  });
  const saveYoutubeMusicAuth = useMutation({
    mutationFn: () =>
      setupYoutubeMusicBrowserHeaders({ headersRaw: headersRaw.trim() }),
    onSuccess: (response) => {
      queryClient.setQueryData(["auth-status"], response);
      setHeadersRaw("");
      setAuthDialogOpen(false);
    },
  });
  const disconnectAuth = useMutation({
    mutationFn: disconnectYoutubeMusic,
    onSuccess: (response) => {
      queryClient.setQueryData(["auth-status"], response);
    },
  });

  useEffect(() => {
    if (matchingSettings.data) {
      setDraft(toDraft(matchingSettings.data.settings));
    }
  }, [matchingSettings.data]);

  return (
    <section className="flex flex-col gap-6">
      <div>
        <h1 className="font-semibold text-3xl text-foreground">Settings</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Local paths and bridge endpoints stay explicit so credentials are easy
          to audit.
        </p>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <AccountConnectionCard
          Icon={Cable}
          name="Spotify Desktop"
          status={latestImport.data?.conversion ? "connected" : "not-connected"}
          actionLabel={latestImport.data?.conversion ? "Imported" : "Waiting"}
          detail={
            latestImport.data?.conversion
              ? `${latestImport.data.conversion.sourcePlaylistName} is loaded from Spicetify.`
              : "Waiting for the Spicetify extension to send a playlist."
          }
          disabled
        />
        <AccountConnectionCard
          Icon={Radio}
          name="YouTube Music"
          status={
            accountStatus.data?.youtubeMusic.connected
              ? "connected"
              : "not-connected"
          }
          actionLabel={
            accountStatus.data?.youtubeMusic.connected
              ? "Disconnect"
              : "Connect YouTube Music"
          }
          detail={
            accountStatus.data?.youtubeMusic.connected
              ? "Browser credentials are available locally."
              : accountStatus.data?.youtubeMusic.configured
                ? "Stored browser credentials need to be refreshed."
                : "Paste browser request headers to enable playlist creation."
          }
          disabled={
            accountStatus.isLoading ||
            saveYoutubeMusicAuth.isPending ||
            disconnectAuth.isPending
          }
          onAction={() => {
            if (accountStatus.data?.youtubeMusic.connected) {
              disconnectAuth.mutate();
              return;
            }

            setAuthDialogOpen(true);
          }}
        />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Local configuration</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          <div className="flex flex-col gap-2 rounded-lg bg-background px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <span className="text-muted-foreground text-sm">
                Spotify import
              </span>
              <p className="font-medium text-foreground">Spicetify bridge</p>
            </div>
            <span className="font-medium text-muted-foreground text-sm">
              Desktop context menu
            </span>
          </div>
          {settings.map(([label, value]) => (
            <div
              className="grid gap-1 rounded-lg bg-background px-4 py-3"
              key={label}
            >
              <span className="text-muted-foreground text-sm">{label}</span>
              <code className="break-all text-primary text-sm">{value}</code>
            </div>
          ))}
        </CardContent>
      </Card>
      <Dialog open={authDialogOpen} onOpenChange={setAuthDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Connect YouTube Music</DialogTitle>
            <DialogDescription>
              Paste copied request headers from an authenticated YouTube Music
              browser request.
            </DialogDescription>
          </DialogHeader>
          <label className="grid gap-2" htmlFor="youtube-music-headers">
            <span className="font-medium text-foreground text-sm">
              Request headers
            </span>
            <textarea
              className="min-h-44 rounded-md border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              id="youtube-music-headers"
              onChange={(event) => setHeadersRaw(event.target.value)}
              value={headersRaw}
            />
          </label>
          {saveYoutubeMusicAuth.isError ? (
            <p className="text-destructive text-sm">
              YouTube Music connection failed.
            </p>
          ) : null}
          <DialogFooter>
            <Button
              onClick={() => setAuthDialogOpen(false)}
              type="button"
              variant="secondary"
            >
              Cancel
            </Button>
            <Button
              disabled={
                headersRaw.trim().length === 0 || saveYoutubeMusicAuth.isPending
              }
              onClick={() => saveYoutubeMusicAuth.mutate()}
              type="button"
            >
              Save connection
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Card>
        <CardHeader>
          <CardTitle>Matching</CardTitle>
        </CardHeader>
        {matchingSettings.data ? (
          <>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-1" htmlFor="auto-accept-threshold">
                <span className="font-medium text-foreground text-sm">
                  Auto-accept
                </span>
                <Input
                  id="auto-accept-threshold"
                  inputMode="numeric"
                  max={100}
                  min={50}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      autoAcceptThreshold: event.target.value,
                    }))
                  }
                  type="number"
                  value={draft.autoAcceptThreshold}
                />
              </label>
              <label className="grid gap-1" htmlFor="review-threshold">
                <span className="font-medium text-foreground text-sm">
                  Review floor
                </span>
                <Input
                  id="review-threshold"
                  inputMode="numeric"
                  max={95}
                  min={20}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      reviewThreshold: event.target.value,
                    }))
                  }
                  type="number"
                  value={draft.reviewThreshold}
                />
              </label>
              <label className="grid gap-1" htmlFor="search-limit">
                <span className="font-medium text-foreground text-sm">
                  Search limit
                </span>
                <Input
                  id="search-limit"
                  inputMode="numeric"
                  max={20}
                  min={3}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      searchLimit: event.target.value,
                    }))
                  }
                  type="number"
                  value={draft.searchLimit}
                />
              </label>
              <label
                className="flex min-h-16 items-center gap-3 rounded-lg bg-background px-3 py-2"
                htmlFor="include-videos"
              >
                <input
                  checked={draft.includeVideos}
                  className="size-4 accent-current"
                  id="include-videos"
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      includeVideos: event.target.checked,
                    }))
                  }
                  type="checkbox"
                />
                <span className="font-medium text-foreground text-sm">
                  Include video results
                </span>
              </label>
            </CardContent>
            <CardFooter className="justify-between">
              <span className="text-muted-foreground text-sm">
                {saveMatchingSettings.isSuccess
                  ? "Saved"
                  : "Server-side settings"}
              </span>
              <Button
                disabled={saveMatchingSettings.isPending}
                onClick={() => saveMatchingSettings.mutate()}
              >
                Save matching settings
              </Button>
            </CardFooter>
          </>
        ) : (
          <CardContent>
            <p className="text-muted-foreground text-sm">
              Loading matching settings
            </p>
          </CardContent>
        )}
      </Card>
    </section>
  );
}

function toDraft(settings: {
  autoAcceptThreshold: number;
  includeVideos: boolean;
  reviewThreshold: number;
  searchLimit: number;
}) {
  return {
    autoAcceptThreshold: String(Math.round(settings.autoAcceptThreshold * 100)),
    includeVideos: settings.includeVideos,
    reviewThreshold: String(Math.round(settings.reviewThreshold * 100)),
    searchLimit: String(settings.searchLimit),
  };
}

function percentToRatio(value: string) {
  return Number(value) / 100;
}
