const DEFAULT_API_URL = "http://127.0.0.1:4317";
const API_URL_STORAGE_KEY = "spottoyt-api-url";
const SPOTIFY_PLAYLIST_PATH = /\/playlist\/([A-Za-z0-9]+)/;

type SpotifyPlaylistResponse = {
  name: string;
  uri: string;
};

type SpotifyTrackPage = {
  items: Array<{
    track?: {
      album?: {
        name?: string;
      };
      artists?: Array<{
        name?: string;
      }>;
      duration_ms?: number;
      explicit?: boolean;
      external_ids?: {
        isrc?: string;
      };
      name?: string;
      type?: string;
      uri?: string;
    } | null;
  }>;
  next: string | null;
};

type SpicetifySnapshot = {
  source: "spicetify";
  spotifyPlaylistUri: string;
  playlistName: string;
  snapshotAt: string;
  tracks: Array<{
    spotifyUri: string;
    title: string;
    artists: string[];
    album?: string;
    durationMs: number;
    isrc?: string;
    explicit: boolean;
    position: number;
  }>;
};

void boot();

async function boot() {
  if (!isReady()) {
    window.setTimeout(() => {
      void boot();
    }, 300);
    return;
  }

  const topbar = Spicetify.Topbar;

  if (!topbar) {
    return;
  }

  new topbar.Button("Send to SpottoYT", "download", sendPlaylist);
  notify("SpottoYT bridge ready");
}

function isReady() {
  return Boolean(
    Spicetify.CosmosAsync && Spicetify.Platform && Spicetify.Topbar,
  );
}

async function sendPlaylist() {
  try {
    const playlistId = getCurrentPlaylistId();

    if (!playlistId) {
      notify("Open a Spotify playlist first", true);
      return;
    }

    const snapshot = await readPlaylistSnapshot(playlistId);

    if (snapshot.tracks.length === 0) {
      notify("No Spotify tracks found in this playlist", true);
      return;
    }

    await postSnapshot(snapshot);
    notify(`Sent ${snapshot.tracks.length} tracks to SpottoYT`);
  } catch (error) {
    notify(
      error instanceof Error ? error.message : "SpottoYT sync failed",
      true,
    );
  }
}

function getCurrentPlaylistId() {
  const pathname =
    Spicetify.Platform?.History?.location?.pathname ?? window.location.pathname;

  return pathname.match(SPOTIFY_PLAYLIST_PATH)?.[1] ?? null;
}

async function readPlaylistSnapshot(
  playlistId: string,
): Promise<SpicetifySnapshot> {
  const cosmos = getCosmos();
  const playlist = await cosmos.get<SpotifyPlaylistResponse>(
    `https://api.spotify.com/v1/playlists/${playlistId}?fields=name,uri`,
  );

  return {
    source: "spicetify",
    spotifyPlaylistUri: playlist.uri,
    playlistName: playlist.name,
    snapshotAt: new Date().toISOString(),
    tracks: await readPlaylistTracks(playlistId),
  };
}

async function readPlaylistTracks(playlistId: string) {
  const tracks: SpicetifySnapshot["tracks"] = [];
  let nextUrl: string | null =
    `https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=100&offset=0`;

  while (nextUrl) {
    const page: SpotifyTrackPage =
      await getCosmos().get<SpotifyTrackPage>(nextUrl);

    for (const item of page.items) {
      const track = item.track;
      const artists =
        track?.artists
          ?.map((artist) => artist.name)
          .filter((name): name is string => Boolean(name)) ?? [];

      if (
        track?.type !== "track" ||
        !track.uri ||
        !track.name ||
        artists.length === 0 ||
        !track.duration_ms
      ) {
        continue;
      }

      tracks.push({
        spotifyUri: track.uri,
        title: track.name,
        artists,
        album: track.album?.name,
        durationMs: track.duration_ms,
        isrc: track.external_ids?.isrc,
        explicit: track.explicit ?? false,
        position: tracks.length + 1,
      });
    }

    nextUrl = page.next;
  }

  return tracks;
}

function getCosmos() {
  const cosmos = Spicetify.CosmosAsync;

  if (!cosmos) {
    throw new Error("Spicetify Cosmos is not ready");
  }

  return cosmos;
}

async function postSnapshot(snapshot: SpicetifySnapshot) {
  const response = await fetch(`${getApiUrl()}/imports/spicetify`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(snapshot),
  });

  if (!response.ok) {
    throw new Error(`SpottoYT rejected the import: ${response.status}`);
  }
}

function getApiUrl() {
  return (
    Spicetify.LocalStorage?.get(API_URL_STORAGE_KEY)?.replace(/\/$/, "") ??
    DEFAULT_API_URL
  );
}

function notify(message: string, isError = false) {
  Spicetify.showNotification?.(message, isError, 4000);
  console.log(`[SpottoYT] ${message}`);
}
